'use strict';

/* ============================================================
   AstroSudoku — game engine.
   Pure sudoku logic: a backtracking generator with a
   uniqueness guarantee, pencil notes, conflicts and hints.
   ============================================================ */

window.AstroSudoku = window.AstroSudoku || {};

(function (NS) {

  const DIFFS = {
    easy:   { label: 'EASY',   givens: 40 },
    medium: { label: 'NORMAL', givens: 32 },
    hard:   { label: 'HARD',   givens: 26 },
  };

  const HINT_PENALTY_MS = 30000;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function boxStart(i) {
    return Math.floor(i / 3) * 3;
  }

  function candidateOk(grid, x, y, v) {
    for (let i = 0; i < 9; i++) {
      if (grid[y][i] === v || grid[i][x] === v) return false;
    }
    const bx = boxStart(x);
    const by = boxStart(y);
    for (let yy = by; yy < by + 3; yy++) {
      for (let xx = bx; xx < bx + 3; xx++) {
        if (grid[yy][xx] === v) return false;
      }
    }
    return true;
  }

  function generateSolved() {
    const grid = Array.from({ length: 9 }, () => new Array(9).fill(0));
    function fill(pos) {
      if (pos === 81) return true;
      const x = pos % 9;
      const y = Math.floor(pos / 9);
      for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (candidateOk(grid, x, y, v)) {
          grid[y][x] = v;
          if (fill(pos + 1)) return true;
          grid[y][x] = 0;
        }
      }
      return false;
    }
    fill(0);
    return grid;
  }

  /* Count solutions, stopping at `limit`. */
  function countSolutions(grid, limit) {
    let count = 0;
    function solve() {
      if (count >= limit) return;
      let bx = -1, by = -1;
      outer: for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (grid[y][x] === 0) { bx = x; by = y; break outer; }
        }
      }
      if (bx === -1) { count++; return; }
      for (let v = 1; v <= 9; v++) {
        if (candidateOk(grid, bx, by, v)) {
          grid[by][bx] = v;
          solve();
          grid[by][bx] = 0;
          if (count >= limit) return;
        }
      }
    }
    solve();
    return count;
  }

  function makePuzzle(givens) {
    const solution = generateSolved();
    const puzzle = solution.map((row) => row.slice());
    const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
    let filled = 81;
    for (const idx of cells) {
      if (filled <= givens) break;
      const x = idx % 9;
      const y = Math.floor(idx / 9);
      const backup = puzzle[y][x];
      puzzle[y][x] = 0;
      if (countSolutions(puzzle.map((r) => r.slice()), 2) !== 1) {
        puzzle[y][x] = backup; // removal broke uniqueness
      } else {
        filled--;
      }
    }
    return { puzzle, solution };
  }

  class Engine {
    /**
     * hooks: onSet(ok), onErase(), onNote(), onHint(), onWin(timeMs)
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.diffKey = 'easy';
      this.newGame();
    }

    setDifficulty(key) {
      if (DIFFS[key]) {
        this.diffKey = key;
        this.newGame();
      }
    }

    get diff() {
      return DIFFS[this.diffKey];
    }

    newGame() {
      const { puzzle, solution } = makePuzzle(this.diff.givens);
      this.solution = solution;
      this.given = puzzle.map((row) => row.map((v) => v !== 0));
      this.values = puzzle.map((row) => row.slice());
      this.notes = Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set()));
      this.sel = { x: 4, y: 4 };
      this.status = 'playing'; // playing | paused | won
      this.time = 0;
      this.hintsUsed = 0;
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    select(x, y) {
      if (x >= 0 && x < 9 && y >= 0 && y < 9) this.sel = { x, y };
    }

    moveSel(dx, dy) {
      this.select(
        Math.max(0, Math.min(8, this.sel.x + dx)),
        Math.max(0, Math.min(8, this.sel.y + dy)));
    }

    setValue(v) {
      if (this.status !== 'playing') return;
      const { x, y } = this.sel;
      if (this.given[y][x]) return;
      if (this.values[y][x] === v) {
        this.values[y][x] = 0; // typing the same number erases it
        return;
      }
      this.values[y][x] = v;
      this.notes[y][x].clear();
      // QoL: remove this candidate from notes in the row, column and box
      for (let i = 0; i < 9; i++) {
        this.notes[y][i].delete(v);
        this.notes[i][x].delete(v);
      }
      const bx = boxStart(x);
      const by = boxStart(y);
      for (let yy = by; yy < by + 3; yy++) {
        for (let xx = bx; xx < bx + 3; xx++) this.notes[yy][xx].delete(v);
      }
      if (this.hooks.onSet) this.hooks.onSet(this.solution[y][x] === v);
      this.checkWin();
    }

    toggleNote(v) {
      if (this.status !== 'playing') return;
      const { x, y } = this.sel;
      if (this.given[y][x] || this.values[y][x] !== 0) return;
      if (this.notes[y][x].has(v)) this.notes[y][x].delete(v);
      else this.notes[y][x].add(v);
      if (this.hooks.onNote) this.hooks.onNote();
    }

    erase() {
      if (this.status !== 'playing') return;
      const { x, y } = this.sel;
      if (this.given[y][x]) return;
      this.values[y][x] = 0;
      this.notes[y][x].clear();
      if (this.hooks.onErase) this.hooks.onErase();
    }

    /* Reveal the selected cell (or a random empty one). Costs time. */
    hint() {
      if (this.status !== 'playing') return;
      let { x, y } = this.sel;
      if (this.given[y][x] || this.values[y][x] === this.solution[y][x]) {
        const empties = [];
        for (let yy = 0; yy < 9; yy++) {
          for (let xx = 0; xx < 9; xx++) {
            if (this.values[yy][xx] !== this.solution[yy][xx]) empties.push([xx, yy]);
          }
        }
        if (!empties.length) return;
        [x, y] = empties[Math.floor(Math.random() * empties.length)];
        this.sel = { x, y };
      }
      this.values[y][x] = this.solution[y][x];
      this.notes[y][x].clear();
      this.time += HINT_PENALTY_MS;
      this.hintsUsed++;
      if (this.hooks.onHint) this.hooks.onHint();
      this.checkWin();
    }

    /* Cells that clash with the same value in a row/col/box. */
    conflicts() {
      const bad = new Set();
      const scan = (cells) => {
        const byVal = {};
        for (const [x, y] of cells) {
          const v = this.values[y][x];
          if (!v) continue;
          (byVal[v] = byVal[v] || []).push([x, y]);
        }
        for (const v in byVal) {
          if (byVal[v].length > 1) {
            for (const [x, y] of byVal[v]) bad.add(x + ',' + y);
          }
        }
      };
      for (let i = 0; i < 9; i++) {
        scan(Array.from({ length: 9 }, (_, j) => [j, i])); // row
        scan(Array.from({ length: 9 }, (_, j) => [i, j])); // column
      }
      for (let by = 0; by < 9; by += 3) {
        for (let bx = 0; bx < 9; bx += 3) {
          const cells = [];
          for (let y = by; y < by + 3; y++) {
            for (let x = bx; x < bx + 3; x++) cells.push([x, y]);
          }
          scan(cells);
        }
      }
      return bad;
    }

    checkWin() {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (this.values[y][x] !== this.solution[y][x]) return;
        }
      }
      this.status = 'won';
      if (this.hooks.onWin) this.hooks.onWin(this.time);
    }

    update(dt) {
      if (this.status === 'playing') this.time += dt;
    }
  }

  NS.DIFFS = DIFFS;
  NS.Engine = Engine;

})(window.AstroSudoku);
