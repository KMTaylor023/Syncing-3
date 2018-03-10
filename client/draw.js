const spriteSizes = {
  WIDTH: 61,
  HEIGHT: 121
};

const directions = {
  DOWNLEFT: 0,
  DOWN: 1,
  DOWNRIGHT: 2, 
  LEFT: 3,
  UPLEFT: 4,
  RIGHT: 5, 
  UPRIGHT: 6,
  UP: 7
};

const lerp = (v0, v1, alpha) => {
  return (1 - alpha) * v0 + alpha * v1;
};

const updatePosition = (sock) => {
  const socket = sock;
  const player = players[hash];

  player.moveLeft = moveLeft;
  player.moveRight = moveRight;
  player.px = player.x;
  player.py = player.y;
  if(player.moveLeft && player.destX > 2) {
    player.destX -= 2;
  }
  if(player.moveRight && player.destX < 437) {
    player.destX += 2;
  }
  if(jump && !player.airborne && grounded){
    player.airborne = true;
    grounded = false;
    socket.emit('jump', {});
  }
  
  

  if(player.airborne && player.vy < 0 && player.moveLeft) player.direction = directions.UPLEFT;

  if(player.airborne && player.vy < 0 && player.moveRight) player.direction = directions.UPRIGHT;

  if(player.airborne && player.vy > 0 && player.moveLeft) player.direction = directions.DOWNLEFT;

  if(player.airborne && player.vy > 0 && player.moveRight) player.direction = directions.DOWNRIGHT;

  if(player.airborne && player.vy > 0 && !(player.moveRight || player.moveLeft)) player.direction = directions.DOWN;

  if(player.airborne && player.vy < 0 && !(player.moveRight || player.moveLeft)) player.direction = directions.UP;

  if(player.moveLeft && !player.airborne) player.direction = directions.LEFT;

  if(player.moveRight && !player.airborne) player.direction = directions.RIGHT;

  player.alpha = 0.05;
  
  socket.emit('move', player);
};

const redraw = (time, ctx, socket, walkImage) => {
  updatePosition(socket);
  ctx.clearRect(0, 0, 500, 500);

  const keys = Object.keys(players);

  for(let i = 0; i < keys.length; i++) {

    const player = players[keys[i]];

    //if alpha less than 1, increase it by 0.01
    if(player.alpha < 1) player.alpha += 0.05;

    if(player.hash === hash) {
      ctx.filter = "none"
    }
    else {
      ctx.filter = "hue-rotate(40deg)";
    }

    player.x = lerp(player.px, player.destX, player.alpha);
    
    grounded = true;
    if(player.airborne){
      grounded = false;
      player.y = lerp(player.py, player.destY, player.alpha);
    }
    
    if(player.y > 379){
      player.y = 379;
      player.airborne = false;
    }
    

    // if we are mid animation or moving in any direction
    if(!player.airborne && (player.frame > 0 || player.moveRight || player.moveLeft)) {
      player.frameCount++;

      if(player.frameCount % 8 === 0) {
        if(player.frame < 7) {
          player.frame++;
        } else {
          player.frame = 0;
        }
      }
    }

    ctx.drawImage(
      walkImage, 
      spriteSizes.WIDTH * player.frame,
      spriteSizes.HEIGHT * player.direction,
      spriteSizes.WIDTH, 
      spriteSizes.HEIGHT,
      player.x, 
      player.y, 
      spriteSizes.WIDTH, 
      spriteSizes.HEIGHT
    );
    
    ctx.strokeRect(player.x, player.y, spriteSizes.WIDTH, spriteSizes.HEIGHT);
  }
  
  requestAnimationFrame((t) => redraw(t,ctx,socket, walkImage));
}