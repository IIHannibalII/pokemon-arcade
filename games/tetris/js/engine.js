'use strict';

/* ============================================================
   PokéTetris — game engine.
   Pure game logic: no DOM, no canvas. The renderer and the
   main loop talk to this through the Engine API and hooks.
   ============================================================ */

window.PokeTetris = window.PokeTetris || {};

(function (NS) {

  const COLS = 10;
  const VISIBLE_ROWS = 20;
  const HIDDEN_ROWS = 2;           // spawn area above the visible field
  const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const SOFT_DROP_MS = 40;
  const CLEAR_FLASH_MS = 340; // "catch" flash before cleared rows collapse

  // Line-clear base scores (guideline): 1/2/3/4 lines.
  const LINE_SCORES = [0, 100, 300, 500, 800];

  /* Piece definitions. Each piece is mapped to a cosmic element —
     the colors come from the shared theme (see --type-* tokens). */
  const PIECES = [
    null, // board cells use 0 for "empty", so piece ids start at 1
    { key: 'I', type: 'comet',  matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
    { key: 'J', type: 'planet', matrix: [[1,0,0],[1,1,1],[0,0,0]] },
    { key: 'L', type: 'rocket', matrix: [[0,0,1],[1,1,1],[0,0,0]] },
    { key: 'O', type: 'star',   matrix: [[1,1],[1,1]] },
    { key: 'S', type: 'ufo',    matrix: [[0,1,1],[1,1,0],[0,0,0]] },
    { key: 'T', type: 'moon',   matrix: [[0,1,0],[1,1,1],[0,0,0]] },
    { key: 'Z', type: 'plasma', matrix: [[1,1,0],[0,1,1],[0,0,0]] },
  ];

  /* SRS wall kicks, written in the guideline's y-up convention.
     Rotation states: 0 = spawn, 1 = CW, 2 = 180, 3 = CCW. */
  const KICKS_JLSTZ = {
    '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  };
  const KICKS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  };

  function rotateMatrixCW(m) {
    const n = m.length;
    const r = m.map(() => new Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        r[x][n - 1 - y] = m[y][x];
      }
    }
    return r;
  }

  /* Precompute the 4 rotation states of every piece. */
  const ROTATIONS = PIECES.map((p) => {
    if (!p) return null;
    const states = [p.matrix];
    for (let i = 1; i < 4; i++) states.push(rotateMatrixCW(states[i - 1]));
    return states;
  });

  /* Guideline gravity: seconds per row at a given level. */
  function gravityMs(level) {
    const s = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
    return Math.max(s * 1000, 16);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  class Engine {
    /**
     * hooks: optional callbacks for game events —
     *   onLock(clearedLines), onLinesCleared(count, totalLines),
     *   onLevelUp(level), onGameOver(), onHold(), onHardDrop()
     */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.reset();
    }

    reset() {
      this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
      this.bag = [];
      this.queue = [];
      this.holdId = 0;
      this.canHold = true;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.status = 'ready'; // ready | playing | paused | over
      this.softDropping = false;
      this.gravityTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.current = null;
      this.clearing = null; // { rows: number[], t: ms } during the catch flash
      this.refillQueue();
    }

    start() {
      if (this.status === 'ready' || this.status === 'over') {
        this.reset();
        this.status = 'playing';
        this.spawn();
      }
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    refillQueue() {
      while (this.queue.length < 8) {
        if (this.bag.length === 0) this.bag = shuffle([1, 2, 3, 4, 5, 6, 7]);
        this.queue.push(this.bag.pop());
      }
    }

    spawn(pieceId) {
      const id = pieceId || this.queue.shift();
      this.refillQueue();
      const size = ROTATIONS[id][0].length;
      this.current = {
        id,
        rot: 0,
        x: Math.floor((COLS - size) / 2),
        y: 0,
      };
      this.gravityTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      if (this.collides(this.current.x, this.current.y, this.current.rot)) {
        this.status = 'over';
        if (this.hooks.onGameOver) this.hooks.onGameOver();
      }
    }

    cellsOf(x, y, rot, id) {
      const m = ROTATIONS[id][rot];
      const cells = [];
      for (let my = 0; my < m.length; my++) {
        for (let mx = 0; mx < m.length; mx++) {
          if (m[my][mx]) cells.push([x + mx, y + my]);
        }
      }
      return cells;
    }

    collides(x, y, rot) {
      const id = this.current.id;
      return this.cellsOf(x, y, rot, id).some(([cx, cy]) =>
        cx < 0 || cx >= COLS || cy >= ROWS || (cy >= 0 && this.board[cy][cx] !== 0)
      );
    }

    grounded() {
      return this.collides(this.current.x, this.current.y + 1, this.current.rot);
    }

    /* Reset the lock timer on a successful move/rotate while grounded. */
    touchLockDelay() {
      if (this.grounded() && this.lockResets < MAX_LOCK_RESETS) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }

    move(dx) {
      if (this.status !== 'playing' || !this.current) return false;
      const c = this.current;
      if (!this.collides(c.x + dx, c.y, c.rot)) {
        c.x += dx;
        this.touchLockDelay();
        return true;
      }
      return false;
    }

    moveLeft()  { return this.move(-1); }
    moveRight() { return this.move(1); }

    rotate(dir) {
      if (this.status !== 'playing' || !this.current) return false;
      const c = this.current;
      const piece = PIECES[c.id];
      if (piece.key === 'O') return true; // O has a single effective state
      const from = c.rot;
      const to = (c.rot + (dir === 'cw' ? 1 : 3)) % 4;
      const table = piece.key === 'I' ? KICKS_I : KICKS_JLSTZ;
      const kicks = table[from + '>' + to];
      for (const [kx, ky] of kicks) {
        const nx = c.x + kx;
        const ny = c.y - ky; // kicks are y-up, the board is y-down
        if (!this.collides(nx, ny, to)) {
          c.x = nx;
          c.y = ny;
          c.rot = to;
          this.touchLockDelay();
          return true;
        }
      }
      return false;
    }

    rotateCW()  { return this.rotate('cw'); }
    rotateCCW() { return this.rotate('ccw'); }

    setSoftDrop(on) {
      this.softDropping = on;
    }

    hardDrop() {
      if (this.status !== 'playing' || !this.current) return;
      const c = this.current;
      let dropped = 0;
      while (!this.collides(c.x, c.y + 1, c.rot)) {
        c.y++;
        dropped++;
      }
      this.score += dropped * 2;
      if (this.hooks.onHardDrop) this.hooks.onHardDrop(dropped);
      this.lockPiece();
    }

    holdPiece() {
      if (this.status !== 'playing' || !this.canHold || !this.current) return;
      const swapped = this.holdId;
      this.holdId = this.current.id;
      this.canHold = false;
      this.spawn(swapped || undefined);
      if (this.hooks.onHold) this.hooks.onHold();
    }

    ghostY() {
      const c = this.current;
      let y = c.y;
      while (!this.collides(c.x, y + 1, c.rot)) y++;
      return y;
    }

    lockPiece() {
      const c = this.current;
      const cells = this.cellsOf(c.x, c.y, c.rot, c.id);

      // Locking entirely inside the hidden rows means the stack topped out.
      if (cells.every(([, cy]) => cy < HIDDEN_ROWS)) {
        this.status = 'over';
        if (this.hooks.onGameOver) this.hooks.onGameOver();
        return;
      }

      for (const [cx, cy] of cells) {
        if (cy >= 0) this.board[cy][cx] = c.id;
      }

      const fullRows = [];
      for (let y = 0; y < ROWS; y++) {
        if (this.board[y].every((v) => v !== 0)) fullRows.push(y);
      }

      const cleared = fullRows.length;
      if (cleared > 0) {
        this.score += LINE_SCORES[cleared] * this.level;
        this.lines += cleared;
        const newLevel = 1 + Math.floor(this.lines / 10);
        if (newLevel > this.level) {
          this.level = newLevel;
          if (this.hooks.onLevelUp) this.hooks.onLevelUp(newLevel);
        }
        if (this.hooks.onLinesCleared) this.hooks.onLinesCleared(cleared, this.lines);
        // enter the "catch" flash: the piece is on the board, nothing falls
        this.current = null;
        this.clearing = { rows: fullRows, t: 0 };
      }
      if (this.hooks.onLock) this.hooks.onLock(cleared);

      if (cleared === 0) {
        this.canHold = true;
        this.spawn();
      }
    }

    finishClear() {
      const rows = this.clearing.rows.slice().sort((a, b) => a - b);
      for (const y of rows) {
        this.board.splice(y, 1);
        this.board.unshift(new Array(COLS).fill(0));
      }
      this.clearing = null;
      this.canHold = true;
      this.spawn();
    }

    update(dt) {
      if (this.status !== 'playing') return;

      if (this.clearing) {
        this.clearing.t += dt;
        if (this.clearing.t >= CLEAR_FLASH_MS) this.finishClear();
        return;
      }
      if (!this.current) return;

      if (this.grounded()) {
        this.lockTimer += dt;
        this.gravityTimer = 0;
        if (this.lockTimer >= LOCK_DELAY_MS) this.lockPiece();
        return;
      }

      this.lockTimer = 0;
      const interval = this.softDropping
        ? Math.min(SOFT_DROP_MS, gravityMs(this.level))
        : gravityMs(this.level);

      this.gravityTimer += dt;
      while (this.gravityTimer >= interval) {
        this.gravityTimer -= interval;
        if (!this.collides(this.current.x, this.current.y + 1, this.current.rot)) {
          this.current.y++;
          if (this.softDropping) this.score += 1;
        }
        if (this.grounded()) break;
      }
    }
  }

  NS.CONST = { COLS, ROWS, VISIBLE_ROWS, HIDDEN_ROWS };
  NS.PIECES = PIECES;
  NS.ROTATIONS = ROTATIONS;
  NS.Engine = Engine;

})(window.PokeTetris);
