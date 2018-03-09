const players = {};


// +++++++ Key handlers deal with setting player direction when game is running
const keyDownHandler = (e) => {
  if (!maze) {
    return;
  }
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
  if (!maze) {
    return;
  }
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
// -------


// sets up initial app state
const init = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = 500;
  canvas.height = 500;
  canvas.style.border = '1px solid blue';

  const socket = io.connect();


  socket.on('connect', () => {
    
  });


  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;
