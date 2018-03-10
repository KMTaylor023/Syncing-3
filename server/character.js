class Character {
  constructor(hash) {
    this.hash = hash;
    this.lastUpdate = new Date().getTime();
    this.x = 0;
    this.y = 0;
    this.px = 0;
    this.py = 0;
    this.vy = 0;
    this.destX = 0;
    this.destY = 0;
    this.direction = 0;
    this.moveLeft = false;
    this.moveRight = false;
    this.airborne = true;
  }
}

module.exports = Character;
