'use strict';

/* ============================================================
   PokéSnake — canvas renderer.
   The snake is one connected rounded body (grass-green) with a
   face on its head; food is a tiny Poké Ball, the bonus is a
   blinking golden ball.
   ============================================================ */

(function (NS) {

  const { COLS, ROWS, BONUS_TTL_MS } = NS.CONST;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const CELL = Math.floor(canvas.width / COLS);

    const screenBg = cssVar('--poke-screen');
    const green = cssVar('--type-grass');
    const greenDark = '#3f7a45';
    const greenBelly = '#a5e0aa';
    const ink = cssVar('--poke-ink');
    const red = cssVar('--poke-red');

    /* Fill the union of snake cells with rounded outer corners. */
    function snakeBlob(pad, fillStyle) {
      ctx.fillStyle = fillStyle;
      const has = new Set(engine.snake.map(([x, y]) => x + ',' + y));
      const r = CELL * 0.4;
      for (const [x, y] of engine.snake) {
        roundRect(ctx, x * CELL + pad, y * CELL + pad, CELL - 2 * pad, CELL - 2 * pad, r);
        ctx.fill();
        if (has.has((x + 1) + ',' + y)) {
          ctx.fillRect(x * CELL + CELL / 2, y * CELL + pad, CELL, CELL - 2 * pad);
        }
        if (has.has(x + ',' + (y + 1))) {
          ctx.fillRect(x * CELL + pad, y * CELL + CELL / 2, CELL - 2 * pad, CELL);
        }
      }
    }

    function drawSnake() {
      snakeBlob(1.5, greenDark);
      snakeBlob(3.5, green);

      // belly spots on every other segment (skip the head)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let i = 1; i < engine.snake.length; i += 2) {
        const [x, y] = engine.snake[i];
        ctx.beginPath();
        ctx.arc((x + 0.5) * CELL, (y + 0.5) * CELL, CELL * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }

      // head: eyes oriented by direction + tongue
      const [hx, hy] = engine.snake[0];
      const [dx, dy] = engine.dir;
      const cx = (hx + 0.5) * CELL;
      const cy = (hy + 0.5) * CELL;
      const perp = [-dy, dx];
      const eyeR = CELL * 0.14;
      for (const s of [-1, 1]) {
        const ex = cx + dx * CELL * 0.12 + perp[0] * s * CELL * 0.2;
        const ey = cy + dy * CELL * 0.12 + perp[1] * s * CELL * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(ex + dx * eyeR * 0.4, ey + dy * eyeR * 0.4, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      // flicking tongue
      ctx.strokeStyle = red;
      ctx.lineWidth = Math.max(1.5, CELL * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + dx * CELL * 0.4, cy + dy * CELL * 0.4);
      ctx.lineTo(cx + dx * CELL * 0.62, cy + dy * CELL * 0.62);
      ctx.stroke();
    }

    /* A tiny Poké Ball. */
    function drawBall(x, y, radius, topColor) {
      const cx = (x + 0.5) * CELL;
      const cy = (y + 0.5) * CELL;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f4f6fb';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
    }

    function draw(now) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, w, h);

      // faint grid
      ctx.strokeStyle = 'rgba(15, 56, 15, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, h);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(w, y * CELL + 0.5);
        ctx.stroke();
      }

      if (engine.food) {
        drawBall(engine.food.x, engine.food.y, CELL * 0.36, red);
      }

      if (engine.bonus) {
        // blink faster as it is about to disappear
        const urgency = engine.bonus.ttl < BONUS_TTL_MS / 3 ? 90 : 220;
        if (Math.floor(now / urgency) % 2 === 0) {
          drawBall(engine.bonus.x, engine.bonus.y, CELL * 0.42, '#f0b400');
        }
      }

      drawSnake();
    }

    return { draw };
  }

  NS.createRenderer = createRenderer;

})(window.PokeSnake);
