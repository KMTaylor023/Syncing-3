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


const onRequest = (request, response) => {
  const parsedURL = url.parse(request.url);

  if (parsedURL.pathname === '/bundle.js') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write(bundle);
  } else if (parsedURL.pathname === "./style.css"){
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


// small function, but now i'll never mispell err
const socketErr = (sock, msg) => {
  const socket = sock;

  socket.emit('err', { msg });
};


const loadMaze = (sock, roomName) => {
  const socket = sock;

  if (!roomName) {
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

const enterLobby = (sock) => {
  const socket = sock;

  socket.emit('lobby', roomlist);

  socket.roomString = 'lobby';
};

// joins socket to a room
// room creation will require waiting while new mazes are made
const joinRoom = (sock, roomName) => {
  const socket = sock;

  if (!rooms[roomName]) {
    return socketErr(socket, 'Room not found');
  }

  const room = rooms[roomName];
  const roomData = roomlist[roomName];

  if (roomData.roomCount < MAX_ROOM_SIZE) {
    roomData.roomCount++;
  } else {
    return socket.emit('full', {});
  }


  socket.join(roomName);
  socket.roomString = roomName;

  socket.join(roomName);

  for (let i = 0; i < MAX_ROOM_SIZE; i++) {
    if (!room[i]) {
      room[i] = socket;
      socket.playerPos = i;
      socket.emit('join', { player: i });
      return loadMaze(socket, roomName);
    }
  }
  // i'm not sure why the code would get here
  return socket.emit('full', {});
};

const leaveRoom = (sock, noLobby) => {
  const socket = sock;

  if (!socket.roomString || rooms[socket.roomString] || !socket.playerPos) {
    return;
  }

  const s = socket.roomString;
  const room = rooms[s];
  const n = socket.playerPos;

  // should probably do hashes
  if (!room[n]) {
    return;
  }

  delete room[n];
  delete socket.playerPos;

  roomlist[s].roomCount--;

  socket.leave(socket.roomString);

  delete socket.roomString;

  if (noLobby === true) {
    return;
  }

  enterLobby(socket);
};

const onLeave = (sock) => {
  const socket = sock;

  socket.on('leave', () => {
    if (!socket.roomString || socket.roomString === 'lobby') {
      return;
    }

    leaveRoom(socket);
  });
};

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

    rooms[data.room] = {};
    roomlist[data.room] = { roomCount: 1 };

    rooms[data.room][0] = socket;

    mazeHandler.createMaze(17, 17).then((m) => {
      rooms[data.room].maze = m;
    });

    joinRoom(socket, data.room);
  });
};

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
    return {};
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
    /*
    if (newData.fail) {
      return;
    } */

    socket.broadcast.to(socket.roomString).emit('move', newData);
  });
};

const onWin = (sock) => {
  const socket = sock;

  socket.on('win', (data) => {
    // this is here so eslint will get off my case for now
    if (!data) {
      return;// TODO actually validate data
    }

    socket.broadcast.to(socket.roomString).emit('lose', { winner: socket.playerPos });
    socket.emit('win', {});
    delete rooms[socket.roomString].running;
  });
};


const startGame = (room) => {
  io.to(room).emit('start', {});
  delete rooms[room].readyCount;
  rooms[room].running = true;
};

const onReady = (sock) => {
  const socket = sock;

  socket.on('ready', () => {
    const s = socket.roomString;

    if (!s || !rooms[socket.roomString]) {
      return;
    }

    if (socket.ready) {
      return;
    }

    socket.ready = true;

    if (!rooms[s].readyCount) {
      rooms[s].readyCount = 0;
    }

    rooms[s].readyCount++;

    if (rooms[s].roomCount > 1 && rooms[s].roomCount === rooms[s].readyCount) {
      startGame(socket.roomString);
    }
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    leaveRoom(socket, true);

    if (socket.roomString) {
      socket.leave(socket.roomString);
      if (rooms[socket.roomString]) { delete rooms[socket.roomString][socket.playerPos]; }
      delete socket.playerPos;
      delete socket.roomString;
      delete socket.isJoined;
    }
  });
};

// Sets up the socket message handlers
io.sockets.on('connection', (sock) => {
  const socket = sock;


  if (!socket.isJoined) {
    socket.isJoined = true;
  }

  enterLobby(socket);

  onCreate(socket);
  onLeave(socket);
  onReady(socket);
  onJoinRoom(socket);
  onMove(socket);
  onWin(socket);
  onDisconnect(socket);

  console.log('attempt');
});

console.log('Websocket server started');

