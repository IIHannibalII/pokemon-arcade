'use strict';

/* ============================================================
   AstroSudoku — canvas renderer.
   Star-chart grid: highlighted row/column/box, given digits in
   cream, your digits in cyan, conflicts in red, pencil notes.
   ============================================================ */

(function (NS) {

  const CANVAS = 396;
  const CELL = CANVAS / 9;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const screenBg = cssVar('--poke-screen');
    const cream = cssVar('--poke-cream');

    function draw() {
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, CANVAS, CANVAS);

      const sel = engine.sel;
      const selVal = engine.values[sel.y][sel.x];
      const bad = engine.conflicts();

      // row / column / box shading around the selection
      ctx.fillStyle = 'rgba(127, 199, 255, 0.08)';
      ctx.fillRect(0, sel.y * CELL, CANVAS, CELL);
      ctx.fillRect(sel.x * CELL, 0, CELL, CANVAS);
      const bx = Math.floor(sel.x / 3) * 3;
      const by = Math.floor(sel.y / 3) * 3;
      ctx.fillRect(bx * CELL, by * CELL, CELL * 3, CELL * 3);

      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const v = engine.values[y][x];
          const px = x * CELL;
          const py = y * CELL;

          // same-value echo highlight
          if (selVal && v === selVal && !(x === sel.x && y === sel.y)) {
            ctx.fillStyle = 'rgba(255, 203, 5, 0.14)';
            ctx.fillRect(px, py, CELL, CELL);
          }

          if (x === sel.x && y === sel.y) {
            ctx.fillStyle = 'rgba(127, 199, 255, 0.28)';
            ctx.fillRect(px, py, CELL, CELL);
          }

          if (v) {
            const conflict = bad.has(x + ',' + y);
            // smooth bold digits with a soft outline
            ctx.font = '900 26px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.strokeText(String(v), px + CELL / 2, py + CELL / 2 + 1);
            ctx.fillStyle = conflict ? '#ff5252'
              : engine.given[y][x] ? cream : '#7fc7ff';
            ctx.fillText(String(v), px + CELL / 2, py + CELL / 2 + 1);
          } else if (engine.notes[y][x].size) {
            ctx.fillStyle = 'rgba(248, 240, 216, 0.6)';
            ctx.font = '700 11px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const n of engine.notes[y][x]) {
              const nx = px + ((n - 1) % 3 + 0.5) * (CELL / 3);
              const ny = py + (Math.floor((n - 1) / 3) + 0.5) * (CELL / 3);
              ctx.fillText(String(n), nx, ny + 1);
            }
          }
        }
      }

      // grid lines
      for (let i = 0; i <= 9; i++) {
        const heavy = i % 3 === 0;
        ctx.strokeStyle = heavy ? 'rgba(248, 240, 216, 0.6)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = heavy ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, CANVAS);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(CANVAS, i * CELL);
        ctx.stroke();
      }
    }

    return { draw };
  }

  NS.CANVAS = CANVAS;
  NS.CELL = CELL;
  NS.createRenderer = createRenderer;

})(window.AstroSudoku);
