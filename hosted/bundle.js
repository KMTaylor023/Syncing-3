'use strict';

var players = {};

var jumpTimer = 0;
var moveLeft = false;
var moveRight = false;
var jump = false;
var grounded = false;
var hash = 0;

// +++++++ Key handlers deal with setting player direction when game is running
var keyDownHandler = function keyDownHandler(e) {
  var keyPressed = e.which;
  if (keyPressed === 65 || keyPressed === 37) {
    moveLeft = true;
  } else if (keyPressed === 68 || keyPressed === 39) {
    moveRight = true;
  } else if (keyPressed === 32) {
    jump = true;
  }

  if (moveLeft || moveRight || jump) {
    e.preventDefault(true);
  }
};

var keyUpHandler = function keyUpHandler(e) {
  var keyPressed = e.which;
  if (keyPressed === 65 || keyPressed === 37) {
    moveLeft = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    moveRight = false;
  } else if (keyPressed === 32) {
    jump = false;
  }
};
// -------

var addPlayer = function addPlayer(char) {
  var player = char;

  player.frame = 0;
  player.frameCount = 0;
  player.alpha = 0.05;

  if (players[player.hash]) {
    player.frame = players[player.hash].frame;
    player.frameCount = players[player.hash].frameCount;
  }
  players[player.hash] = player;
};

var onJoin = function onJoin(sock, canvas, walkImage) {
  var socket = sock;

  socket.on('join', function (data) {
    hash = data.hash;
    addPlayer(data);

    requestAnimationFrame(function (t) {
      return redraw(t, canvas.getContext('2d'), socket, walkImage);
    });
  });
};

var onLeft = function onLeft(sock) {
  var socket = sock;

  socket.on('left', function (data) {
    delete players[data.hash];
  });
};

var onMove = function onMove(sock) {
  var socket = sock;

  socket.on('move', function (data) {
    if (!players[data.hash]) {
      addPlayer(data);
      return;
    }

    if (players[data.hash].lastUpdate >= data.lastUpdate) {
      return;
    }

    addPlayer(data);
  });
};

var onGrav = function onGrav(sock) {
  var socket = sock;

  socket.on('grav', function (data) {
    if (!players[data.hash]) {
      addPlayer(data);
      return;
    }

    var player = players[data.hash];

    if (player.lastUpdate >= data.lastUpdate) {
      return;
    }

    player.vy = data.vy;
    player.airborne = data.airborne;
  });
};

// sets up initial app state
var init = function init() {
  var canvas = document.querySelector('canvas');
  canvas.width = 500;
  canvas.height = 500;
  canvas.style.border = '1px solid blue';

  var walkImage = document.querySelector('#walk');
  var socket = io.connect();

  socket.on('connect', function () {
    onJoin(socket, canvas, walkImage);
    onLeft(socket);
    onMove(socket);
    onGrav(socket);
  });

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;
'use strict';

var spriteSizes = {
  WIDTH: 61,
  HEIGHT: 121
};

var directions = {
  DOWNLEFT: 0,
  DOWN: 1,
  DOWNRIGHT: 2,
  LEFT: 3,
  UPLEFT: 4,
  RIGHT: 5,
  UPRIGHT: 6,
  UP: 7
};

var lerp = function lerp(v0, v1, alpha) {
  return (1 - alpha) * v0 + alpha * v1;
};

var updatePosition = function updatePosition(sock) {
  var socket = sock;
  var player = players[hash];
  player.moveLeft = moveLeft;
  player.moveRight = moveRight;
  player.px = player.x;
  player.py = player.y;
  if (player.moveLeft && player.destX > 2) {
    player.destX -= 2;
  }
  if (player.moveRight && player.destX < 437) {
    player.destX += 2;
  }
  if (jump && !player.airborne && grounded) {
    player.airborne = true;
    grounded = false;
    socket.emit('jump', {});
  }

  player.destY = player.y + 20 * player.vy;

  if (player.airborne && player.vy < 0 && player.moveLeft) player.direction = directions.UPLEFT;

  if (player.airborne && player.vy < 0 && player.moveRight) player.direction = directions.UPRIGHT;

  if (player.airborne && player.vy > 0 && player.moveLeft) player.direction = directions.DOWNLEFT;

  if (player.airborne && player.vy > 0 && player.moveRight) player.direction = directions.DOWNRIGHT;

  if (player.airborne && player.vy > 0 && !(player.moveRight || player.moveLeft)) player.direction = directions.DOWN;

  if (player.airborne && player.vy < 0 && !(player.moveRight || player.moveLeft)) player.direction = directions.UP;

  if (player.moveLeft && !player.airborne) player.direction = directions.LEFT;

  if (player.moveRight && !player.airborne) player.direction = directions.RIGHT;

  player.alpha = 0.05;

  socket.emit('move', player);
};

var redraw = function redraw(time, ctx, socket, walkImage) {
  updatePosition(socket);
  ctx.clearRect(0, 0, 500, 500);

  var keys = Object.keys(players);

  for (var i = 0; i < keys.length; i++) {

    var player = players[keys[i]];

    //if alpha less than 1, increase it by 0.01
    if (player.alpha < 1) player.alpha += 0.05;

    if (player.hash === hash) {
      ctx.filter = "none";
    } else {
      ctx.filter = "hue-rotate(40deg)";
    }

    player.x = lerp(player.px, player.destX, player.alpha);

    grounded = true;
    if (player.airborne) {
      grounded = false;
      player.y = lerp(player.py, player.destY, player.alpha);
    }

    if (player.y > 379) {
      player.y = 379;
      player.airborne = false;
    }

    // if we are mid animation or moving in any direction
    if (!player.airborne && (player.frame > 0 || player.moveRight || player.moveLeft)) {
      player.frameCount++;

      if (player.frameCount % 8 === 0) {
        if (player.frame < 7) {
          player.frame++;
        } else {
          player.frame = 0;
        }
      }
    }

    ctx.drawImage(walkImage, spriteSizes.WIDTH * player.frame, spriteSizes.HEIGHT * player.direction, spriteSizes.WIDTH, spriteSizes.HEIGHT, player.x, player.y, spriteSizes.WIDTH, spriteSizes.HEIGHT);

    ctx.strokeRect(player.x, player.y, spriteSizes.WIDTH, spriteSizes.HEIGHT);
  }

  requestAnimationFrame(function (t) {
    return redraw(t, ctx, socket, walkImage);
  });
};
