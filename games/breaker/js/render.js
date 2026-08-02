'use strict';

/* ============================================================
   AstroBreaker — canvas renderer.
   Element-colored blocks with pixel bevels, a small ship as the
   paddle, a glowing energy orb and falling power capsules.
   ============================================================ */

(function (NS) {

  const { W, H, PADDLE_Y, PADDLE_H, BALL_R } = NS.CONST;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => {
      const v = Math.round(((n >> shift) & 0xff) * factor);
      return Math.max(0, Math.min(255, v));
    };
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
  }

  const CAPSULE_STYLE = {
    wide:  { label: 'W', color: '#78c850' },
    slow:  { label: 'S', color: '#98d8d8' },
    multi: { label: 'M', color: '#f85888' },
    life:  { label: '+', color: '#ffcb05' },
  };

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const screenBg = cssVar('--poke-screen');
    const ink = cssVar('--poke-ink');
    const typeColors = {};
    for (const t of ['comet', 'planet', 'rocket', 'star', 'ufo', 'moon', 'plasma']) {
      typeColors[t] = cssVar('--type-' + t);
    }

    function drawBrick(brick) {
      const color = brick.hp >= 2 ? shade(typeColors[brick.type], 0.6) : typeColors[brick.type];
      ctx.fillStyle = color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(brick.x, brick.y, brick.w, 2);
      ctx.fillRect(brick.x, brick.y, 2, brick.h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(brick.x, brick.y + brick.h - 2, brick.w, 2);
      ctx.fillRect(brick.x + brick.w - 2, brick.y, 2, brick.h);
      if (brick.hp >= 2) {
        // rivets mark armored blocks
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(brick.x + 5, brick.y + brick.h / 2 - 1, 2, 2);
        ctx.fillRect(brick.x + brick.w - 7, brick.y + brick.h / 2 - 1, 2, 2);
      }
    }

    function drawPaddle() {
      const p = engine.paddle;
      const half = p.w / 2;
      const x = p.x - half;
      // hull
      ctx.fillStyle = '#f4f6fb';
      ctx.fillRect(x, PADDLE_Y, p.w, PADDLE_H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x, PADDLE_Y, p.w, 3);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(x, PADDLE_Y + PADDLE_H - 3, p.w, 3);
      // wing tips: red, blinking yellow when the wide effect is
      // about to expire
      const wideLeft = engine.wideUntil ? engine.wideUntil - engine.clock : 0;
      const expiring = wideLeft > 0 && wideLeft < 2500 &&
        Math.floor(engine.clock / 150) % 2 === 0;
      ctx.fillStyle = expiring ? '#ffcb05' : '#ee1515';
      ctx.fillRect(x, PADDLE_Y, 8, PADDLE_H);
      ctx.fillRect(x + p.w - 8, PADDLE_Y, 8, PADDLE_H);
      // cockpit
      ctx.fillStyle = '#7fc7ff';
      ctx.fillRect(p.x - 5, PADDLE_Y + 2, 10, PADDLE_H - 4);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, PADDLE_Y + 1, p.w - 2, PADDLE_H - 2);
      // thruster flames
      ctx.fillStyle = '#f08030';
      ctx.fillRect(x + 10, PADDLE_Y + PADDLE_H, 4, 4);
      ctx.fillRect(x + p.w - 14, PADDLE_Y + PADDLE_H, 4, 4);
    }

    function drawBall(ball) {
      ctx.fillStyle = 'rgba(255, 203, 5, 0.25)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcb05';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, BALL_R * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawCapsule(cap) {
      const st = CAPSULE_STYLE[cap.kind];
      ctx.fillStyle = st.color;
      ctx.fillRect(cap.x - 9, cap.y - 7, 18, 14);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(cap.x - 9, cap.y - 7, 18, 14);
      ctx.fillStyle = ink;
      ctx.font = '900 12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.label, cap.x, cap.y + 1);
    }

    function draw(now) {
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, W, H);

      // twinkling star dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 89) % W;
        const sy = (i * 53 + i * i) % H;
        if ((i + Math.floor(now / 700)) % 5 === 0) continue; // twinkle
        ctx.fillRect(sx, sy, 2, 2);
      }

      for (const brick of engine.bricks) {
        if (brick.hp > 0) drawBrick(brick);
      }
      for (const cap of engine.capsules) drawCapsule(cap);
      drawPaddle();
      for (const ball of engine.balls) drawBall(ball);
    }

    return { draw };
  }

  NS.createRenderer = createRenderer;

})(window.AstroBreaker);
