'use strict';

/* ============================================================
   AstroBreaker — game engine.
   Pure game logic: no DOM, no canvas. A ship deflects an energy
   orb into waves of space blocks; broken blocks may drop power
   capsules (wide ship, slow orb, multiball, extra ship).
   ============================================================ */

window.AstroBreaker = window.AstroBreaker || {};

(function (NS) {

  const W = 360;
  const H = 520;

  const PADDLE_W = 64;
  const PADDLE_W_WIDE = 100;
  const PADDLE_H = 12;
  const PADDLE_Y = H - 30;
  const PADDLE_SPEED = 380;   // keyboard px/s

  const BALL_R = 6;
  const BASE_SPEED = 250;     // px/s at wave 1
  const SPEED_PER_HIT = 1.02; // speed-up on every paddle hit
  const MAX_SPEED = 470;
  const SLOW_FACTOR = 0.65;

  const COLS = 9;
  const BRICK_W = 36;
  const BRICK_H = 18;
  const BRICK_GAP = 2;
  const FIELD_PAD = (W - (COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
  const BRICK_TOP = 64;

  const LIVES = 3;
  const DROP_CHANCE = 0.14;
  const CAPSULE_SPEED = 110;
  const WIDE_MS = 12000;
  const SLOW_MS = 9000;

  const POWERUPS = ['wide', 'slow', 'multi', 'life'];

  /* Row colors cycle through the cosmic elements. */
  const ROW_TYPES = ['plasma', 'rocket', 'star', 'ufo', 'comet', 'planet'];

  class Engine {
    /**
     * hooks: onBrick(destroyed, type), onPaddleHit, onPowerup(kind),
     *        onLifeLost(), onLevelUp(level), onGameOver(), onLaunch()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.reset();
    }

    reset() {
      this.score = 0;
      this.level = 1;
      this.lives = LIVES;
      this.status = 'ready'; // ready | playing | paused | over
      this.paddle = { x: W / 2, w: PADDLE_W };
      this.keys = 0;         // -1 left, 1 right, 0 idle (keyboard)
      this.balls = [];
      this.capsules = [];
      this.wideUntil = 0;
      this.slowUntil = 0;
      this.clock = 0;        // engine-internal ms, drives effect timers
      this.buildWave();
      this.spawnStuckBall();
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

    /* ---------- Waves ---------- */

    buildWave() {
      this.bricks = [];
      const rows = Math.min(3 + this.level, 6);
      const variant = this.level % 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          if (variant === 1 && (r + c) % 2 === 1) continue;       // checkerboard
          if (variant === 2 && (c < r - 1 || c > COLS - r)) continue; // pyramid
          const hp = this.level >= 2 && r < 2 ? 2 : 1;
          this.bricks.push({
            x: FIELD_PAD + c * (BRICK_W + BRICK_GAP),
            y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
            w: BRICK_W,
            h: BRICK_H,
            hp,
            type: ROW_TYPES[r % ROW_TYPES.length],
          });
        }
      }
    }

    /* ---------- Balls ---------- */

    baseSpeed() {
      return Math.min(BASE_SPEED * Math.pow(1.08, this.level - 1), MAX_SPEED);
    }

    spawnStuckBall() {
      this.balls = [{
        x: this.paddle.x,
        y: PADDLE_Y - BALL_R - 1,
        vx: 0,
        vy: 0,
        speed: this.baseSpeed(),
        stuck: true,
      }];
    }

    launch() {
      if (this.status !== 'playing') return;
      const ball = this.balls.find((b) => b.stuck);
      if (!ball) return;
      ball.stuck = false;
      const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2; // mostly up
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      if (this.hooks.onLaunch) this.hooks.onLaunch();
    }

    /* ---------- Paddle ---------- */

    setPaddleX(x) {
      if (this.status !== 'playing') return;
      const half = this.paddle.w / 2;
      this.paddle.x = Math.max(half, Math.min(W - half, x));
      const stuck = this.balls.find((b) => b.stuck);
      if (stuck) stuck.x = this.paddle.x;
    }

    setKeys(dir) {
      this.keys = dir;
    }

    /* ---------- Power-ups ---------- */

    applyPowerup(kind) {
      if (kind === 'wide') {
        this.paddle.w = PADDLE_W_WIDE;
        this.wideUntil = this.clock + WIDE_MS;
      } else if (kind === 'slow') {
        this.slowUntil = this.clock + SLOW_MS;
      } else if (kind === 'multi') {
        const src = this.balls.find((b) => !b.stuck) || this.balls[0];
        for (const spread of [-0.5, 0.5]) {
          const a = Math.atan2(src.vy || -1, src.vx || 0.1) + spread;
          this.balls.push({
            x: src.x, y: src.y,
            vx: Math.cos(a) * src.speed,
            vy: Math.sin(a) * src.speed,
            speed: src.speed,
            stuck: false,
          });
        }
      } else if (kind === 'life') {
        this.lives++;
      }
      this.score += 25;
      if (this.hooks.onPowerup) this.hooks.onPowerup(kind);
    }

    /* ---------- Simulation ---------- */

    update(dt) {
      if (this.status !== 'playing') return;
      // substep so a lag spike can't tunnel the ball through bricks
      let rest = dt;
      while (rest > 0) {
        const step = Math.min(rest, 16);
        this.tick(step);
        rest -= step;
        if (this.status !== 'playing') break;
      }
    }

    tick(dt) {
      this.clock += dt;
      const s = dt / 1000;

      // effect expiry
      if (this.wideUntil && this.clock > this.wideUntil) {
        this.wideUntil = 0;
        this.paddle.w = PADDLE_W;
      }
      if (this.slowUntil && this.clock > this.slowUntil) this.slowUntil = 0;

      // keyboard paddle движение
      if (this.keys !== 0) {
        this.setPaddleX(this.paddle.x + this.keys * PADDLE_SPEED * s);
      }

      // capsules fall
      for (const cap of this.capsules) cap.y += CAPSULE_SPEED * s;
      this.capsules = this.capsules.filter((cap) => {
        if (cap.y > H + 10) return false;
        const half = this.paddle.w / 2;
        if (cap.y + 7 >= PADDLE_Y && cap.y - 7 <= PADDLE_Y + PADDLE_H &&
            cap.x >= this.paddle.x - half - 7 && cap.x <= this.paddle.x + half + 7) {
          this.applyPowerup(cap.kind);
          return false;
        }
        return true;
      });

      const slow = this.slowUntil ? SLOW_FACTOR : 1;

      for (const ball of this.balls) {
        if (ball.stuck) {
          ball.x = this.paddle.x;
          ball.y = PADDLE_Y - BALL_R - 1;
          continue;
        }
        ball.x += ball.vx * s * slow;
        ball.y += ball.vy * s * slow;

        // walls
        if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

        // paddle
        const half = this.paddle.w / 2;
        if (ball.vy > 0 &&
            ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
            ball.x >= this.paddle.x - half - BALL_R && ball.x <= this.paddle.x + half + BALL_R) {
          const offset = Math.max(-1, Math.min(1, (ball.x - this.paddle.x) / half));
          const angle = offset * (Math.PI / 3) - Math.PI / 2; // up to 60° from vertical
          ball.speed = Math.min(ball.speed * SPEED_PER_HIT, MAX_SPEED);
          ball.vx = Math.cos(angle) * ball.speed;
          ball.vy = Math.sin(angle) * ball.speed;
          ball.y = PADDLE_Y - BALL_R - 0.5;
          if (this.hooks.onPaddleHit) this.hooks.onPaddleHit();
        }

        // bricks
        for (const brick of this.bricks) {
          if (brick.hp <= 0) continue;
          const nx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
          const ny = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
          const dx = ball.x - nx;
          const dy = ball.y - ny;
          if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

          // bounce axis: the smaller penetration wins
          if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          } else {
            ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
          }

          brick.hp--;
          const destroyed = brick.hp <= 0;
          this.score += destroyed ? 10 * this.level : 5;
          if (destroyed && Math.random() < DROP_CHANCE) {
            this.capsules.push({
              x: brick.x + brick.w / 2,
              y: brick.y + brick.h / 2,
              kind: POWERUPS[Math.floor(Math.random() * POWERUPS.length)],
            });
          }
          if (this.hooks.onBrick) this.hooks.onBrick(destroyed, brick.type);
          break; // one brick per tick per ball
        }
      }

      // balls below the floor die
      const before = this.balls.length;
      this.balls = this.balls.filter((b) => b.y - BALL_R < H + 20);
      if (this.balls.length === 0 && before > 0) this.loseLife();

      // wave cleared?
      if (this.status === 'playing' && this.bricks.every((b) => b.hp <= 0)) {
        this.level++;
        this.wideUntil = 0;
        this.slowUntil = 0;
        this.paddle.w = PADDLE_W;
        this.capsules = [];
        this.buildWave();
        this.spawnStuckBall();
        if (this.hooks.onLevelUp) this.hooks.onLevelUp(this.level);
      }
    }

    loseLife() {
      this.lives--;
      this.wideUntil = 0;
      this.slowUntil = 0;
      this.paddle.w = PADDLE_W;
      this.capsules = [];
      if (this.lives <= 0) {
        this.status = 'over';
        if (this.hooks.onGameOver) this.hooks.onGameOver();
        return;
      }
      this.spawnStuckBall();
      if (this.hooks.onLifeLost) this.hooks.onLifeLost();
    }
  }

  NS.CONST = { W, H, PADDLE_Y, PADDLE_H, BALL_R };
  NS.Engine = Engine;

})(window.AstroBreaker);
