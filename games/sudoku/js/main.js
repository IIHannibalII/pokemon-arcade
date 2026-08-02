'use strict';

/* ============================================================
   AstroSudoku — input (cell select, keyboard, number pad),
   pencil mode, hints, per-difficulty best times and overlays.
   ============================================================ */

(function (NS) {

  const RANKING_SIZE = 5;

  function scoresKey(diff) {
    return 'astroarcade.sudoku.scores.' + diff;
  }

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      time: document.getElementById('stat-time'),
      bestTime: document.getElementById('stat-besttime'),
      hints: document.getElementById('stat-hints'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      soundBtn: document.getElementById('btn-sound'),
      pauseBtn: document.getElementById('btn-pause'),
      pencilBtn: document.getElementById('btn-pencil'),
      hintBtn: document.getElementById('btn-hint'),
      eraseBtn: document.getElementById('btn-erase'),
      newBtn: document.getElementById('btn-new'),
      diffBtns: [...document.querySelectorAll('[data-diff]')],
      numBtns: [...document.querySelectorAll('[data-num]')],
    };

    const Sound = NS.Sound;
    let pencil = false;
    let lastRankIdx = -1;
    let musicOn = false;

    /* ---------- Per-difficulty best times ---------- */

    function loadScores(diff) {
      try {
        const list = JSON.parse(localStorage.getItem(scoresKey(diff)) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveScore(timeMs) {
      const list = loadScores(engine.diffKey);
      const entry = { t: Math.round(timeMs), d: Date.now() };
      list.push(entry);
      list.sort((a, b) => a.t - b.t || a.d - b.d);
      const top = list.slice(0, RANKING_SIZE);
      localStorage.setItem(scoresKey(engine.diffKey), JSON.stringify(top));
      return top.indexOf(entry);
    }

    function fmtTime(ms) {
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return m + ':' + String(s).padStart(2, '0');
    }

    function renderRanking() {
      const list = loadScores(engine.diffKey);
      els.rankingBox.hidden = list.length === 0;
      els.ranking.innerHTML = '';
      list.forEach((e, i) => {
        const li = document.createElement('li');
        if (i === lastRankIdx && engine.status === 'won') li.className = 'r-new';
        const rank = document.createElement('span');
        rank.textContent = (i + 1) + '.';
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = fmtTime(e.t);
        li.append(rank, score);
        els.ranking.appendChild(li);
      });
    }

    function showFX(text, legendary) {
      els.fx.textContent = text;
      els.fx.classList.remove('fx--run', 'fx--legendary');
      void els.fx.offsetWidth;
      if (legendary) els.fx.classList.add('fx--legendary');
      els.fx.classList.add('fx--run');
    }

    /* ---------- Engine + hooks ---------- */

    const engine = new NS.Engine({
      onSet(ok) {
        if (ok) Sound.sfx.set();
        else Sound.sfx.wrong();
        startMusicOnce();
      },
      onNote() { Sound.sfx.note(); startMusicOnce(); },
      onErase() { Sound.sfx.erase(); },
      onHint() { Sound.sfx.hint(); showFX('+30s PENALTY'); },
      onWin(timeMs) {
        Sound.sfx.win();
        Sound.stopMusic();
        musicOn = false;
        lastRankIdx = saveScore(timeMs);
        showFX('CHART DECODED!', true);
      },
    });

    function startMusicOnce() {
      if (!musicOn) {
        Sound.startMusic();
        musicOn = true;
      }
    }

    const renderer = NS.createRenderer(engine, els.board);
    NS.game = engine; // exposed for debugging

    const savedDiff = localStorage.getItem('astroarcade.sudoku.diff');
    if (savedDiff && NS.DIFFS[savedDiff]) engine.setDifficulty(savedDiff);

    function newGame(diff) {
      if (diff) {
        engine.setDifficulty(diff);
        localStorage.setItem('astroarcade.sudoku.diff', diff);
      } else {
        engine.newGame();
      }
      Sound.stopMusic();
      musicOn = false;
      lastRankIdx = -1;
      syncButtons();
    }

    function syncButtons() {
      for (const btn of els.diffBtns) {
        btn.classList.toggle('diff-active', btn.dataset.diff === engine.diffKey);
      }
      els.pencilBtn.classList.toggle('diff-active', pencil);
    }

    /* ---------- Overlay ---------- */

    let lastOverlayState = null;

    function updateOverlay() {
      const o = els.overlay;
      if (engine.status === 'playing') {
        o.hidden = true;
        lastOverlayState = 'live';
        return;
      }
      o.hidden = false;
      const state = engine.status + ':' + Math.round(engine.time) +
        (typeof scrollFree !== 'undefined' && scrollFree ? ':s' : '');
      if (state === lastOverlayState) return;
      lastOverlayState = state;

      if (engine.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap ⏸ to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (engine.status === 'won') {
        els.overlayTitle.textContent = 'CHART DECODED!';
        els.overlayText.textContent =
          'Time ' + fmtTime(engine.time) +
          (engine.hintsUsed ? ' · ' + engine.hintsUsed + ' hint(s)' : '') +
          ' · ENTER for a new chart';
        renderRanking();
      }
    }

    /* ---------- Board input ---------- */

    els.board.style.touchAction = 'none';

    els.board.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'won') {
        newGame();
        return;
      }
      if (engine.status !== 'playing') return;
      const rect = els.board.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * 9);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * 9);
      engine.select(x, y);
    });

    els.board.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- Number pad + tool buttons ---------- */

    for (const btn of els.numBtns) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Sound.unlock();
        const v = Number(btn.dataset.num);
        if (pencil) engine.toggleNote(v);
        else engine.setValue(v);
      });
    }

    function togglePause() {
      if (engine.status === 'won') return;
      engine.togglePause();
      Sound.setPaused(engine.status === 'paused');
    }

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
    }

    function togglePencil() {
      pencil = !pencil;
      syncButtons();
    }

    els.soundBtn.addEventListener('click', () => { Sound.unlock(); toggleSound(); });
    els.pauseBtn.addEventListener('click', () => { Sound.unlock(); togglePause(); });
    els.pencilBtn.addEventListener('click', () => { Sound.unlock(); togglePencil(); });
    els.eraseBtn.addEventListener('click', () => { Sound.unlock(); engine.erase(); });
    els.hintBtn.addEventListener('click', () => { Sound.unlock(); engine.hint(); });
    els.newBtn.addEventListener('click', () => { Sound.unlock(); newGame(); });
    for (const btn of els.diffBtns) {
      btn.addEventListener('click', () => {
        Sound.unlock();
        newGame(btn.dataset.diff);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.repeat && !e.code.startsWith('Arrow')) return;
      Sound.unlock();
      if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
        const v = Number(e.key);
        if (v >= 1 && v <= 9) {
          e.preventDefault();
          if (pencil) engine.toggleNote(v);
          else engine.setValue(v);
          return;
        }
        if (v === 0) engine.erase();
        return;
      }
      switch (e.code) {
        case 'ArrowLeft':  e.preventDefault(); engine.moveSel(-1, 0); Sound.sfx.move(); break;
        case 'ArrowRight': e.preventDefault(); engine.moveSel(1, 0); Sound.sfx.move(); break;
        case 'ArrowUp':    e.preventDefault(); engine.moveSel(0, -1); Sound.sfx.move(); break;
        case 'ArrowDown':  e.preventDefault(); engine.moveSel(0, 1); Sound.sfx.move(); break;
        case 'Backspace':
        case 'Delete':
          engine.erase();
          break;
        case 'KeyN':
          togglePencil();
          break;
        case 'KeyH':
          engine.hint();
          break;
        case 'KeyP':
        case 'Escape':
          togglePause();
          break;
        case 'KeyM':
          toggleSound();
          break;
        case 'Enter':
          if (engine.status === 'won') newGame();
          break;
        case 'KeyR':
          newGame();
          break;
      }
    });

    /* Auto-pause when the window loses focus mid-game. */
    window.addEventListener('blur', () => {
      if (engine.status === 'playing') {
        engine.togglePause();
        Sound.setPaused(true);
      }
    });

    /* A two-finger tap toggles page scrolling on phones. */
    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    let scrollFree = false;
    const activePointers = new Set();

    function setScrollFree(on) {
      scrollFree = on;
      document.documentElement.classList.toggle('scroll-free', on);
      els.board.style.touchAction = on ? 'pan-y' : 'none';
    }

    document.addEventListener('pointerdown', (e) => {
      activePointers.add(e.pointerId);
      if (activePointers.size === 1 && scrollFree && engine.status === 'playing') {
        setScrollFree(false);
        return;
      }
      if (activePointers.size === 2) {
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

    /* ---------- HUD + main loop ---------- */

    function updateHUD() {
      els.time.textContent = fmtTime(engine.time);
      els.hints.textContent = engine.hintsUsed;
      const list = loadScores(engine.diffKey);
      els.bestTime.textContent = list.length ? fmtTime(list[0].t) : '—';
    }

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(now - last, 100);
      last = now;
      engine.update(dt);
      renderer.draw();
      updateHUD();
      updateOverlay();
      requestAnimationFrame(frame);
    }

    syncButtons();
    requestAnimationFrame(frame);
  });

})(window.AstroSudoku);
