const http = require('http');
const fs = require('fs');
const url = require('url');
const socketio = require('socket.io');
const mazeHandler = require('./mazeMaker.js');

const MAX_ROOM_SIZE = 4;

const roomlist = {};
const rooms = {};


const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const bundle = fs.readFileSync(`${__dirname}/../hosted/bundle.js`);
const style = fs.readFileSync(`${__dirname}/../hosted/style.css`);

// deals with http requests
const onRequest = (request, response) => {
  const parsedURL = url.parse(request.url);

  if (parsedURL.pathname === '/bundle.js') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write(bundle);
  } else if (parsedURL.pathname === '/style.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' });
    response.write(style);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.write(index);
  }
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1:${port}`);

const io = socketio(app);


// updates the lobby for all players
const updateLobby = (room) => {
  if ((rooms[room].running || rooms[room].over)
      && roomlist[room].roomCount > 0) {
    roomlist[room].roomCount = -roomlist[room].roomCount;
  }
  io.to('lobby').emit('updateLobby', { room, roomCount: roomlist[room].roomCount });
  if (roomlist[room].roomCount === 0) {
    delete roomlist[room];
    delete rooms[room];
  }
};

// small function, but now i'll never mispell err
const socketErr = (sock, msg) => {
  const socket = sock;
  socket.emit('err', { msg });
};


// removes a player from a room
const leaveRoom = (sock) => {
  const socket = sock;

  if (!socket.roomString || !rooms[socket.roomString] || typeof socket.playerPos === 'undefined') {
    return;
  }

  const s = socket.roomString;
  const room = rooms[s];
  const n = socket.playerPos;

  // should probably do hashes
  if (!room[n]) {
    return;
  }


  socket.broadcast.to(socket.roomString).emit('left', { playerPos: socket.playerPos });

  delete room[n];
  delete socket.playerPos;

  if (room.readyCount > 0 && socket.ready) { room.readyCount--; }
  if (roomlist[s].roomCount < 0) {
    roomlist[s].roomCount++;
  } else {
    roomlist[s].roomCount--;
  }

  updateLobby(s);

  socket.leave(socket.roomString);
  delete socket.roomString;
};

// loads a maze
const loadMaze = (sock, roomName) => {
  const socket = sock;
  if (!roomName || !rooms[roomName]) {
    socketErr(socket, 'No room exists by that name');
    return;
  }

  if (rooms[roomName].maze) {
    socket.emit('load', { maze: rooms[roomName].maze });
    return;
  }

  const id = setInterval(() => {
    if (rooms[roomName].maze) {
      clearInterval(id);
      socket.emit('load', { maze: rooms[roomName].maze });
    }
  }, 10);
};

// puts a player in the lobby
const enterLobby = (sock) => {
  const socket = sock;

  socket.emit('lobby', roomlist);

  socket.join('lobby');

  socket.inLobby = true;
  delete socket.roomString;
};


// joins socket to a room
// room creation will require waiting while new mazes are made
const joinRoom = (sock, roomName) => {
  const socket = sock;

  if (socket.roomString) {
    leaveRoom(socket);
  }

  if (!rooms[roomName]) {
    return socketErr(socket, 'Room not found');
  }

  if (rooms[roomName].running || rooms[roomName].over) {
    return socketErr(socket, 'Game in progress');
  }

  const room = rooms[roomName];
  const roomData = roomlist[roomName];

  if (roomData.roomCount < MAX_ROOM_SIZE) {
    roomData.roomCount++;
  } else {
    return socket.emit('full', {});
  }

  updateLobby(roomName);
  socket.join(roomName);
  socket.roomString = roomName;
  socket.ready = false;
  socket.join(roomName);

  let looking = true;

  for (let i = 0; i < MAX_ROOM_SIZE; i++) {
    if (!room[i] && looking) {
      room[i] = socket;
      socket.playerPos = i;
      socket.emit('join', { player: i, room: roomName });
      looking = false;
    } else if (room[i]) {
      socket.emit('init', { playerPos: i });
    }
  }

  return loadMaze(socket, roomName);
};


// when a socket leaves a room, tells all others
const onLeave = (sock) => {
  const socket = sock;

  socket.on('leave', () => {
    if (!socket.roomString) {
      return;
    }

    leaveRoom(socket);
  });
};


// creates a room for a socket
const onCreate = (sock) => {
  const socket = sock;

  socket.on('create', (data) => {
    if (!data.room) {
      return;// no error message, had to cheat to get here
    }

    if (rooms[data.room] || data.room === 'lobby') {
      socketErr(socket, 'Room name already exists');
      return;
    }

    rooms[data.room] = { readyCount: 0, running: false, over: false };
    roomlist[data.room] = { roomCount: 0 };

    mazeHandler.createMaze(17, 17).then((m) => {
      rooms[data.room].maze = m;
    });

    joinRoom(socket, data.room);
  });
};

// ads a player to a room
const onJoinRoom = (sock) => {
  const socket = sock;

  socket.on('joinRoom', (data) => {
    if (!data || !data.room) {
      return socketErr(socket, 'No room name given');
    }

    return joinRoom(socket, data.room);
  });
};

// Currently only a small amount of validation is done here
// don't actually check if the player is cheating, just make sure
// that the numbers are actually there
const validatePos = (sock, data) => {
  const socket = sock;

  const newData = {};


  newData.x = parseFloat(data.x);
  newData.y = parseFloat(data.y);
  if (Number.isNaN(newData.x) || Number.isNaN(newData.y)) {
    return { fail: true };
  }

  newData.timestamp = new Date().getTime();
  newData.playerPos = socket.playerPos;
  delete newData.fail;
  return newData;
};

const onMove = (sock) => {
  const socket = sock;


  socket.on('move', (data) => {
    const newData = validatePos(socket, data);

    if (newData.fail) {
      return;
    }

    if (!rooms[socket.roomString].running) return;

    socket.broadcast.to(socket.roomString).emit('move', newData);
  });
};


// handles players trying to win the game
const onWin = (sock) => {
  const socket = sock;

  socket.on('win', (data) => {
    if (!rooms[socket.roomString].running) return;

    const newData = validatePos(socket, data);

    if (newData.fail) {
      return;
    }

    socket.broadcast.to(socket.roomString).emit('lose', { winner: socket.playerPos });
    socket.emit('win', {});
    rooms[socket.roomString].running = false;
    rooms[socket.roomString].over = true;
  });
};

// starts a room game for all players in room
const startGame = (room) => {
  io.to(room).emit('start', {});
  rooms[room].readyCount = 0;

  for (let i = 0; i < 4; i++) {
    if (rooms[room][i]) { rooms[room][i].ready = false; }
  }

  rooms[room].running = true;
  updateLobby(room);
};

// handles players readying up
const onReady = (sock) => {
  const socket = sock;

  socket.on('ready', () => {
    const s = socket.roomString;
    if (!s || !rooms[socket.roomString]) {
      return;
    }

    if (rooms[socket.roomString].running || rooms[socket.roomString].over) { return; }
    if (socket.ready) {
      return;
    }
    socket.ready = true;

    rooms[s].readyCount++;
    if (roomlist[s].roomCount > 1 && roomlist[s].roomCount === rooms[s].readyCount) {
      startGame(socket.roomString);
    }
  });
};

// when player requests a map reset
const onReset = (sock) => {
  const socket = sock;

  socket.on('reset', () => {
    if (!rooms[socket.roomString].over) { return; }

    rooms[socket.roomString].over = false;
    rooms[socket.roomString].running = false;
    rooms[socket.roomString].readyCount = 0;
    roomlist[socket.roomString].roomCount = Math.abs(roomlist[socket.roomString].roomCount);
    socket.broadcast.to(socket.roomString).emit('reset', {});

    updateLobby(socket.roomString);
  });
};

// sends initial player state to all players in room
const onInit = (sock) => {
  const socket = sock;

  socket.on('init', (data) => {
    socket.broadcast.to(socket.roomString).emit('init', data);
  });
};

// removes a socket from all rooms
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    leaveRoom(socket);
    socket.leave('lobby');
    delete socket.playerPos;
    delete socket.roomString;
    delete socket.isJoined;
    delete socket.inLobby;
  });
};

// Sets up the socket message handlers
io.sockets.on('connection', (sock) => {
  const socket = sock;

  enterLobby(socket);

  onInit(socket);
  onCreate(socket);
  onLeave(socket);
  onReady(socket);
  onReset(socket);
  onJoinRoom(socket);
  onMove(socket);
  onWin(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

