'use strict';

/* ============================================================
   PokéTetris — canvas renderer.
   Draws the playfield, ghost piece, next queue and hold box.
   Piece colors are resolved from the shared theme's --type-*
   CSS custom properties, so the theme stays the single source
   of truth for the Pokémon type palette.
   ============================================================ */

(function (NS) {

  const { COLS, VISIBLE_ROWS, HIDDEN_ROWS } = NS.CONST;

  /* Cosmic element icons drawn on the blocks. */
  const TYPE_ICONS = {
    comet: '☄', planet: '🪐', rocket: '🚀', star: '⭐',
    ufo: '🛸', moon: '🌙', plasma: '✨',
  };

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

  function createRenderer(engine, els) {
    const boardCtx = els.board.getContext('2d');
    const nextCtx = els.next.getContext('2d');
    const holdCtx = els.hold.getContext('2d');

    const CELL = Math.floor(els.board.width / COLS);

    const screenBg = cssVar('--poke-screen');
    const screenDark = cssVar('--poke-screen-dark');
    const typeColors = {};
    const typeIcons = {};
    for (let id = 1; id < NS.PIECES.length; id++) {
      typeColors[id] = cssVar('--type-' + NS.PIECES[id].type);
      typeIcons[id] = TYPE_ICONS[NS.PIECES[id].type];
    }

    function drawBlock(ctx, px, py, size, id, ghost) {
      const color = typeColors[id];
      if (ghost) {
        ctx.strokeStyle = shade(color, 0.75);
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
        return;
      }
      ctx.fillStyle = color;
      ctx.fillRect(px, py, size, size);
      // pixel-style bevel: light top-left, dark bottom-right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(px, py, size, 3);
      ctx.fillRect(px, py, 3, size);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(px, py + size - 3, size, 3);
      ctx.fillRect(px + size - 3, py, 3, size);
      ctx.strokeStyle = shade(color, 0.55);
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

      // Pokémon type icon in the middle of the block
      const icon = typeIcons[id];
      if (icon && size >= 16) {
        ctx.font = Math.floor(size * 0.5) + 'px "Segoe UI Emoji", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(icon, px + size / 2, py + size / 2 + 1);
      }
    }

    function drawBoard() {
      const w = els.board.width;
      const h = els.board.height;
      boardCtx.fillStyle = screenBg;
      boardCtx.fillRect(0, 0, w, h);

      // faint space-grid
      boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      boardCtx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        boardCtx.beginPath();
        boardCtx.moveTo(x * CELL + 0.5, 0);
        boardCtx.lineTo(x * CELL + 0.5, h);
        boardCtx.stroke();
      }
      for (let y = 1; y < VISIBLE_ROWS; y++) {
        boardCtx.beginPath();
        boardCtx.moveTo(0, y * CELL + 0.5);
        boardCtx.lineTo(w, y * CELL + 0.5);
        boardCtx.stroke();
      }

      // locked cells
      for (let y = HIDDEN_ROWS; y < engine.board.length; y++) {
        for (let x = 0; x < COLS; x++) {
          const id = engine.board[y][x];
          if (id) drawBlock(boardCtx, x * CELL, (y - HIDDEN_ROWS) * CELL, CELL, id);
        }
      }

      if (engine.current && engine.status !== 'ready') {
        const c = engine.current;

        // ghost piece
        const gy = engine.ghostY();
        for (const [cx, cy] of engine.cellsOf(c.x, gy, c.rot, c.id)) {
          if (cy >= HIDDEN_ROWS) {
            drawBlock(boardCtx, cx * CELL, (cy - HIDDEN_ROWS) * CELL, CELL, c.id, true);
          }
        }

        // current piece
        for (const [cx, cy] of engine.cellsOf(c.x, c.y, c.rot, c.id)) {
          if (cy >= HIDDEN_ROWS) {
            drawBlock(boardCtx, cx * CELL, (cy - HIDDEN_ROWS) * CELL, CELL, c.id);
          }
        }
      }

      // "catch" flash over rows being cleared
      if (engine.clearing) {
        const phase = Math.floor(engine.clearing.t / 85) % 2;
        boardCtx.fillStyle = phase
          ? 'rgba(255, 255, 255, 0.85)'
          : 'rgba(255, 203, 5, 0.75)';
        for (const y of engine.clearing.rows) {
          if (y >= HIDDEN_ROWS) {
            boardCtx.fillRect(0, (y - HIDDEN_ROWS) * CELL, w, CELL);
          }
        }
      }
    }

    /* Draw a piece centered inside a box of the given canvas. */
    function drawMiniPiece(ctx, id, boxX, boxY, boxW, boxH) {
      const m = NS.ROTATIONS[id][0];
      const cells = [];
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m.length; x++) {
          if (m[y][x]) cells.push([x, y]);
        }
      }
      const xs = cells.map((c) => c[0]);
      const ys = cells.map((c) => c[1]);
      const pw = Math.max(...xs) - Math.min(...xs) + 1;
      const ph = Math.max(...ys) - Math.min(...ys) + 1;
      const size = 18;
      const ox = boxX + (boxW - pw * size) / 2 - Math.min(...xs) * size;
      const oy = boxY + (boxH - ph * size) / 2 - Math.min(...ys) * size;
      for (const [x, y] of cells) {
        drawBlock(ctx, ox + x * size, oy + y * size, size, id);
      }
    }

    function drawSidebox(ctx, canvas, ids) {
      ctx.fillStyle = screenBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = screenDark;
      const boxH = canvas.height / ids.length;
      ids.forEach((id, i) => {
        if (id) drawMiniPiece(ctx, id, 0, i * boxH, canvas.width, boxH);
      });
    }

    function draw() {
      drawBoard();
      drawSidebox(nextCtx, els.next, engine.queue.slice(0, 3));
      drawSidebox(holdCtx, els.hold, [engine.holdId]);
    }

    return { draw };
  }

  NS.createRenderer = createRenderer;

})(window.PokeTetris);
