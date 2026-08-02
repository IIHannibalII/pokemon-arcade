'use strict';

/* ============================================================
   Astro2048 — canvas renderer with slide/spawn/merge animation.
   Tile colors climb through the cosmic element palette as the
   values grow.
   ============================================================ */

(function (NS) {

  const { SIZE } = NS.CONST;
  const CANVAS = 396;
  const PAD = 10;
  const GAP = 8;
  const CELL = (CANVAS - PAD * 2 - GAP * (SIZE - 1)) / SIZE;
  const ANIM_MS = 110;

  const TILE_COLORS = {
    2:    '#3b4668',
    4:    '#4a5a85',
    8:    '#6890f0',
    16:   '#78c850',
    32:   '#98d8d8',
    64:   '#f8d030',
    128:  '#f08030',
    256:  '#f85888',
    512:  '#9d7bff',
    1024: '#7038f8',
    2048: '#ffcb05',
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function createRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const screenBg = cssVar('--poke-screen');
    const ink = cssVar('--poke-ink');

    let animStart = 0;

    function kick() {
      animStart = performance.now();
    }

    function cellPos(c) {
      return PAD + c * (CELL + GAP);
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawTile(px, py, v, scale) {
      const color = TILE_COLORS[v] || '#ffcb05';
      const size = CELL * scale;
      const off = (CELL - size) / 2;
      ctx.fillStyle = color;
      roundRect(px + off, py + off, size, size, 4 * scale);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(px + off + 3, py + off + 3, size - 6, 3);

      // smooth bold digits with a soft outline
      const digits = String(v).length;
      const fontSize = Math.floor((digits <= 2 ? 0.5 : digits === 3 ? 0.4 : 0.32) * CELL * scale);
      ctx.font = '900 ' + fontSize + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, fontSize * 0.14);
      ctx.strokeStyle = v <= 4 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.35)';
      ctx.strokeText(String(v), px + CELL / 2, py + CELL / 2 + 1);
      ctx.fillStyle = v <= 4 ? '#d7def5' : '#ffffff';
      ctx.fillText(String(v), px + CELL / 2, py + CELL / 2 + 1);
    }

    function draw(now) {
      const t = Math.min(1, (now - animStart) / ANIM_MS);

      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, CANVAS, CANVAS);

      // empty sockets
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          roundRect(cellPos(x), cellPos(y), CELL, CELL, 4);
          ctx.fill();
        }
      }

      for (const tile of engine.tiles) {
        // slide from previous to current position
        const fx = tile.px + (tile.x - tile.px) * t;
        const fy = tile.py + (tile.y - tile.py) * t;
        let scale = 1;
        if (tile.isNew) {
          scale = t < 0.5 ? 0 : (t - 0.5) * 2; // pop in late
          if (scale === 0) continue;
        } else if (tile.mergedFrom && t > 0.8) {
          scale = 1 + 0.15 * Math.sin(((t - 0.8) / 0.2) * Math.PI); // merge pulse
        }
        drawTile(cellPos(fx), cellPos(fy), tile.v, scale);
      }
    }

    return { draw, kick };
  }

  NS.CANVAS = CANVAS;
  NS.createRenderer = createRenderer;

})(window.Astro2048);
