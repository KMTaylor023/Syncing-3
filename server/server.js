const http = require('http');
const fs = require('fs');
const url = require('url');
const socketio = require('socket.io');
const mazeHandler = require('./mazeMaker.js');

const MAX_ROOM_SIZE = 2;


let roomCount = 0;

const rooms = {};

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const bundle = fs.readFileSync(`${__dirname}/../hosted/bundle.js`);

let maze;

mazeHandler.createMaze(17,17).then((m) => {
  maze = m;
  console.log(maze);
});

const onRequest = (request, response) => {
  const parsedURL = url.parse(request.url);

  if (parsedURL.pathname === '/bundle.js') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write(bundle);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.write(index);
  }
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1:${port}`);

const io = socketio(app);


// joins socket to a room
// Doesn't need to be a promise, but probably will
// room creation will require waiting while new mazes are made
const joinRoom = sock => new Promise((resolve, fail) => {
  const socket = sock;
  if (roomCount < MAX_ROOM_SIZE) {
    roomCount++;
  } else {
    socket.emit('full', {});
    fail();
  }


  socket.join('room1');
  socket.roomString = 'room1';
  rooms.room1 = rooms.room1 || {};
  const room = rooms.room1;
  for (let i = 0; i < MAX_ROOM_SIZE; i++) {
    if (!room[i]) {
      room[i] = socket;
      socket.playerPos = i;
      socket.emit('join', { player: socket.playerPos, maze });
      resolve();
      break;
    }
  }

  fail();
});

// Currently only a small amount of validation is done here
// don't actually check if the player is cheating, just make sure
// that the numbers are actually there
const validatePos = (sock, data) => {
  const socket = sock;

  const newData = { fail: true };

  if (!data.x || !data.y) {
    return newData;
  }

  newData.x = parseFloat(data.x);
  newData.y = parseFloat(data.y);

  if (Number.isNaN(newData.x) || Number.isNaN(newData.y)) {
    return newData;
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
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    if (socket.roomString) {
      socket.leave(socket.roomString);
      delete rooms[socket.roomString][socket.playerPos];
      console.dir(rooms[socket.roomString]);
      delete socket.playerPos;
      delete socket.roomString;
      delete socket.isJoined;
    }
  });
};

// Sets up the socket message handlers
io.sockets.on('connection', (sock) => {
  const socket = sock;
  
  
  if(!socket.isJoined){
    socket.isJoined = true;
  }

  joinRoom(socket).then(() => {
    console.log(`player ${socket.playerPos} joined`);
    onMove(socket);
    onWin(socket);
    onDisconnect(socket);
  }).catch(() => {
    socket.disconnect(true);
    delete socket.isJoined;
  });

  console.log('attempt');
});

console.log('Websocket server started');

