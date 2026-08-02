'use strict';

/* ============================================================
   AstroDuel — game engine.
   Vertical paddle duel against the ship computer: your ship at
   the bottom, the saucer on top. First to 7 points wins the
   match. Pure logic: no DOM, no canvas.
   ============================================================ */

window.AstroDuel = window.AstroDuel || {};

(function (NS) {

  const W = 360;
  const H = 520;

  const PADDLE_W = 64;
  const PADDLE_H = 12;
  const PLAYER_Y = H - 30;
  const CPU_Y = 18;
  const PADDLE_SPEED = 380; // keyboard px/s

  const BALL_R = 6;
  const BASE_SPEED = 240;
  const SPEED_PER_HIT = 1.03;
  const MAX_SPEED = 520;

  const WIN_SCORE = 7;
  const SERVE_DELAY_MS = 900;

  class Engine {
    /**
     * hooks: onPaddleHit(byPlayer), onWall(), onGoal(byPlayer),
     *        onMatchEnd(playerWon), onServe()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.reset();
    }

    reset() {
      this.status = 'ready'; // ready | playing | paused | over
      this.player = { x: W / 2, w: PADDLE_W };
      this.cpu = { x: W / 2, w: PADDLE_W };
      this.keys = 0;
      this.scoreYou = 0;
      this.scoreCpu = 0;
      this.playerWon = false;
      this.ball = null;
      this.serveTimer = 0;
      this.serveToPlayer = Math.random() < 0.5;
      this.cpuAimOffset = 0;
      this.rally = 0;
    }

    start() {
      if (this.status === 'ready' || this.status === 'over') {
        this.reset();
        this.status = 'playing';
        this.queueServe();
      }
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    setPaddleX(x) {
      if (this.status !== 'playing') return;
      const half = this.player.w / 2;
      this.player.x = Math.max(half, Math.min(W - half, x));
    }

    setKeys(dir) {
      this.keys = dir;
    }

    queueServe() {
      this.ball = null;
      this.serveTimer = SERVE_DELAY_MS;
      this.rally = 0;
      // the saucer re-rolls its aiming sloppiness every point
      this.cpuAimOffset = (Math.random() * 2 - 1) * this.cpu.w * 0.45;
    }

    serve() {
      const dir = this.serveToPlayer ? 1 : -1; // 1 = toward the player
      const angle = (Math.random() * 0.5 - 0.25) + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.ball = {
        x: W / 2,
        y: H / 2,
        speed: BASE_SPEED,
        vx: Math.cos(angle) * BASE_SPEED,
        vy: Math.sin(angle) * BASE_SPEED,
      };
      if (this.hooks.onServe) this.hooks.onServe();
    }

    bounceOffPaddle(paddle, upward) {
      const b = this.ball;
      const half = paddle.w / 2;
      const offset = Math.max(-1, Math.min(1, (b.x - paddle.x) / half));
      const angle = offset * (Math.PI / 3) + (upward ? -Math.PI / 2 : Math.PI / 2);
      b.speed = Math.min(b.speed * SPEED_PER_HIT, MAX_SPEED);
      b.vx = Math.cos(angle) * b.speed;
      b.vy = Math.sin(angle) * b.speed;
      this.rally++;
    }

    goal(byPlayer) {
      if (byPlayer) this.scoreYou++;
      else this.scoreCpu++;
      this.serveToPlayer = !byPlayer; // loser receives
      if (this.hooks.onGoal) this.hooks.onGoal(byPlayer);
      if (this.scoreYou >= WIN_SCORE || this.scoreCpu >= WIN_SCORE) {
        this.status = 'over';
        this.playerWon = this.scoreYou > this.scoreCpu;
        this.ball = null;
        if (this.hooks.onMatchEnd) this.hooks.onMatchEnd(this.playerWon);
        return;
      }
      this.queueServe();
    }

    /* The saucer chases the ball with limited speed and a sloppy
       aim so it stays beatable; it gets a bit faster when ahead
       on the scoreboard is false — when BEHIND the player. */
    cpuSpeed() {
      const diff = this.scoreYou - this.scoreCpu;
      return 195 + Math.max(0, diff) * 14;
    }

    update(dt) {
      if (this.status !== 'playing') return;
      let rest = dt;
      while (rest > 0) {
        const step = Math.min(rest, 16);
        this.tick(step);
        rest -= step;
        if (this.status !== 'playing') break;
      }
    }

    tick(dt) {
      const s = dt / 1000;

      // keyboard player movement
      if (this.keys !== 0) {
        this.setPaddleX(this.player.x + this.keys * PADDLE_SPEED * s);
      }

      // serving countdown
      if (!this.ball) {
        this.serveTimer -= dt;
        if (this.serveTimer <= 0) this.serve();
        return;
      }

      const b = this.ball;

      // saucer AI: follow the ball when it approaches, else drift home
      const chasing = b.vy < 0;
      const target = chasing ? b.x + this.cpuAimOffset : W / 2;
      const maxMove = this.cpuSpeed() * s;
      const delta = target - this.cpu.x;
      this.cpu.x += Math.abs(delta) <= maxMove ? delta : Math.sign(delta) * maxMove;
      const cHalf = this.cpu.w / 2;
      this.cpu.x = Math.max(cHalf, Math.min(W - cHalf, this.cpu.x));

      b.x += b.vx * s;
      b.y += b.vy * s;

      // side walls
      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx = Math.abs(b.vx);
        if (this.hooks.onWall) this.hooks.onWall();
      }
      if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        b.vx = -Math.abs(b.vx);
        if (this.hooks.onWall) this.hooks.onWall();
      }

      // player paddle (bottom)
      const pHalf = this.player.w / 2;
      if (b.vy > 0 &&
          b.y + BALL_R >= PLAYER_Y && b.y - BALL_R <= PLAYER_Y + PADDLE_H &&
          b.x >= this.player.x - pHalf - BALL_R && b.x <= this.player.x + pHalf + BALL_R) {
        b.y = PLAYER_Y - BALL_R - 0.5;
        this.bounceOffPaddle(this.player, true);
        if (this.hooks.onPaddleHit) this.hooks.onPaddleHit(true);
      }

      // saucer paddle (top)
      const cHalf2 = this.cpu.w / 2;
      if (b.vy < 0 &&
          b.y - BALL_R <= CPU_Y + PADDLE_H && b.y + BALL_R >= CPU_Y &&
          b.x >= this.cpu.x - cHalf2 - BALL_R && b.x <= this.cpu.x + cHalf2 + BALL_R) {
        b.y = CPU_Y + PADDLE_H + BALL_R + 0.5;
        this.bounceOffPaddle(this.cpu, false);
        if (this.hooks.onPaddleHit) this.hooks.onPaddleHit(false);
      }

      // goals
      if (b.y < -BALL_R * 3) this.goal(true);       // past the saucer
      else if (b.y > H + BALL_R * 3) this.goal(false); // past the player
    }
  }

  NS.CONST = { W, H, PLAYER_Y, CPU_Y, PADDLE_H, BALL_R, WIN_SCORE };
  NS.Engine = Engine;

})(window.AstroDuel);
