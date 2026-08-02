'use strict';

/* ============================================================
   PokéTetris — main loop, input (keyboard DAS + touch), HUD,
   sound wiring, catch FX, leaderboard and the partner mascot.
   ============================================================ */

(function (NS) {

  const DAS_MS = 170; // delay before auto-repeat kicks in
  const ARR_MS = 40;  // auto-repeat rate
  const BEST_KEY = 'pokearcade.tetris.best';
  const SCORES_KEY = 'pokearcade.tetris.scores';
  const RANKING_SIZE = 5;
  const EVOLVE_FLASH_MS = 1400;

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      next: document.getElementById('next'),
      hold: document.getElementById('hold'),
      score: document.getElementById('stat-score'),
      best: document.getElementById('stat-best'),
      level: document.getElementById('stat-level'),
      lines: document.getElementById('stat-lines'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      mascot: document.getElementById('mascot'),
      mascotName: document.getElementById('mascot-name'),
      evoMsg: document.getElementById('evo-msg'),
      hpFill: document.getElementById('hp-fill'),
      soundBtn: document.getElementById('btn-sound'),
      boardWrap: document.querySelector('.board-wrap'),
      touchControls: document.getElementById('touch-controls'),
      holdBox: document.getElementById('hold-box'),
      partnerBox: document.getElementById('partner-box'),
    };

    const Sound = NS.Sound;
    const Mascot = NS.Mascot;
    const mascotCtx = els.mascot.getContext('2d');

    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let mascotStage = 0;
    let evolveAnim = null; // { from, to, t }
    let lastRankIdx = -1;  // index of the freshly added leaderboard entry

    /* ---------- Leaderboard (localStorage) ---------- */

    function loadScores() {
      try {
        const list = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveScore(score, level, lines) {
      if (score <= 0) return -1;
      const list = loadScores();
      const entry = { s: score, v: level, n: lines, d: Date.now() };
      list.push(entry);
      list.sort((a, b) => b.s - a.s || a.d - b.d);
      const top = list.slice(0, RANKING_SIZE);
      localStorage.setItem(SCORES_KEY, JSON.stringify(top));
      return top.indexOf(entry);
    }

    function renderRanking() {
      const list = loadScores();
      els.rankingBox.hidden = list.length === 0;
      els.ranking.innerHTML = '';
      list.forEach((e, i) => {
        const li = document.createElement('li');
        if (i === lastRankIdx && engine.status === 'over') li.className = 'r-new';
        const rank = document.createElement('span');
        rank.textContent = (i + 1) + '. Lv.' + e.v;
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = e.s;
        li.append(rank, score);
        els.ranking.appendChild(li);
      });
    }

    /* ---------- Catch FX label over the board ---------- */

    function showFX(text, legendary) {
      els.fx.textContent = text;
      els.fx.classList.remove('fx--run', 'fx--legendary');
      void els.fx.offsetWidth; // restart the CSS animation
      if (legendary) els.fx.classList.add('fx--legendary');
      els.fx.classList.add('fx--run');
    }

    function shakeBoard() {
      els.boardWrap.classList.remove('shake');
      void els.boardWrap.offsetWidth;
      els.boardWrap.classList.add('shake');
    }

    /* ---------- Engine + event hooks ---------- */

    const engine = new NS.Engine({
      onLinesCleared(count) {
        Sound.sfx.clear(count);
        if (count >= 4) {
          showFX('LEGENDARY CATCH!', true);
          shakeBoard();
        } else {
          showFX('GOTCHA! ×' + count);
        }
      },
      onLock(cleared) {
        if (cleared === 0) Sound.sfx.lock();
      },
      onLevelUp(level) {
        const to = Mascot.stageForLevel(level);
        if (to !== mascotStage) {
          Sound.sfx.levelUp();
          evolveAnim = { from: mascotStage, to, t: 0 };
          els.evoMsg.textContent = 'What? ' + Mascot.STAGES[mascotStage].name + ' is evolving!';
        } else {
          Sound.sfx.levelUp();
          showFX('LEVEL ' + level + '!');
        }
      },
      onGameOver() {
        Sound.sfx.gameOver();
        Sound.stopMusic();
        if (engine.score > best) {
          best = engine.score;
          localStorage.setItem(BEST_KEY, String(best));
        }
        lastRankIdx = saveScore(engine.score, engine.level, engine.lines);
      },
      onHardDrop() { Sound.sfx.drop(); },
      onHold() { Sound.sfx.hold(); },
    });

    const renderer = NS.createRenderer(engine, els);
    NS.game = engine; // exposed for debugging and game-page integrations

    function startGame() {
      engine.start();
      Sound.startMusic();
      Sound.setPaused(false);
    }

    /* ---------- Overlay ---------- */

    let lastOverlayState = null;

    function updateOverlay() {
      const o = els.overlay;
      if (engine.status === 'playing') {
        o.hidden = true;
        lastOverlayState = 'playing';
        return;
      }
      o.hidden = false;
      const state = engine.status + ':' + engine.score +
        (typeof scrollFree !== 'undefined' && scrollFree ? ':s' : '');
      if (state === lastOverlayState) return; // avoid DOM churn
      lastOverlayState = state;

      if (engine.status === 'ready') {
        els.overlayTitle.textContent = 'POKéTETRIS';
        els.overlayText.textContent = 'Press ENTER or tap to start';
        renderRanking();
      } else if (engine.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap your partner to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (engine.status === 'over') {
        els.overlayTitle.textContent = 'GAME OVER';
        els.overlayText.textContent =
          Mascot.STAGES[mascotStage].name + ' fainted! · Score ' +
          engine.score + ' · ENTER to retry';
        renderRanking();
      }
    }

    /* ---------- Keyboard with DAS ---------- */

    const held = { left: false, right: false };
    let dasDir = 0;       // -1 left, 1 right, 0 none
    let dasTimer = 0;
    let arrTimer = 0;
    let dasCharged = false;

    function pressMove(dir) {
      dasDir = dir;
      dasTimer = 0;
      arrTimer = 0;
      dasCharged = false;
      const moved = dir === -1 ? engine.moveLeft() : engine.moveRight();
      if (moved) Sound.sfx.move();
    }

    function releaseMove(dir) {
      if (dir === -1) {
        held.left = false;
        dasDir = held.right ? 1 : 0;
      } else {
        held.right = false;
        dasDir = held.left ? -1 : 0;
      }
    }

    function updateDAS(dt) {
      if (dasDir === 0) return;
      dasTimer += dt;
      if (!dasCharged && dasTimer >= DAS_MS) {
        dasCharged = true;
        arrTimer = ARR_MS; // fire the first repeat immediately
      }
      if (dasCharged) {
        arrTimer += dt;
        while (arrTimer >= ARR_MS) {
          arrTimer -= ARR_MS;
          if (dasDir === -1) engine.moveLeft();
          else engine.moveRight();
        }
      }
    }

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
    }

    function togglePause() {
      engine.togglePause();
      Sound.setPaused(engine.status === 'paused');
    }

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      Sound.unlock(); // browsers require a user gesture before audio
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          held.left = true;
          pressMove(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          held.right = true;
          pressMove(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          engine.setSoftDrop(true);
          break;
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault();
          if (engine.rotateCW()) Sound.sfx.rotate();
          break;
        case 'KeyZ':
          if (engine.rotateCCW()) Sound.sfx.rotate();
          break;
        case 'Space':
          e.preventDefault();
          engine.hardDrop();
          break;
        case 'KeyC':
          engine.holdPiece();
          break;
        case 'KeyP':
        case 'Escape':
          togglePause();
          break;
        case 'KeyM':
          toggleSound();
          break;
        case 'Enter':
          if (engine.status === 'ready' || engine.status === 'over') startGame();
          break;
        case 'KeyR':
          engine.reset();
          startGame();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft':
          releaseMove(-1);
          break;
        case 'ArrowRight':
          releaseMove(1);
          break;
        case 'ArrowDown':
          engine.setSoftDrop(false);
          break;
      }
    });

    els.soundBtn.addEventListener('click', () => {
      Sound.unlock();
      toggleSound();
    });

    /* Tappable top boxes: HOLD swaps the piece, PARTNER pauses. */
    els.holdBox.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') startGame();
      else engine.holdPiece();
    });

    els.partnerBox.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') startGame();
      else togglePause();
    });

    /* ---------- On-screen touch buttons ---------- */

    els.touchControls.querySelectorAll('button').forEach((btn) => {
      const act = btn.dataset.act;

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Sound.unlock();
        if (engine.status === 'ready' || engine.status === 'over') {
          startGame();
          return;
        }
        if (act === 'left') { held.left = true; pressMove(-1); }
        else if (act === 'right') { held.right = true; pressMove(1); }
        else if (act === 'down') engine.setSoftDrop(true);
        else if (act === 'rotate') { if (engine.rotateCW()) Sound.sfx.rotate(); }
        else if (act === 'drop') engine.hardDrop();
        else if (act === 'hold') engine.holdPiece();
        else if (act === 'pause') togglePause();
      });

      const end = (e) => {
        e.preventDefault();
        if (act === 'left') releaseMove(-1);
        else if (act === 'right') releaseMove(1);
        else if (act === 'down') engine.setSoftDrop(false);
      };
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    /* ---------- Swipe gestures on the board ----------
       drag left/right — move; drag down — soft drop;
       fast flick down — hard drop; tap — rotate (or start). */

    const gesture = { active: false, x0: 0, y0: 0, t0: 0, lastX: 0, moved: false, soft: false };
    const SWIPE_CELL = 26;
    const TAP_HALO = 1.5; // cells around the piece that still count as tapping it

    /* Rotation is a tap on the falling piece itself (with a small
       forgiving halo), evaluated when the finger is released. */
    function tapOnPiece(e) {
      const c = engine.current;
      if (!c) return false;
      const rect = els.board.getBoundingClientRect();
      const { COLS, VISIBLE_ROWS, HIDDEN_ROWS } = NS.CONST;
      const cx = ((e.clientX - rect.left) / rect.width) * COLS;
      const cy = ((e.clientY - rect.top) / rect.height) * VISIBLE_ROWS + HIDDEN_ROWS;
      return engine.cellsOf(c.x, c.y, c.rot, c.id).some(([px, py]) =>
        Math.abs(cx - (px + 0.5)) <= TAP_HALO && Math.abs(cy - (py + 0.5)) <= TAP_HALO);
    }

    /* On touch devices the whole page is the gesture surface, so a
       finger slightly off the board still controls the game (the board
       canvas alone is enough for the mouse). */
    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const surface = (coarse && document.querySelector('.tetris-layout')) || els.board;

    els.board.style.touchAction = 'none';
    surface.style.touchAction = 'none';

    surface.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') {
        startGame();
        return;
      }
      gesture.active = true;
      gesture.x0 = gesture.lastX = e.clientX;
      gesture.y0 = e.clientY;
      gesture.t0 = performance.now();
      gesture.moved = false;
      gesture.soft = false;
    });

    surface.addEventListener('pointermove', (e) => {
      if (!gesture.active) return;
      const dx = e.clientX - gesture.lastX;
      if (Math.abs(dx) >= SWIPE_CELL) {
        const steps = Math.trunc(dx / SWIPE_CELL);
        for (let i = 0; i < Math.abs(steps); i++) {
          if (steps > 0 ? engine.moveRight() : engine.moveLeft()) Sound.sfx.move();
        }
        gesture.lastX += steps * SWIPE_CELL;
        gesture.moved = true;
      }
      const dy = e.clientY - gesture.y0;
      if (dy > 40 && Math.abs(e.clientX - gesture.x0) < 60) {
        if (!gesture.soft) {
          gesture.soft = true;
          engine.setSoftDrop(true);
        }
        gesture.moved = true;
      }
    });

    const endGesture = (e) => {
      if (!gesture.active) return;
      gesture.active = false;
      if (gesture.soft) engine.setSoftDrop(false);

      const dt = performance.now() - gesture.t0;
      const dy = e.clientY - gesture.y0;
      const dxTotal = Math.abs(e.clientX - gesture.x0);

      if (dy > 70 && dt < 260 && dxTotal < 60) {
        engine.hardDrop(); // fast downward flick
      } else if (dy < -45 && dxTotal < 60) {
        // upward swipe rotates
        if (engine.status === 'playing' && engine.rotateCW()) Sound.sfx.rotate();
      } else if (!gesture.moved && dt < 260 && dxTotal < 12 && Math.abs(dy) < 12) {
        // tap on the piece itself also rotates it
        if (engine.status === 'playing' && tapOnPiece(e) && engine.rotateCW()) {
          Sound.sfx.rotate();
        }
      }
    };
    surface.addEventListener('pointerup', endGesture);
    surface.addEventListener('pointercancel', endGesture);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    /* Auto-pause when the window loses focus mid-game. */
    window.addEventListener('blur', () => {
      if (engine.status === 'playing') {
        engine.togglePause();
        Sound.setPaused(true);
      }
    });

    /* A two-finger tap toggles page scrolling on phones. Unlocking
       mid-game pauses the game first; once the game is resumed, the
       next touch locks scrolling again. */
    let scrollFree = false;
    const activePointers = new Set();

    function setScrollFree(on) {
      scrollFree = on;
      document.documentElement.classList.toggle('scroll-free', on);
      surface.style.touchAction = on ? 'pan-y' : 'none';
    }

    document.addEventListener('pointerdown', (e) => {
      activePointers.add(e.pointerId);
      if (activePointers.size === 1 && scrollFree && engine.status === 'playing') {
        setScrollFree(false); // game resumed — lock the page again
        return;
      }
      if (activePointers.size === 2) {
        gesture.active = false; // don't let finger #1 register as a game tap
        if (!scrollFree && engine.status === 'playing') {
          engine.togglePause();
          Sound.setPaused(true);
        }
        setScrollFree(!scrollFree);
      }
    });

    const releasePointer = (e) => activePointers.delete(e.pointerId);
    document.addEventListener('pointerup', releasePointer);
    document.addEventListener('pointercancel', releasePointer);

    /* ---------- Mascot ---------- */

    function updateMascot(dt) {
      if (engine.status === 'ready' || engine.status === 'over') {
        // a fresh run starts from the base stage
        if (engine.status === 'ready') mascotStage = 0;
      } else {
        const target = Mascot.stageForLevel(engine.level);
        if (target < mascotStage) mascotStage = target; // after restart
      }

      if (evolveAnim) {
        evolveAnim.t += dt;
        const flicker = Math.floor(evolveAnim.t / 140) % 2 === 1;
        const stage = flicker ? evolveAnim.to : evolveAnim.from;
        Mascot.draw(mascotCtx, stage, { silhouette: true });
        if (evolveAnim.t >= EVOLVE_FLASH_MS) {
          mascotStage = evolveAnim.to;
          els.evoMsg.textContent =
            Mascot.STAGES[evolveAnim.from].name + ' evolved into ' +
            Mascot.STAGES[evolveAnim.to].name + '!';
          evolveAnim = null;
        }
      } else {
        Mascot.draw(mascotCtx, mascotStage);
      }
      els.mascotName.textContent =
        Mascot.STAGES[mascotStage].name + ' · Lv.' + engine.level;
    }

    /* ---------- HUD ---------- */

    function stackHeight() {
      const { HIDDEN_ROWS, VISIBLE_ROWS, COLS } = NS.CONST;
      for (let y = HIDDEN_ROWS; y < engine.board.length; y++) {
        for (let x = 0; x < COLS; x++) {
          if (engine.board[y][x]) return VISIBLE_ROWS - (y - HIDDEN_ROWS);
        }
      }
      return 0;
    }

    function updateHUD() {
      els.score.textContent = engine.score;
      els.level.textContent = engine.level;
      els.lines.textContent = engine.lines;
      els.best.textContent = Math.max(best, engine.score);

      // battle-style HP bar: energy drains as the stack rises
      const hp = Math.max(0, 1 - stackHeight() / NS.CONST.VISIBLE_ROWS);
      els.hpFill.style.width = (hp * 100).toFixed(0) + '%';
      els.hpFill.className =
        'hp-fill' + (hp < 0.2 ? ' hp-fill--low' : hp < 0.5 ? ' hp-fill--mid' : '');
    }

    /* ---------- Main loop ---------- */

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(now - last, 100); // clamp away tab-switch spikes
      last = now;
      updateDAS(engine.status === 'playing' ? dt : 0);
      engine.update(dt);
      renderer.draw();
      updateMascot(dt);
      updateHUD();
      updateOverlay();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });

})(window.PokeTetris);
