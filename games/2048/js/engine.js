'use strict';

/* ============================================================
   Astro2048 — game engine.
   Classic 4x4 sliding-merge rules. Tiles are objects with
   previous positions kept so the renderer can animate slides.
   ============================================================ */

window.Astro2048 = window.Astro2048 || {};

(function (NS) {

  const SIZE = 4;
  const WIN_VALUE = 2048;

  let tileSeq = 0;

  class Engine {
    /**
     * hooks: onMove(moved), onMerge(value), onSpawn(),
     *        onWin(), onGameOver()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.reset();
    }

    reset() {
      this.tiles = []; // { id, v, x, y, px, py, mergedFrom, isNew }
      this.score = 0;
      this.status = 'playing'; // playing | paused | over
      this.won = false;        // reached 2048 at least once
      this.moves = 0;
      this.spawn();
      this.spawn();
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    grid() {
      const g = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
      for (const t of this.tiles) g[t.y][t.x] = t;
      return g;
    }

    freeCells() {
      const g = this.grid();
      const free = [];
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (!g[y][x]) free.push([x, y]);
        }
      }
      return free;
    }

    spawn() {
      const free = this.freeCells();
      if (!free.length) return;
      const [x, y] = free[Math.floor(Math.random() * free.length)];
      this.tiles.push({
        id: ++tileSeq,
        v: Math.random() < 0.9 ? 2 : 4,
        x, y, px: x, py: y,
        mergedFrom: null,
        isNew: true,
      });
      if (this.hooks.onSpawn) this.hooks.onSpawn();
    }

    /* Slide all tiles in a direction. Returns true if anything moved. */
    move(dx, dy) {
      if (this.status !== 'playing') return false;

      // snapshot previous positions, clear animation flags
      for (const t of this.tiles) {
        t.px = t.x;
        t.py = t.y;
        t.mergedFrom = null;
        t.isNew = false;
      }

      const g = this.grid();
      let moved = false;
      let gained = 0;

      // traversal order: from the far edge backwards
      const xs = Array.from({ length: SIZE }, (_, i) => (dx === 1 ? SIZE - 1 - i : i));
      const ys = Array.from({ length: SIZE }, (_, i) => (dy === 1 ? SIZE - 1 - i : i));

      for (const y of ys) {
        for (const x of xs) {
          const tile = g[y][x];
          if (!tile) continue;
          let nx = x;
          let ny = y;
          // roll forward to the last free cell
          while (true) {
            const tx = nx + dx;
            const ty = ny + dy;
            if (tx < 0 || tx >= SIZE || ty < 0 || ty >= SIZE) break;
            const other = g[ty][tx];
            if (!other) {
              nx = tx;
              ny = ty;
              continue;
            }
            // merge once per move
            if (other.v === tile.v && !other.mergedFrom) {
              g[y][x] = null;
              // remove the swallowed tile; the survivor doubles
              this.tiles = this.tiles.filter((t) => t.id !== tile.id);
              other.v *= 2;
              other.mergedFrom = { x: tile.px, y: tile.py, id: tile.id };
              gained += other.v;
              this.score += other.v;
              moved = true;
              if (other.v >= WIN_VALUE && !this.won) {
                this.won = true;
                if (this.hooks.onWin) this.hooks.onWin();
              }
              nx = -1; // handled
            }
            break;
          }
          if (nx === -1) continue;
          if (nx !== x || ny !== y) {
            g[y][x] = null;
            g[ny][nx] = tile;
            tile.x = nx;
            tile.y = ny;
            moved = true;
          }
        }
      }

      if (moved) {
        this.moves++;
        this.spawn();
        if (gained && this.hooks.onMerge) this.hooks.onMerge(gained);
        if (!this.anyMoves()) {
          this.status = 'over';
          if (this.hooks.onGameOver) this.hooks.onGameOver();
        }
      }
      if (this.hooks.onMove) this.hooks.onMove(moved);
      return moved;
    }

    anyMoves() {
      if (this.freeCells().length) return true;
      const g = this.grid();
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const v = g[y][x].v;
          if (x + 1 < SIZE && g[y][x + 1].v === v) return true;
          if (y + 1 < SIZE && g[y + 1][x].v === v) return true;
        }
      }
      return false;
    }

    bestTile() {
      return this.tiles.reduce((m, t) => Math.max(m, t.v), 0);
    }
  }

  NS.CONST = { SIZE, WIN_VALUE };
  NS.Engine = Engine;

})(window.Astro2048);
