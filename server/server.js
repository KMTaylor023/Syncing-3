const http = require('http');
const fs = require('fs');
const url = require('url');
const socketio = require('socket.io');

const MAX_ROOM_SIZE = 2;


let roomCount = 0;

const rooms = {};

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const bundle = fs.readFileSync(`${__dirname}/../hosted/bundle.js`);

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
const joinRoom = (sock) => {
  const socket = sock;

  if (roomCount < MAX_ROOM_SIZE) {
    roomCount++;
  } else {
    socket.emit('full', {});
    return false;
  }


  socket.join('room1');
  socket.roomString = 'room1';

  const room = rooms.room1;
  for (let i = 0; i < MAX_ROOM_SIZE; i++) {
    if (!room[i]) {
      room[i] = socket;
      socket.playerPos = i;
      socket.emit('join', { player: socket.playerPos });
      return i;
    }
  }

  return false;
};

// Currently only a small amount of validation is done here
// don't actually check if the player is cheating, just make sure
// that the numbers are actually there
const validatePos = (sock, data) => {
  // this is here so eslint will get off my case for now
  if (!sock) {
    return { fail: true };
  }

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
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    if (socket.roomString) {
      socket.leave(socket.roomString);
    }
  });
};

// Sets up the socket message handlers
io.sockets.on('connection', (sock) => {
  const socket = sock;

  if (joinRoom(socket) !== false) {
    socket.disconnect(true);
    return;
  }


  onMove(socket);
  onWin(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

