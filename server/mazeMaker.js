
const INVERTED = [2, 3, 0, 1];
const INCREMENTED = [1, 2, 3, 0];

const getRandomInt = maxExclusive => Math.floor(Math.random() * maxExclusive);

// gets next maze position
const getPos = (maze, pos, next) => {
  const nextPos = Object.assign({}, pos);

  switch (next) {
    case 0:
      nextPos.x--;
      if (nextPos.x < 0) return null;
      break;
    case 1:
      nextPos.y--;
      if (nextPos.y < 0) return null;
      break;
    case 2:
      nextPos.x++;
      if (nextPos.x >= maze[0].length) return null;
      break;
    default:
      nextPos.y++;
      if (nextPos.y >= maze.length) return null;
      break;
  }

  return nextPos;
};

const initMaze = (height, width) => {
  const arr = [];

  for (let i = 0; i < height; i++) {
    arr[i] = new Array(width);
  }

  return arr;
};


const createMaze = (height, width) => new Promise((resolve) => {
  setInterval(() => {
    const maze = initMaze(height, width);

    const pos = {};
    pos.x = getRandomInt(width);
    pos.y = getRandomInt(height);


    const generate = (cur) => {
      let side = getRandomInt(4);

      let next = {};

      for (let i = 0; i < 4; i++) {
        next = getPos(maze, cur, side);

        if (next === null || maze[next.y][next.x]) {
          side = INCREMENTED[side];
        } else {
          /* eslint no-bitwise: ["error", { "allow": ["|=","<<"] }] */
          maze[cur.y][cur.x] = maze[cur.y][cur.x] || 0;
          maze[next.y][next.x] = maze[next.y][next.x] || 0;
          maze[next.y][next.x] |= (1 << INVERTED[side]);
          maze[cur.y][cur.x] |= (1 << side);
          generate(next);
        }
      }
    };

    generate(pos);

    const centerx = Math.floor(width / 2);
    const centery = Math.floor(height / 2);

    // this is the center
    maze[centery][centerx] = -maze[centery][centerx];

    resolve(maze);
  }, 0);
});


module.exports = {
  createMaze,
};
