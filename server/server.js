const http = require('http');
const fs = require('fs');
const url = require('url');
const socketio = require('socket.io');
const xxh = require('xxhashjs');

const Character = require('./character.js');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const bundle = fs.readFileSync(`${__dirname}/../hosted/bundle.js`);
const style = fs.readFileSync(`${__dirname}/../hosted/style.css`);
const walk = fs.readFileSync(`${__dirname}/../hosted/walk.png`);

// per 20 frames
const JUMP_VEL = -10.0;
const GRAVITY = 0.7;
const MAX_HEIGHT = 500;
const MAX_WIDTH = 500;

const PLAYER_WIDTH = 61;
const PLAYER_HEIGHT = 121;

const players = {};

// deals with http requests
const onRequest = (request, response) => {
  const parsedURL = url.parse(request.url);

  if (parsedURL.pathname === '/bundle.js') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write(bundle);
  } else if (parsedURL.pathname === '/style.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' });
    response.write(style);
  } else if (parsedURL.pathname === '/walk.png') {
    response.writeHead(200, { 'Content-Type': 'image/png' });
    response.write(walk);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.write(index);
  }
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1:${port}`);

const io = socketio(app);

const updateVelocityY = (char) => {
  const player = char;
  player.destY = player.y + (10 * player.vy);

  if (player.y >= 379 && player.vy > 0) {
    player.airborne = false;
  }

  player.lastUpdate = new Date().getTime();

  io.sockets.in('room1').emit('grav', player);
};


// validates player movement, returns false if player movement is wrong
const validatePos = (sock, data) => {
  const socket = sock;

  const player = players[socket.hash];

  let valid = true;

  if (player.vy !== data.vy && player.destY !== data.destY) {
    valid = false;
  }

  if (data.x < 0) {
    player.x = 0;
    valid = false;
  } else if (data.x > MAX_WIDTH - PLAYER_WIDTH) {
    player.x = MAX_WIDTH - PLAYER_WIDTH;
    valid = false;
  } else {
    player.x = data.x;
  }

  if (data.y < 0) {
    player.y = 0;
    valid = false;
  } else if (data.y > MAX_HEIGHT - PLAYER_HEIGHT) {
    player.y = MAX_HEIGHT - PLAYER_HEIGHT;
    player.airborne = false;
    valid = false;
  } else {
    player.y = data.y;
  }

  if (player.airborne && player.y > MAX_HEIGHT - PLAYER_HEIGHT) {
    player.airborne = false;
    if (data.airborne) {
      valid = false;
    }
  }

  player.destX = data.destX;
  player.px = data.px;
  player.py = data.py;
  player.direction = data.direction;
  player.moveLeft = data.moveLeft;
  player.moveRight = data.moveRight;
  player.moveDown = data.moveDown;
  player.moveUp = data.moveUp;
  player.lastUpdate = new Date().getTime();

  return valid;
};


// passes on the move to all other players
// if data not valid or was modified, also passes on to originating player
const onMove = (sock) => {
  const socket = sock;

  socket.on('move', (data) => {
    if (!validatePos(socket, data)) {
      socket.emit('move', players[socket.hash]);
    }
    socket.broadcast.to('room1').emit('move', players[socket.hash]);
  });
};

const onJump = (sock) => {
  const socket = sock;

  socket.on('jump', () => {
    if (players[socket.hash].airborne) {
      return;
    }

    players[socket.hash].airborne = true;

    const player = players[socket.hash];

    player.vy = JUMP_VEL;

    updateVelocityY(player);
  });
};

const doGravity = () => {
  const keys = Object.keys(players);

  for (let i = 0; i < keys.length; i++) {
    const player = players[keys[i]];
    if (player.airborne) {
      player.vy += GRAVITY;

      updateVelocityY(player);
    }
  }
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    io.sockets.in('room1').emit('left', players[socket.hash]);
    delete players[socket.hash];

    socket.leave('room1');
  });
};

const updatePlayers = (sock) => {
  const socket = sock;
  const { hash } = socket;

  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== hash) {
      socket.emit('move', players[keys[i]]);
    }
  }
};

// Sets up the socket message handlers
io.sockets.on('connection', (sock) => {
  const socket = sock;

  const hash = xxh.h32(`${socket.id}${new Date().getTime()}`, 0xBEEFBABE).toString(16);

  players[hash] = new Character(hash);

  socket.hash = hash;
  socket.join('room1');
  socket.emit('join', players[hash]);
  updatePlayers(socket);

  onMove(socket);
  onJump(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

setInterval(doGravity, 20);

