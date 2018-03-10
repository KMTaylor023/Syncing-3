const players = {};

let jumpTimer = 0;
let moveLeft = false;
let moveRight = false;
let jump = false;
let grounded = false;
let hash = 0;

// +++++++ Key handlers deal with setting player direction when game is running
const keyDownHandler = (e) => {
  const keyPressed = e.which;
  if (keyPressed === 65 || keyPressed === 37) {
    moveLeft = true;
  } else if (keyPressed === 68 || keyPressed === 39) {
    moveRight = true;
  } else if (keyPressed === 32){
    jump = true;
  }
  
  if (moveLeft || moveRight || jump) {
    e.preventDefault(true);
  }
};

const keyUpHandler = (e) => {
  const keyPressed = e.which;
   if (keyPressed === 65 || keyPressed === 37) {
    moveLeft = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    moveRight = false;
  } else if (keyPressed === 32){
    jump = false;
  }
};
// -------

const addPlayer = (char) => {
  const player = char;
  
  player.frame = 0;
  player.frameCount = 0;
  player.alpha = 0.05;
  
  if(players[player.hash]){
    player.frame = players[player.hash].frame;
    player.frameCount = players[player.hash].frameCount;
  }
  players[player.hash] = player;
  
};

const onJoin = (sock, canvas, walkImage) => {
  const socket = sock;
  
  socket.on('join', (data) => {
    hash = data.hash;
    addPlayer(data);
    
    requestAnimationFrame((t) => redraw(t, canvas.getContext('2d'), socket, walkImage));
  })
};

const onLeft = (sock) => {
  const socket = sock;
  
  socket.on('left', (data) => {
    delete players[data.hash];
  });
};

const onMove = (sock) => {
  const socket = sock;
  
  socket.on('move', (data) => {
    if(!players[data.hash]) {
      addPlayer(data);
      return;
    }
  
    if(players[data.hash].lastUpdate >= data.lastUpdate) {
      return;
    }
    
    addPlayer(data);
  });
};

const onGrav = (sock) => {
  const socket = sock;
  
  socket.on('grav', (data) =>{
    if(!players[data.hash]) {
      addPlayer(data);
      return;
    }
    
    const player = players[data.hash];
    
    if(player.lastUpdate >= data.lastUpdate){
      return;
    }
    
    player.destY = data.destY;
    player.airborne = data.airborne;
  });
  
}

// sets up initial app state
const init = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = 500;
  canvas.height = 500;
  canvas.style.border = '1px solid blue';

  const walkImage = document.querySelector('#walk');
  const socket = io.connect();

  socket.on('connect', () => {
    onJoin(socket, canvas, walkImage);
    onLeft(socket);
    onMove(socket);
    onGrav(socket);
  });


  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;
