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

// +++++++ Key handlers deal with setting player direction when game is running
var keyDownHandler = function keyDownHandler(e) {
  if (!maze) {
    return;
  }
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
  if (!maze) {
    return;
  }
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
// ------- 

//Updates a plyers position
var updatePlayer = function updatePlayer(number, data) {
  if (!players[number]) {
    players[number] = {};
  }
  var player = players[number];

  // TODO could lerp here
  player.x = data.x;
  player.y = data.y;
};

//sets the pplayer number square up
var addPlayer = function addPlayer(number) {
  players[number] = {
    x: 0,
    y: 0,
    width: P_SIZE,
    height: P_SIZE
  };

  // sets up corners
  if (+number > 1) {
    players[number].y = 16;
  }
  if (+number === 0 || +number === 2) {
    players[number].x = 16;
  }
};

//resets the current game state
var resetGame = function resetGame() {
  var playKeys = Object.keys(players);
  for (var i = 0; i < playKeys.length; i++) {
    addPlayer(playKeys[i]);
  }

  for (var _i = 0; _i < 4; _i++) {
    move[_i] = false;
  }

  helpTextTag.className = "";

  helpTextTag.innerHTML = "Ready Up!";

  document.querySelector('#again').style.display = 'none';

  gameRunning = false;
  ready = false;
  tryWin = false;
  moveFrames = MOVE_FRAME_WAIT;
};

//exists the game, removes all game state vars
var exitGame = function exitGame() {
  var playKeys = Object.keys(players);

  for (var i = 0; i < playKeys.length; i++) {
    delete players[playKeys[i]];
  }

  resetGame();

  maze = undefined;
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
      socket.emit('move', { playerPos: playerNum, x: me.x, y: me.y });
    }
  } else {
    moveFrames++;
  }

  if (maze[me.y][me.x] < 0) {
    return true;
  }
  return false;
};

//draws a player
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

//the click handler for the rooom joins
var roomclick = function roomclick(e, sock) {
  var socket = sock;
  e.preventDefault(true);
  if (e.target.className === 'full') {
    return false;
  }

  var room = e.target.getAttribute('room');

  setVisible(LOADING);
  socket.emit('joinRoom', { room: room });

  return false;
};

//sets up the lobby list
var setupLobby = function setupLobby(ul, sock) {

  var keys = Object.keys(gamelist);

  if (keys.length === 0) {
    document.querySelector('#joinh').style.display = 'none';
  } else {
    document.querySelector('#joinh').style.display = 'block';
  }

  var click = function click(e) {
    return roomclick(e, sock);
  };

  for (var i = 0; i < keys.length; i++) {
    if (gamelist[keys[i]].element) {
      continue;
    }

    var li = document.createElement('li');
    var a = document.createElement('a');

    var num = gamelist[keys[i]].roomCount;

    if (gamelist[keys[i]].roomCount >= 4 || num < 0) {
      a.className = 'full';
    } else {
      a.className = 'open';
    }

    a.setAttribute('href', '#' + keys[i]);
    a.setAttribute('room', keys[i]);
    a.onclick = click;
    a.innerHTML = keys[i] + ' : ' + Math.abs(gamelist[keys[i]].roomCount) + '/4';
    li.appendChild(a);
    ul.appendChild(li);
    gamelist[keys[i]].element = li;
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

//redraws the game
var redraw = function redraw(time, socket, canvas, ctx) {
  if (!maze) {
    return;
  }

  if (gameRunning) {
    if (!tryWin) {
      tryWin = updatePosition(socket);
      if (tryWin) {
        socket.emit('win', { x: players[playerNum].x, y: players[playerNum].y });
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

//sets a given section to visible, and others invisible
var setVisible = function setVisible(visible) {
  for (var i = 0; i < sections.length; i++) {
    if (i === visible) {
      sections[i].style.display = 'block';
    } else {
      sections[i].style.display = 'none';
    }
  }
};

//sets end game message
var endGame = function endGame(msg, classed) {
  helpTextTag.innerHTML = msg;
  helpTextTag.className = classed;

  gameRunning = false;

  document.querySelector('#again').style.display = 'inline';
};

/* +++++++++++++++++++++++++++++++ on +++++++++++++++++++ */

//when a player loses the game, sets lose message
var onLose = function onLose(sock) {
  var socket = sock;

  socket.on('lose', function (data) {
    endGame('YOU LOST TO PLAYER ' + (data.winner + 1) + '!! :c', 'lose');
  });
};

//when a player wins the game, sets win message
var onWin = function onWin(sock) {
  var socket = sock;

  socket.on('win', function () {
    endGame('YOU WON!!', 'win');
  });
};

//moves the player given on move
var onMove = function onMove(sock) {
  var socket = sock;
  socket.on('move', function (data) {
    if (gameRunning) {
      updatePlayer(data.playerPos, data);
    }
  });
};

//sets up a player who has joined the room
var onInit = function onInit(sock) {
  var socket = sock;

  socket.on('init', function (data) {
    addPlayer(data.playerPos);
  });
};

//loads the maze 
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

//joins the game, sets up plyaer position
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
    helpTextTag.innerHTML = 'Ready Up!';

    var me = players[playerNum];

    socket.emit('init', { playerPos: playerNum });
  });
};

//The room was full
var onFull = function onFull(sock) {
  var socket = sock;

  socket.on('full', function () {
    // TODO something about how you didn't join, idk, not important right now
  });
};

//showws an error
var onErr = function onErr(sock) {
  var socket = sock;

  socket.on('err', function (data) {
    exitGame();
    setVisible(ERR);
    document.querySelector('#errMsg').innerHTML = data.msg;
  });
};

//updates the lobby when rooms change
var onUpdateLobby = function onUpdateLobby(sock, ul) {
  var socket = sock;

  socket.on('updateLobby', function (data) {
    var room = data.room;

    var count = data.roomCount;
    var closed = false;
    if (count < 0) {
      count = -count;
      closed = true;
    }

    if (count === 0 && gamelist[room]) {
      ul.removeChild(gamelist[room].element);
      delete gamelist[room];
    } else if (!gamelist[room]) {
      gamelist[room] = { roomCount: count };
      setupLobby(ul, sock);
    } else {
      gamelist[room].roomCount = count;
      gamelist[room].element.firstChild.innerHTML = room + ' : ' + count + '/4';
      if (count === 4 || closed) {
        gamelist[room].element.firstChild.className = 'full';
      } else {
        gamelist[room].element.firstChild.className = 'open';
      }
    }
  });
};

//the initial lobby setup
var onLobby = function onLobby(sock, ul) {
  var socket = sock;
  socket.on('lobby', function (data) {
    setVisible(LOBBY);
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      gamelist[keys[i]] = data[keys[i]];
    }
    setupLobby(ul, sock);
  });
};

//resets the game
var onReset = function onReset(sock) {
  var socket = sock;

  socket.on('reset', function () {
    resetGame();
  });
};

//starts the game
var onStart = function onStart(sock) {
  var socket = sock;

  socket.on('start', function () {
    gameRunning = true;
    helpTextTag.innerHTML = 'Game On!';
  });
};

//removes given player from game
var onLeft = function onLeft(sock) {
  var socket = sock;

  socket.on('left', function (data) {
    delete players[data.playerPos];
  });
};
/* ------------------------------- on ------------------- */

//sets up initial app state
var init = function init() {
  var canvas = document.querySelector('canvas');
  canvas.width = 510;
  canvas.height = 510;
  mazeCanvas.width = 510;
  mazeCanvas.height = 510;
  canvas.style.border = '1px solid blue';

  helpTextTag = document.querySelector('#helpText');

  var socket = io.connect();

  var lobbyUl = document.querySelector('#lobby ul');
  var lobbyButton = document.querySelector('#lobbyButton');
  var createButton = document.querySelector('#createRoomButton');
  var readyButton = document.querySelector('#ready');
  var leaveButton = document.querySelector('#leave');
  var resetButton = document.querySelector('#again');

  var nameText = document.querySelector('#roomName');

  for (var i = 0; i < sections.length; i++) {
    sections[i] = document.querySelector('#' + sections[i]);
  }

  resetButton.addEventListener('click', function (e) {
    if (gameRunning) {
      return;
    }
    socket.emit('reset', {});
    resetGame();
  });

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
    helpTextTag.innerHTML = "Waiting for other players";
    return false;
  });

  createButton.addEventListener('click', function (e) {
    e.preventDefault(true);
    if (nameText.value === '') {
      return false;
    }

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
    onLobby(socket, lobbyUl);
    onUpdateLobby(socket, lobbyUl);
    onJoin(socket);
    onLoad(socket, canvas);
    onFull(socket);
    onStart(socket);
    onReset(socket);
    onErr(socket);
    onInit(socket);
    onMove(socket);
    onLeft(socket);
    onWin(socket);
    onLose(socket);
  });

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;
