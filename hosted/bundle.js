'use strict';

/* eslint-env browser */
/* global io */
/* eslint no-bitwise: ["error", { "allow": ["|=",">>","&"] }] */
// previous comments are to set up eslint for browser use
// I wanted to eslint the browser code for my own sanity
// also i *needed* bitwise


var players = {};

var MOVE_FRAME_WAIT = 20;
var P_SIZE = 20;
var MAZE_SQUARE_SIZE = 30;
var MAZE_PAD = (MAZE_SQUARE_SIZE - P_SIZE) / 2;

var LOBBY = 0;
var GAME = 1;
var LOADING = 2;
var ERR = 3;

var sections = ['lobby', 'game', 'loading', 'err'];

var LEFT = 0;
var UP = 1;
var RIGHT = 2;
var DOWN = 3;

var mazeCanvas = document.createElement('canvas');
var mazeCtx = mazeCanvas.getContext('2d');

var gamelist = {};

// left,  up,    right,  down
var move = [false, false, false, false];

var playerNum = -1;

var maze = void 0;

var moveFrames = MOVE_FRAME_WAIT;

var helpTextTag = void 0;

var ready = false;
var tryWin = false;
var gameRunning = false;

var keyDownHandler = function keyDownHandler(e) {
  var keyPressed = e.which;
  if (keyPressed === 87 || keyPressed === 38) {
    move[UP] = true;
  } else if (keyPressed === 65 || keyPressed === 37) {
    move[LEFT] = true;
  } else if (keyPressed === 83 || keyPressed === 40) {
    move[DOWN] = true;
  } else if (keyPressed === 68 || keyPressed === 39) {
    move[RIGHT] = true;
  }
  if (move[UP] || move[LEFT] || move[DOWN] || move[RIGHT]) {
    e.preventDefault(true);
  }
};

var keyUpHandler = function keyUpHandler(e) {
  var keyPressed = e.which;
  if (keyPressed === 87 || keyPressed === 38) {
    move[UP] = false;
  } else if (keyPressed === 65 || keyPressed === 37) {
    move[LEFT] = false;
  } else if (keyPressed === 83 || keyPressed === 40) {
    move[DOWN] = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    move[RIGHT] = false;
  }
};

var updatePlayer = function updatePlayer(number, data) {
  if (!players[number]) {
    players[number] = {};
  }
  var player = players[number];

  // TODO could lerp here
  player.x = data.x;
  player.y = data.y;
};

var addPlayer = function addPlayer(number) {
  players[number] = {
    x: 0,
    y: 0,
    width: P_SIZE,
    height: P_SIZE
  };

  // sets up corners
  if (number > 1) {
    players[number].y = maze.length - 1;
  }
  if (number === 0 || number === 2) {
    players[number].x = maze[0].length - 1;
  }
};

var resetGame = function resetGame() {
  var playKeys = Object.keys(players);

  for (var i = 0; i < playKeys.length; i++) {
    addPlayer(playKeys[i]);
  }

  gameRunning = false;
  ready = false;
  tryWin = false;
  moveFrames = MOVE_FRAME_WAIT;
};

var exitGame = function exitGame() {
  var playKeys = Object.keys(players);

  for (var i = 0; i < playKeys.length; i++) {
    delete players[playKeys[i]];
  }

  resetGame();

  maze = {};
  playerNum = -1;
};

// Updates position, returns true if player is now in win spot
var updatePosition = function updatePosition(sock) {
  if (tryWin || !gameRunning) {
    return false;
  }
  var socket = sock;
  var me = players[playerNum];
  var mazePos = maze[me.y][me.x];

  if (moveFrames === MOVE_FRAME_WAIT) {
    var moved = false;
    // loops through all possible directions to move
    // exits loop if one direction is true
    // order is defined by the UP, DOWN, LEFT, RIGHT globals
    for (var i = 0; i < 4; i++) {
      if (move[i]) {
        moved = true;
        // shifts bit over by i, then ands bits with 1
        // checks if the bit for this direction is set to 1
        // bit meaning 1:L 2:U 4:R 8:D
        if ((mazePos >> i & 1) === 1) {
          switch (i) {
            case 0:
              me.x--;
              break;
            case 1:
              me.y--;
              break;
            case 2:
              me.x++;
              break;
            default:
              me.y++;
              break;
          }
          break;
        }
      }
    }
    if (moved) {
      moveFrames = 0;
      socket.emit('move', { x: me.x, y: me.y });
    }
  } else {
    moveFrames++;
  }

  if (maze[me.y][me.x] < 0) {
    return true;
  }
  return false;
};

var drawPlayer = function drawPlayer(playnum, ctx, color) {
  var player = players[playnum];
  if (!player) {
    return;
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(player.x * MAZE_SQUARE_SIZE + MAZE_PAD, player.y * MAZE_SQUARE_SIZE + MAZE_PAD, P_SIZE, P_SIZE);
  ctx.restore();
};

var roomclick = function roomclick(e) {

  e.preventDefault(true);
  if (e.target.className === 'full') {
    return false;
  }

  var room = e.target.getAttribute('room');

  setVisible(LOADING);
  socket.emit('joinRoom', { room: room });

  return false;
};

var setupLobby = function setupLobby(ul) {

  var keys = Object.keys(gamelist);

  for (var i = 0; i < keys.length; i++) {

    if (gamelist[i].element) {
      continue;
    }

    var li = document.createElement('li');
    var a = document.createElement('a');

    if (data[keys[i]].roomCount >= 4) {
      a.className = 'full';
    } else {
      a.className = 'open';
    }

    a.setAttribute('href', '#' + keys[i]);
    a.setAttribute('room', keys[i]);
    a.onclick = roomclick;
    a.innerHTML = keys[i] + ' : ' + gamelist[keys[i]].roomCount + '/4';
    li.appendChild(a);
    ul.appendChild(li);
    gamelist[i].element = li;
  }
};

// draws the maze to the mazeCtx
var drawMaze = function drawMaze() {
  mazeCtx.fillStyle = 'black';
  mazeCtx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
  mazeCtx.fillStyle = 'white';

  var yPos = 0;

  for (var y = 0; y < maze.length; y++) {
    var xPos = 0;
    for (var x = 0; x < maze[y].length; x++) {
      var mazePos = maze[y][x];
      if (mazePos < 0) {
        mazeCtx.fillStyle = 'green';
        mazePos = -mazePos;
      }
      mazeCtx.fillRect(xPos + MAZE_PAD, yPos + MAZE_PAD, P_SIZE, P_SIZE);

      for (var i = 0; i < 4; i++) {
        // shifts bit over by i, then ands bits with 1
        // checks if the bit for this direction is set to 1
        // if so, draws a rect in that direction for the maze
        // bit meaning 1:L 2:U 4:R 8:D
        if ((mazePos >> i & 1) === 1) {
          switch (i) {
            case 0:
              mazeCtx.fillRect(xPos, yPos + MAZE_PAD, MAZE_PAD, P_SIZE);
              break;
            case 1:
              mazeCtx.fillRect(xPos + MAZE_PAD, yPos, P_SIZE, MAZE_PAD);
              break;
            case 2:
              mazeCtx.fillRect(xPos + P_SIZE + MAZE_PAD, yPos + MAZE_PAD, MAZE_PAD, P_SIZE);
              break;
            default:
              mazeCtx.fillRect(xPos + MAZE_PAD, yPos + P_SIZE + MAZE_PAD, P_SIZE, MAZE_PAD);
              break;
          }
        }
      }
      if (maze[y][x] < 0) {
        mazeCtx.fillStyle = 'white';
      }
      xPos += MAZE_SQUARE_SIZE;
    }
    yPos += MAZE_SQUARE_SIZE;
  }
};

var makeErr = function makeErr(msg) {
  setVisible(ERR);
  document.querySelector('errMsg').innerHTML = m;
};

var redraw = function redraw(time, socket, canvas, ctx) {
  if (gameRunning) {
    if (!tryWin) {
      tryWin = updatePosition(socket);
      if (tryWin) {
        socket.emit('win', players[playerNum]);
      } else {
        socket.emit('move', players[playerNum]);
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(mazeCanvas, 0, 0);

  var playKeys = Object.keys(players);
  for (var i = 0; i < playKeys.length; i++) {
    if (playKeys[i] !== playerNum) {
      drawPlayer(playKeys[i], ctx, 'red');
    }
  }
  // draw us on top
  drawPlayer(playerNum, ctx, 'blue');

  requestAnimationFrame(function (t) {
    return redraw(t, socket, canvas, ctx);
  });
};

var setVisible = function setVisible(visible) {
  for (var i = 0; i < sections.length; i++) {
    if (i === visible) {
      sections[i].style.display = 'block';
    } else {
      sections[i].style.display = 'none';
    }
  }
};

/* +++++++++++++++++++++++++++++++ on +++++++++++++++++++ */

var onLose = function onLose(sock) {
  var socket = sock;

  socket.on('lose', function (data) {
    helpTextTag.innerHTML = 'YOU LOST TO PLAYER ' + (data.winner + 1) + '!! :c';
    helpTextTag.style.color = 'red';
    gameRunning = false;
    tryWin = true;
  });
};

var onWin = function onWin(sock) {
  var socket = sock;

  socket.on('win', function () {
    helpTextTag.innerHTML = 'YOU WON!!';
    helpTextTag.style.color = 'blue';
    gameRunning = false;
  });
};

var onMove = function onMove(sock) {
  var socket = sock;
  socket.on('move', function (data) {
    if (gameRunning) {
      updatePlayer(data.playerPos, data);
    }
  });
};

var onLoad = function onLoad(sock, canvas) {
  var socket = sock;

  socket.on('load', function (data) {
    maze = data.maze;

    drawMaze();

    setVisible(GAME);

    requestAnimationFrame(function (time) {
      return redraw(time, socket, canvas, canvas.getContext('2d'));
    });
  });
};

var onJoin = function onJoin(sock) {
  var socket = sock;

  socket.on('join', function (data) {
    if (playerNum > -1) {
      return;
    }

    setVisible(LOADING);

    playerNum = data.player;

    document.querySelector('#roomp').innerHTML = 'Room: ' + data.room;

    addPlayer(playerNum);
  });
};

var onFull = function onFull(sock) {
  var socket = sock;

  socket.on('full', function () {
    // TODO something about how you didn't join, idk, not important right now
  });
};

var onErr = function onErr(sock) {
  var socket = sock;

  socket.on('err', function (data) {
    exitGame();
    makeErr(data.msg);
  });
};

var onLobbyUpdate = function onLobbyUpdate(sock, ul) {
  var socket = sock;

  socket.on('updateLobby', function (data) {
    var room = data.room;

    var count = data.roomCount;

    if (count === 0 && gamelist[room]) {
      ul.removeChild(gamelist[room].element);
      delete gamelist[room];
    } else if (!gamelist[room]) {
      gamelist[room].roomCount = count;
      setupLobby(ul);
    } else {
      gamelist[room].roomCount = count;
      gamelist[room].element.innerHTML = room + ' : ' + count + '/4';
      if (count === 4) {
        gamelist[room].element.className = 'full';
      } else {
        gamelist[room].element.className = 'open';
      }
    }
  });
};

var onLobby = function onLobby(sock, ul) {
  var socket = sock;

  socket.on('lobby', function (data) {
    setVisible(LOBBY);

    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      gamelist[keys[i]] = data[keys[i]];
    }

    setupLobby(ul);
  });
};

var onStart = function onStart(sock) {
  var socket = sock;

  socket.on('start', function () {
    gameRunning = true;
  });
};

/* ------------------------------- on ------------------- */

var init = function init() {
  var canvas = document.querySelector('canvas');
  canvas.width = 520;
  canvas.height = 520;
  mazeCanvas.width = 520;
  mazeCanvas.height = 520;
  canvas.style.border = '1px solid blue';

  helpTextTag = document.querySelector('#helpText');

  var socket = io.connect();

  var lobby = document.querySelector('#lobby');
  var lobbyButton = document.querySelector('#lobbyButton');
  var createButton = document.querySelector('#createRoomButton');
  var readyButton = document.querySelector('#ready');
  var leaveButton = document.querySelector('#leave');

  var nameText = document.querySelector('#roomName');

  for (var i = 0; i < sections.length; i++) {
    sections[i] = document.querySelector('#' + sections[i]);
  }

  leaveButton.addEventListener('click', function (e) {
    socket.emit('leave', {});
    setVisible(LOBBY);
    exitGame();

    e.preventDefault(true);
    return false;
  });

  readyButton.addEventListener('click', function (e) {
    e.preventDefault(true);

    if (ready) {
      return false;
    }

    socket.emit('ready', {});
    ready = true;

    return false;
  });

  createButton.addEventListener('click', function (e) {
    e.preventDefault(true);
    if (nameText.value === '') {
      return false;
    }

    console.log(nameText.value);
    socket.emit('create', { room: nameText.value });
    setVisible(LOADING);
    nameText.value = '';

    return false;
  });

  lobbyButton.addEventListener('click', function (e) {
    setVisible(LOBBY);

    e.preventDefault(true);
    return false;
  });

  socket.on('connect', function () {
    onLobby(socket, lobby);
    onUpdateLobby(socket, lobby);
    onJoin(socket);
    onLoad(socket, canvas);
    onFull(socket);
    onStart(socket);
    onErr(socket);
    onMove(socket);
    onWin(socket);
    onLose(socket);
  });

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;
