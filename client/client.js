/* eslint-env browser */
/* global io */
/* eslint no-bitwise: ["error", { "allow": ["|=",">>","&"] }] */
// previous comments are to set up eslint for browser use
// I wanted to eslint the browser code for my own sanity
// also i *needed* bitwise


const players = {};

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

const gamelist = {};

// left,  up,    right,  down
const move = [false, false, false, false];

let playerNum = -1;

let maze;

let moveFrames = MOVE_FRAME_WAIT;

let helpTextTag;

let ready = false;
let tryWin = false;
let gameRunning = false;

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
    e.preventDefault(true);
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


const updatePlayer = (number, data) => {
  if (!players[number]) {
    players[number] = {};
  }
  const player = players[number];


  // TODO could lerp here
  player.x = data.x;
  player.y = data.y;
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

const resetGame = () => {
  const playKeys = Object.keys(players);
  
  for(let i = 0; i < playKeys.length; i++) {
    addPlayer(playKeys[i]);
  }
  
  gameRunning = false;
  ready = false;
  tryWin = false;
  moveFrames = MOVE_FRAME_WAIT;
}

const exitGame = () =>{
  const playKeys = Object.keys(players);
  
  for(let i = 0; i < playKeys.length; i++) {
    delete players[playKeys[i]];
  }
  
  resetGame();
  
  maze = {};
  playerNum = -1;
}

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


const roomclick = (e)=> {
    
    e.preventDefault(true);
    if(e.target.className === 'full'){
      return false;
    }
    
    const room = e.target.getAttribute('room');
    
    setVisible(LOADING);
    socket.emit('joinRoom', { room });
    
    return false;
}


const setupLobby = (ul) => {
  
  const keys = Object.keys(gamelist);
  
  for(let i = 0; i < keys.length; i++) {
    
    if(gamelist[i].element){
      continue;
    }
    
    const li = document.createElement('li');
    const a = document.createElement('a');
    
    if (data[keys[i]].roomCount >= 4) {
      a.className = 'full'
    }
    else{
      a.className = 'open'
    }

    a.setAttribute('href',`#${keys[i]}`);
    a.setAttribute('room',keys[i]);
    a.onclick = roomclick;
    a.innerHTML = `${keys[i]} : ${gamelist[keys[i]].roomCount}/4`;
    li.appendChild(a);
    ul.appendChild(li);
    gamelist[i].element = li;
  }
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

const makeErr = (msg) => {
  setVisible(ERR);
  document.querySelector('errMsg').innerHTML = m;
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

  const playKeys = Object.keys(players);
  for (let i = 0; i < playKeys.length; i++) {
    if (playKeys[i] !== playerNum) {
      drawPlayer(playKeys[i], ctx, 'red');
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

/* +++++++++++++++++++++++++++++++ on +++++++++++++++++++ */

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

const onMove = (sock) => {
  const socket = sock;
  socket.on('move', (data) => {
    if (gameRunning) { updatePlayer(data.playerPos, data); }
  });
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
    
    document.querySelector('#roomp').innerHTML = `Room: ${data.room}`;

    addPlayer(playerNum);
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
    exitGame()
    makeErr(data.msg);
  });
};

const onLobbyUpdate = (sock, ul) => {
  const socket = sock;
  
  socket.on('updateLobby', (data) => {
    const {room} = data;
    const count = data.roomCount;
    
    if(count === 0 && gamelist[room]) {
      ul.removeChild(gamelist[room].element)
      delete gamelist[room];
    }
    else if (!gamelist[room]){
      gamelist[room].roomCount = count;
      setupLobby(ul);
    }
    else{
      gamelist[room].roomCount = count;
      gamelist[room].element.innerHTML = `${room} : ${count}/4`;
      if(count === 4){
        gamelist[room].element.className = 'full'
      }
      else{
        gamelist[room].element.className = 'open'
      }
    }
  });
}

const onLobby = (sock, ul) => {
  const socket = sock;

  socket.on('lobby', (data) => {
    setVisible(LOBBY);
    
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      gamelist[keys[i]] = data[keys[i]];
    }
    
    setupLobby(ul);
    
  });
};

const onStart = (sock) => {
  const socket = sock;

  socket.on('start', () => {
    gameRunning = true;
  });
};

/* ------------------------------- on ------------------- */


const init = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = 520;
  canvas.height = 520;
  mazeCanvas.width = 520;
  mazeCanvas.height = 520;
  canvas.style.border = '1px solid blue';

  helpTextTag = document.querySelector('#helpText');

  const socket = io.connect();

  const lobby = document.querySelector('#lobby');
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
    setVisible(LOBBY);
    exitGame();

    e.preventDefault(true);
    return false;
  });

  readyButton.addEventListener('click', (e) => {
    e.preventDefault(true);
    
    if (ready) {
      return false;
    }
    
    socket.emit('ready', {});
    ready = true;

    return false;
  });

  createButton.addEventListener('click', (e) => {
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

  lobbyButton.addEventListener('click', (e) => {
    setVisible(LOBBY);

    e.preventDefault(true);
    return false;
  });

  socket.on('connect', () => {
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
