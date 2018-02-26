/* eslint-env browser */
/* global io */
/* eslint no-bitwise: ["error", { "allow": ["|=",">>","&"] }] */
// previous comments are to set up eslint for browser use
// I wanted to eslint the browser code for my own sanity
// also i *needed* bitwise


const players = [];

const MOVE_FRAME_WAIT = 20;
const P_SIZE = 20;
const MAZE_SQUARE_SIZE = 30;
const MAZE_PAD = (MAZE_SQUARE_SIZE - P_SIZE) / 2;


const LOBBY = 0;
const GAME = 1;
const LOADING = 2;
const ERR = 3;

const sections = ['lobby', 'game', 'loading', 'err'];

const LEFT = 0;
const UP = 1;
const RIGHT = 2;
const DOWN = 3;

const mazeCanvas = document.createElement('canvas');
const mazeCtx = mazeCanvas.getContext('2d');

// left,  up,    right,  down
const move = [false, false, false, false];

let playerNum = -1;

let maze;

let moveFrames = MOVE_FRAME_WAIT;

let helpTextTag;

let ready = false;
let tryWin = false;
let gameRunning = false;
// const ready = false;

const resetVars = () => {
  gameRunning = false;
  ready = false;
  tryWin = false;
  maze = {};
  moveFrames = MOVE_FRAME_WAIT;
  playerNum = -1;
};

const onLose = (sock) => {
  const socket = sock;

  socket.on('lose', (data) => {
    helpTextTag.innerHTML = `YOU LOST TO PLAYER ${data.winner + 1}!! :c`;
    helpTextTag.style.color = 'red';
    gameRunning = false;
    tryWin = true;
  });
};

const onWin = (sock) => {
  const socket = sock;

  socket.on('win', () => {
    helpTextTag.innerHTML = 'YOU WON!!';
    helpTextTag.style.color = 'blue';
    gameRunning = false;
  });
};

const updatePlayer = (number, data) => {
  if (!players[number]) {
    players[number] = {};
  }
  const player = players[number];


  // TODO could lerp here
  player.x = data.x;
  player.y = data.y;
};

const onMove = (sock) => {
  const socket = sock;
  socket.on('move', (data) => {
    if (gameRunning) { updatePlayer(data.playerPos, data); }
  });
};

const addPlayer = (number) => {
  players[number] = {
    x: 0,
    y: 0,
    width: P_SIZE,
    height: P_SIZE,
  };


  // sets up corners
  if (number > 1) {
    players[number].y = maze.length - 1;
  }
  if (number === 0 || number === 2) {
    players[number].x = maze[0].length - 1;
  }
};

// Updates position, returns true if player is now in win spot
const updatePosition = (sock) => {
  if (tryWin || !gameRunning) {
    return false;
  }
  const socket = sock;
  const me = players[playerNum];
  const mazePos = maze[me.y][me.x];


  if (moveFrames === MOVE_FRAME_WAIT) {
    let moved = false;
    // loops through all possible directions to move
    // exits loop if one direction is true
    // order is defined by the UP, DOWN, LEFT, RIGHT globals
    for (let i = 0; i < 4; i++) {
      if (move[i]) {
        moved = true;
        // shifts bit over by i, then ands bits with 1
        // checks if the bit for this direction is set to 1
        // bit meaning 1:L 2:U 4:R 8:D
        if (((mazePos >> i) & 1) === 1) {
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

const drawPlayer = (playnum, ctx, color) => {
  const player = players[playnum];
  if (!player) {
    return;
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(
    (player.x * MAZE_SQUARE_SIZE) + (MAZE_PAD),
    (player.y * MAZE_SQUARE_SIZE) + (MAZE_PAD),
    P_SIZE,
    P_SIZE,
  );
  ctx.restore();
};


// draws the maze to the mazeCtx
const drawMaze = () => {
  mazeCtx.fillStyle = 'black';
  mazeCtx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
  mazeCtx.fillStyle = 'white';


  let yPos = 0;

  for (let y = 0; y < maze.length; y++) {
    let xPos = 0;
    for (let x = 0; x < maze[y].length; x++) {
      let mazePos = maze[y][x];
      if (mazePos < 0) {
        mazeCtx.fillStyle = 'green';
        mazePos = -mazePos;
      }
      mazeCtx.fillRect(xPos + MAZE_PAD, yPos + MAZE_PAD, P_SIZE, P_SIZE);


      for (let i = 0; i < 4; i++) {
        // shifts bit over by i, then ands bits with 1
        // checks if the bit for this direction is set to 1
        // if so, draws a rect in that direction for the maze
        // bit meaning 1:L 2:U 4:R 8:D
        if (((mazePos >> i) & 1) === 1) {
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

const redraw = (time, socket, canvas, ctx) => {
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

  for (let i = 0; i < players.length; i++) {
    if (i !== playerNum) {
      drawPlayer(i, ctx, 'red');
    }
  }
  // draw us on top
  drawPlayer(playerNum, ctx, 'blue');


  requestAnimationFrame(t => redraw(t, socket, canvas, ctx));
};

const setVisible = (visible) => {
  for (let i = 0; i < sections.length; i++) {
    if (i === visible) {
      sections[i].style.display = 'block';
    } else {
      sections[i].style.display = 'none';
    }
  }
};

const onLoad = (sock, canvas) => {
  const socket = sock;

  socket.on('load', (data) => {
    ({ maze } = data);
    drawMaze();

    setVisible(GAME);

    requestAnimationFrame(time => redraw(time, socket, canvas, canvas.getContext('2d')));
  });
};

const onJoin = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    if (playerNum > -1) {
      return;
    }

    setVisible(LOADING);

    playerNum = data.player;


    addPlayer(playerNum);


    // TODO add ready button
  });
};

const onFull = (sock) => {
  const socket = sock;

  socket.on('full', () => {
    // TODO something about how you didn't join, idk, not important right now
  });
};

const onErr = (sock) => {
  const socket = sock;

  socket.on('err', (data) => {
    const m = data.msg;

    resetVars();
    setVisible(ERR);
    document.querySelector('errMsg').innerHTML = m;
  });
};

const onLobby = (sock, select) => {
  const socket = sock;

  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  socket.on('lobby', (data) => {
    setVisible(LOBBY);
    console.dir(data);

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      if (data[keys[i]].roomCount >= 4) {
        return;// TODO SHOW THESE AS FULL LATERE
      }
      const opt = document.createElement('option');

      opt.setAttribute('value', keys[i]);
      opt.innerHTML = `${keys[i]} : ${data[keys[i]].roomCount}`;
      select.appendChild(opt);
    }
  });
};


const keyDownHandler = (e) => {
  const keyPressed = e.which;
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
    e.preventDefault();
  }
};

const keyUpHandler = (e) => {
  const keyPressed = e.which;
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

const onStart = (sock) => {
  const socket = sock;

  socket.on('start', () => {
    gameRunning = true;
  });
};


const init = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = 520;
  canvas.height = 520;
  mazeCanvas.width = 520;
  mazeCanvas.height = 520;
  canvas.style.border = '1px solid blue';

  helpTextTag = document.querySelector('#helpText');

  const socket = io.connect();

  const select = document.querySelector('select');
  const lobbyButton = document.querySelector('#lobbyButton');
  const createButton = document.querySelector('#createRoomButton');
  const readyButton = document.querySelector('#ready');
  const leaveButton = document.querySelector('#leave');

  const nameText = document.querySelector('#roomName');

  for (let i = 0; i < sections.length; i++) {
    sections[i] = document.querySelector(`#${sections[i]}`);
  }

  leaveButton.addEventListener('click', (e) => {
    socket.emit('leave', {});
    setVisible(LOADING);
    resetVars();

    e.preventDefault(true);
    return false;
  });

  readyButton.addEventListener('click', (e) => {
    if (ready) {
      return false;
    }
    socket.emit('ready', {});
    ready = true;

    e.preventDefault(true);
    return false;
  });

  createButton.addEventListener('click', (e) => {
    if (nameText.value === '') {
      return false;
    }

    console.log(nameText.value);
    socket.emit('create', { room: nameText.value });
    setVisible(LOADING);
    nameText.value = '';

    e.preventDefault(true);
    return false;
  });

  lobbyButton.addEventListener('click', (e) => {
    setVisible(LOADING);
    socket.emit('lobby', {});

    e.preventDefault(true);
    return false;
  });

  select.onchange = (e) => {
    const val = e.target.value;

    if (!val || val === '') {
      return;
    }

    socket.emit('joinRoom', { room: val });
    setVisible(LOADING);
  };

  socket.on('connect', () => {
    onLobby(socket, select);
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
