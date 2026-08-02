'use strict';

/* ============================================================
   AstroSnake — canvas renderer.
   The star worm is one connected rounded body (teal) with a
   face and a glowing feeler; food is a golden star, the bonus
   is a blinking comet.
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
    const worm = '#56cfe1';
    const wormDark = '#2b7a8c';
    const ink = cssVar('--poke-ink');
    const gold = '#ffcb05';
    const goldDark = '#c7a008';

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
      snakeBlob(1.5, wormDark);
      snakeBlob(3.5, worm);

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
      // glowing feeler antenna
      ctx.strokeStyle = wormDark;
      ctx.lineWidth = Math.max(1.5, CELL * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + dx * CELL * 0.4, cy + dy * CELL * 0.4);
      ctx.lineTo(cx + dx * CELL * 0.66, cy + dy * CELL * 0.66);
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.arc(cx + dx * CELL * 0.7, cy + dy * CELL * 0.7, CELL * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    /* A five-point golden star. */
    function drawStar(x, y, radius) {
      const cx = (x + 0.5) * CELL;
      const cy = (y + 0.5) * CELL;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.strokeStyle = goldDark;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    /* A golden comet with a little tail. */
    function drawComet(x, y, radius) {
      const cx = (x + 0.5) * CELL;
      const cy = (y + 0.5) * CELL;
      for (let i = 3; i >= 1; i--) {
        ctx.fillStyle = 'rgba(255, 203, 5, ' + (0.16 * i) + ')';
        ctx.beginPath();
        ctx.arc(cx + i * radius * 0.55, cy - i * radius * 0.55, radius * (1 - i * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw(now) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, w, h);

      // faint space-grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
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
        drawStar(engine.food.x, engine.food.y, CELL * 0.4);
      }

      if (engine.bonus) {
        // blink faster as it is about to disappear
        const urgency = engine.bonus.ttl < BONUS_TTL_MS / 3 ? 90 : 220;
        if (Math.floor(now / urgency) % 2 === 0) {
          drawComet(engine.bonus.x, engine.bonus.y, CELL * 0.36);
        }
      }

      drawSnake();
    }

    return { draw };
  }

  NS.createRenderer = createRenderer;

})(window.PokeSnake);
