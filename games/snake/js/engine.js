'use strict';

/* ============================================================
   PokéSnake — game engine.
   Pure game logic: no DOM, no canvas. A wild snake catches
   Poké Balls and grows; every few catches a bonus Great Ball
   appears for a short time.
   ============================================================ */

window.PokeSnake = window.PokeSnake || {};

(function (NS) {

  const COLS = 17;
  const ROWS = 17;

  const BASE_MS = 150;  // movement interval at level 1
  const STEP_MS = 9;    // speed-up per level
  const MIN_MS = 60;

  const CATCHES_PER_LEVEL = 5;
  const BONUS_EVERY = 5;      // every Nth catch spawns a bonus ball
  const BONUS_TTL_MS = 6000;
  const BONUS_SCORE = 50;

  class Engine {
    /**
     * hooks: onCatch(isBonus), onLevelUp(level), onGameOver(),
     *        onBonusSpawn(), onBonusExpire()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.reset();
    }

    reset() {
      const cy = Math.floor(ROWS / 2);
      this.snake = [[8, cy], [7, cy], [6, cy]]; // head first, heading right
      this.dir = [1, 0];
      this.pending = [];
      this.food = null;
      this.bonus = null;
      this.score = 0;
      this.catches = 0;
      this.level = 1;
      this.status = 'ready'; // ready | playing | paused | over
      this.timer = 0;
      this.spawnFood();
    }

    start() {
      if (this.status === 'ready' || this.status === 'over') {
        this.reset();
        this.status = 'playing';
      }
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    /* Queue a direction change; reversing into yourself is ignored. */
    setDir(dx, dy) {
      if (this.status !== 'playing') return;
      const last = this.pending.length
        ? this.pending[this.pending.length - 1]
        : this.dir;
      if (dx === -last[0] && dy === -last[1]) return;
      if (dx === last[0] && dy === last[1]) return;
      if (this.pending.length < 2) this.pending.push([dx, dy]);
    }

    freeCells() {
      const taken = new Set(this.snake.map(([x, y]) => x + ',' + y));
      if (this.food) taken.add(this.food.x + ',' + this.food.y);
      if (this.bonus) taken.add(this.bonus.x + ',' + this.bonus.y);
      const free = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!taken.has(x + ',' + y)) free.push([x, y]);
        }
      }
      return free;
    }

    spawnFood() {
      const free = this.freeCells();
      if (free.length === 0) {
        this.food = null;
        return;
      }
      const [x, y] = free[Math.floor(Math.random() * free.length)];
      this.food = { x, y };
    }

    spawnBonus() {
      const free = this.freeCells();
      if (free.length === 0) return;
      const [x, y] = free[Math.floor(Math.random() * free.length)];
      this.bonus = { x, y, ttl: BONUS_TTL_MS };
      if (this.hooks.onBonusSpawn) this.hooks.onBonusSpawn();
    }

    interval() {
      return Math.max(MIN_MS, BASE_MS - (this.level - 1) * STEP_MS);
    }

    die() {
      this.status = 'over';
      if (this.hooks.onGameOver) this.hooks.onGameOver();
    }

    step() {
      if (this.pending.length) this.dir = this.pending.shift();
      const [hx, hy] = this.snake[0];
      const nx = hx + this.dir[0];
      const ny = hy + this.dir[1];

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return this.die();

      const ateFood = this.food && nx === this.food.x && ny === this.food.y;
      const ateBonus = this.bonus && nx === this.bonus.x && ny === this.bonus.y;
      const growing = ateFood || ateBonus;

      // the tail cell frees up this step unless the snake grows
      const body = growing ? this.snake : this.snake.slice(0, -1);
      if (body.some(([sx, sy]) => sx === nx && sy === ny)) return this.die();

      this.snake.unshift([nx, ny]);
      if (!growing) this.snake.pop();

      if (ateFood) {
        this.catches++;
        this.score += 10 * this.level;
        const newLevel = 1 + Math.floor(this.catches / CATCHES_PER_LEVEL);
        if (newLevel > this.level) {
          this.level = newLevel;
          if (this.hooks.onLevelUp) this.hooks.onLevelUp(newLevel);
        }
        if (this.catches % BONUS_EVERY === 0) this.spawnBonus();
        this.spawnFood();
        if (this.hooks.onCatch) this.hooks.onCatch(false);
      }
      if (ateBonus) {
        this.score += BONUS_SCORE;
        this.bonus = null;
        if (this.hooks.onCatch) this.hooks.onCatch(true);
      }
    }

    update(dt) {
      if (this.status !== 'playing') return;

      if (this.bonus) {
        this.bonus.ttl -= dt;
        if (this.bonus.ttl <= 0) {
          this.bonus = null;
          if (this.hooks.onBonusExpire) this.hooks.onBonusExpire();
        }
      }

      this.timer += dt;
      const iv = this.interval();
      while (this.timer >= iv) {
        this.timer -= iv;
        this.step();
        if (this.status !== 'playing') break;
      }
    }
  }

  NS.CONST = { COLS, ROWS, BONUS_TTL_MS };
  NS.Engine = Engine;

})(window.PokeSnake);
