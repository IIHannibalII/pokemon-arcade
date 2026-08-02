'use strict';

/* ============================================================
   AstroDuel — canvas renderer.
   Your ship at the bottom, the rival saucer on top, a glowing
   orb between them and big half-transparent scores.
   ============================================================ */

(function (NS) {

  const { W, H, PLAYER_Y, CPU_Y, PADDLE_H, BALL_R } = NS.CONST;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const screenBg = cssVar('--poke-screen');
    const ink = cssVar('--poke-ink');

    function drawPlayer() {
      const p = engine.player;
      const half = p.w / 2;
      const x = p.x - half;
      ctx.fillStyle = '#f4f6fb';
      ctx.fillRect(x, PLAYER_Y, p.w, PADDLE_H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x, PLAYER_Y, p.w, 3);
      ctx.fillStyle = '#ee1515';
      ctx.fillRect(x, PLAYER_Y, 8, PADDLE_H);
      ctx.fillRect(x + p.w - 8, PLAYER_Y, 8, PADDLE_H);
      ctx.fillStyle = '#7fc7ff';
      ctx.fillRect(p.x - 5, PLAYER_Y + 2, 10, PADDLE_H - 4);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, PLAYER_Y + 1, p.w - 2, PADDLE_H - 2);
    }

    function drawCpu() {
      const p = engine.cpu;
      const half = p.w / 2;
      const x = p.x - half;
      // rival saucer: green hull with a dome
      ctx.fillStyle = '#78c850';
      ctx.fillRect(x, CPU_Y, p.w, PADDLE_H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(x, CPU_Y, p.w, 3);
      ctx.fillStyle = '#3f7a45';
      ctx.fillRect(x, CPU_Y, 8, PADDLE_H);
      ctx.fillRect(x + p.w - 8, CPU_Y, 8, PADDLE_H);
      ctx.fillStyle = '#d7f4fa';
      ctx.beginPath();
      ctx.arc(p.x, CPU_Y + 1, 7, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, CPU_Y + 1, p.w - 2, PADDLE_H - 2);
    }

    function draw(now) {
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, W, H);

      // star specks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let i = 0; i < 36; i++) {
        const sx = (i * 97) % W;
        const sy = (i * 71 + i * i * 3) % H;
        if ((i + Math.floor(now / 800)) % 6 === 0) continue;
        ctx.fillRect(sx, sy, 2, 2);
      }

      // center line
      ctx.fillStyle = 'rgba(248, 240, 216, 0.18)';
      for (let x = 6; x < W; x += 24) {
        ctx.fillRect(x, H / 2 - 2, 12, 4);
      }

      // big watermark scores — smooth and soft on the eyes
      ctx.font = '900 72px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(120, 200, 80, 0.22)';
      ctx.fillText(String(engine.scoreCpu), W / 2, H * 0.3);
      ctx.fillStyle = 'rgba(255, 203, 5, 0.22)';
      ctx.fillText(String(engine.scoreYou), W / 2, H * 0.7);

      drawCpu();
      drawPlayer();

      if (engine.ball) {
        const b = engine.ball;
        ctx.fillStyle = 'rgba(255, 203, 5, 0.25)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcb05';
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff6c9';
        ctx.beginPath();
        ctx.arc(b.x - 2, b.y - 2, BALL_R * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (engine.status === 'playing') {
        // serve countdown dot pulse
        const t = Math.floor(now / 200) % 2;
        ctx.fillStyle = t ? 'rgba(255, 203, 5, 0.7)' : 'rgba(255, 203, 5, 0.25)';
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, BALL_R, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return { draw };
  }

  NS.createRenderer = createRenderer;

})(window.AstroDuel);
