'use strict';

/* ============================================================
   AstroSweeper — canvas renderer.
   Raised unscanned tiles, flat scanned space, cratered
   asteroids, beacon flags and classic colored numbers.
   ============================================================ */

(function (NS) {

  const CANVAS = 420;

  const NUM_COLORS = [
    null, '#7fc7ff', '#78c850', '#f85888', '#9d7bff',
    '#f08030', '#98d8d8', '#f8d030', '#ffffff',
  ];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const screenBg = cssVar('--poke-screen');
    const ink = cssVar('--poke-ink');

    function metrics() {
      const cell = Math.floor(CANVAS / Math.max(engine.cols, engine.rows));
      const ox = Math.floor((CANVAS - cell * engine.cols) / 2);
      const oy = Math.floor((CANVAS - cell * engine.rows) / 2);
      return { cell, ox, oy };
    }

    function drawAsteroid(px, py, cell, exploded) {
      const cx = px + cell / 2;
      const cy = py + cell / 2;
      const r = cell * 0.32;
      ctx.fillStyle = exploded ? '#ee1515' : '#9aa3b2';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      // craters
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.25, r * 0.22, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.3, cy + r * 0.3, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawBeacon(px, py, cell) {
      const x = px + cell / 2;
      ctx.strokeStyle = '#f4f6fb';
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.beginPath();
      ctx.moveTo(x, py + cell * 0.22);
      ctx.lineTo(x, py + cell * 0.78);
      ctx.stroke();
      ctx.fillStyle = '#ee1515';
      ctx.beginPath();
      ctx.moveTo(x, py + cell * 0.22);
      ctx.lineTo(x + cell * 0.32, py + cell * 0.36);
      ctx.lineTo(x, py + cell * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function draw() {
      const { cell, ox, oy } = metrics();
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, CANVAS, CANVAS);

      for (let y = 0; y < engine.rows; y++) {
        for (let x = 0; x < engine.cols; x++) {
          const c = engine.grid[y][x];
          const px = ox + x * cell;
          const py = oy + y * cell;

          if (!c.revealed) {
            // raised unscanned tile
            ctx.fillStyle = '#2b3358';
            ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(px + 1, py + 1, cell - 2, 3);
            ctx.fillRect(px + 1, py + 1, 3, cell - 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(px + 1, py + cell - 4, cell - 2, 3);
            ctx.fillRect(px + cell - 4, py + 1, 3, cell - 2);
            // faint star speck on some tiles
            if ((x * 7 + y * 13) % 11 === 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
              ctx.fillRect(px + cell * 0.62, py + cell * 0.3, 2, 2);
            }
            if (c.flagged) drawBeacon(px, py, cell);
          } else {
            // scanned space
            const boom = engine.boomAt && engine.boomAt[0] === x && engine.boomAt[1] === y;
            ctx.fillStyle = boom ? 'rgba(238, 21, 21, 0.35)' : 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
            if (c.mine) {
              drawAsteroid(px, py, cell, boom);
            } else if (c.n > 0) {
              ctx.fillStyle = NUM_COLORS[c.n];
              ctx.font = Math.floor(cell * 0.5) + 'px "Press Start 2P", monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(c.n), px + cell / 2, py + cell / 2 + 2);
            }
          }
        }
      }

      // grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= engine.cols; x++) {
        ctx.beginPath();
        ctx.moveTo(ox + x * cell + 0.5, oy);
        ctx.lineTo(ox + x * cell + 0.5, oy + engine.rows * cell);
        ctx.stroke();
      }
      for (let y = 0; y <= engine.rows; y++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + y * cell + 0.5);
        ctx.lineTo(ox + engine.cols * cell, oy + y * cell + 0.5);
        ctx.stroke();
      }
    }

    return { draw, metrics };
  }

  NS.CANVAS = CANVAS;
  NS.createRenderer = createRenderer;

})(window.AstroSweeper);
