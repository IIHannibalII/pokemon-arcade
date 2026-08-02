'use strict';

/* ============================================================
   AstroSweeper — game engine.
   Pure minesweeper logic: no DOM, no canvas. Scan the sector,
   the numbers show adjacent asteroids, beacons mark danger.
   Mines are placed after the first reveal so it is always safe.
   ============================================================ */

window.AstroSweeper = window.AstroSweeper || {};

(function (NS) {

  const DIFFS = {
    easy:   { label: 'SECTOR I',   cols: 9,  rows: 9,  mines: 10 },
    medium: { label: 'SECTOR II',  cols: 12, rows: 12, mines: 24 },
    hard:   { label: 'SECTOR III', cols: 14, rows: 14, mines: 40 },
  };

  class Engine {
    /**
     * hooks: onReveal(count), onFlag(placed), onBoom(),
     *        onWin(timeMs), onChord()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.diffKey = 'easy';
      this.reset();
    }

    setDifficulty(key) {
      if (DIFFS[key]) {
        this.diffKey = key;
        this.reset();
      }
    }

    get diff() {
      return DIFFS[this.diffKey];
    }

    reset() {
      const { cols, rows } = this.diff;
      this.cols = cols;
      this.rows = rows;
      /* cell: { mine, revealed, flagged, n } */
      this.grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, n: 0 })));
      this.status = 'idle'; // idle | playing | paused | won | lost
      this.time = 0;
      this.flags = 0;
      this.revealedCount = 0;
      this.boomAt = null;
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    inBounds(x, y) {
      return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    neighbors(x, y) {
      const out = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (this.inBounds(x + dx, y + dy)) out.push([x + dx, y + dy]);
        }
      }
      return out;
    }

    /* Mines are placed on the first reveal, never on or around it. */
    placeMines(safeX, safeY) {
      const banned = new Set([safeX + ',' + safeY]);
      for (const [nx, ny] of this.neighbors(safeX, safeY)) banned.add(nx + ',' + ny);
      const spots = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!banned.has(x + ',' + y)) spots.push([x, y]);
        }
      }
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
      }
      for (let i = 0; i < this.diff.mines; i++) {
        const [x, y] = spots[i];
        this.grid[y][x].mine = true;
      }
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          this.grid[y][x].n = this.neighbors(x, y)
            .filter(([nx, ny]) => this.grid[ny][nx].mine).length;
        }
      }
    }

    reveal(x, y) {
      if (this.status === 'won' || this.status === 'lost' || this.status === 'paused') return;
      if (!this.inBounds(x, y)) return;
      const cell = this.grid[y][x];
      if (cell.flagged || cell.revealed) return;

      if (this.status === 'idle') {
        this.placeMines(x, y);
        this.status = 'playing';
      }

      if (cell.mine) {
        this.boom(x, y);
        return;
      }

      // flood reveal
      let opened = 0;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const c = this.grid[cy][cx];
        if (c.revealed || c.flagged || c.mine) continue;
        c.revealed = true;
        opened++;
        if (c.n === 0) {
          for (const [nx, ny] of this.neighbors(cx, cy)) stack.push([nx, ny]);
        }
      }
      this.revealedCount += opened;
      if (opened && this.hooks.onReveal) this.hooks.onReveal(opened);
      this.checkWin();
    }

    toggleFlag(x, y) {
      if (this.status === 'won' || this.status === 'lost' || this.status === 'paused') return;
      if (!this.inBounds(x, y)) return;
      const cell = this.grid[y][x];
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      this.flags += cell.flagged ? 1 : -1;
      if (this.hooks.onFlag) this.hooks.onFlag(cell.flagged);
    }

    /* Click a satisfied number: reveal its unflagged neighbors. */
    chord(x, y) {
      if (this.status !== 'playing') return;
      const cell = this.grid[y] && this.grid[y][x];
      if (!cell || !cell.revealed || cell.n === 0) return;
      const around = this.neighbors(x, y);
      const flagged = around.filter(([nx, ny]) => this.grid[ny][nx].flagged).length;
      if (flagged !== cell.n) return;
      if (this.hooks.onChord) this.hooks.onChord();
      for (const [nx, ny] of around) {
        const c = this.grid[ny][nx];
        if (!c.flagged && !c.revealed) {
          if (c.mine) {
            this.boom(nx, ny);
            return;
          }
          this.reveal(nx, ny);
        }
      }
    }

    boom(x, y) {
      this.status = 'lost';
      this.boomAt = [x, y];
      for (let yy = 0; yy < this.rows; yy++) {
        for (let xx = 0; xx < this.cols; xx++) {
          if (this.grid[yy][xx].mine) this.grid[yy][xx].revealed = true;
        }
      }
      if (this.hooks.onBoom) this.hooks.onBoom();
    }

    checkWin() {
      const total = this.cols * this.rows - this.diff.mines;
      if (this.revealedCount >= total && this.status === 'playing') {
        this.status = 'won';
        // auto-flag remaining asteroids for a tidy final board
        for (let y = 0; y < this.rows; y++) {
          for (let x = 0; x < this.cols; x++) {
            const c = this.grid[y][x];
            if (c.mine && !c.flagged) { c.flagged = true; this.flags++; }
          }
        }
        if (this.hooks.onWin) this.hooks.onWin(this.time);
      }
    }

    update(dt) {
      if (this.status === 'playing') this.time += dt;
    }
  }

  NS.DIFFS = DIFFS;
  NS.Engine = Engine;

})(window.AstroSweeper);
