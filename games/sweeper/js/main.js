'use strict';

/* ============================================================
   AstroSweeper — input (click / right-click / long-press /
   beacon mode), HUD, per-difficulty best times and overlays.
   ============================================================ */

(function (NS) {

  const RANKING_SIZE = 5;
  const LONG_PRESS_MS = 420;

  function scoresKey(diff) {
    return 'astroarcade.sweeper.scores.' + diff;
  }

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      mines: document.getElementById('stat-mines'),
      time: document.getElementById('stat-time'),
      bestTime: document.getElementById('stat-besttime'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      soundBtn: document.getElementById('btn-sound'),
      pauseBtn: document.getElementById('btn-pause'),
      flagBtn: document.getElementById('btn-flag'),
      newBtn: document.getElementById('btn-new'),
      diffBtns: [...document.querySelectorAll('[data-diff]')],
    };

    const Sound = NS.Sound;
    let flagMode = false;
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
      list.sort((a, b) => a.t - b.t || a.d - b.d); // fastest first
      const top = list.slice(0, RANKING_SIZE);
      localStorage.setItem(scoresKey(engine.diffKey), JSON.stringify(top));
      return top.indexOf(entry);
    }

    function fmtTime(ms) {
      return (ms / 1000).toFixed(1) + 's';
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

    /* ---------- FX ---------- */

    function showFX(text, legendary) {
      els.fx.textContent = text;
      els.fx.classList.remove('fx--run', 'fx--legendary');
      void els.fx.offsetWidth;
      if (legendary) els.fx.classList.add('fx--legendary');
      els.fx.classList.add('fx--run');
    }

    /* ---------- Engine + hooks ---------- */

    const engine = new NS.Engine({
      onReveal(count) {
        if (count > 6) Sound.sfx.bigReveal();
        else Sound.sfx.reveal();
        if (!musicOn) {
          Sound.startMusic();
          musicOn = true;
        }
      },
      onFlag(placed) {
        if (placed) Sound.sfx.flag();
        else Sound.sfx.unflag();
      },
      onChord() { Sound.sfx.chord(); },
      onBoom() {
        Sound.sfx.boom();
        Sound.stopMusic();
        musicOn = false;
      },
      onWin(timeMs) {
        Sound.sfx.win();
        Sound.stopMusic();
        musicOn = false;
        lastRankIdx = saveScore(timeMs);
        showFX('SECTOR CLEARED!', true);
      },
    });

    const renderer = NS.createRenderer(engine, els.board);
    NS.game = engine; // exposed for debugging

    const savedDiff = localStorage.getItem('astroarcade.sweeper.diff');
    if (savedDiff && NS.DIFFS[savedDiff]) engine.setDifficulty(savedDiff);

    function newGame(diff) {
      if (diff) {
        engine.setDifficulty(diff);
        localStorage.setItem('astroarcade.sweeper.diff', diff);
      } else {
        engine.reset();
      }
      Sound.stopMusic();
      musicOn = false;
      lastRankIdx = -1;
      syncDiffButtons();
    }

    function syncDiffButtons() {
      for (const btn of els.diffBtns) {
        btn.classList.toggle('diff-active', btn.dataset.diff === engine.diffKey);
      }
    }

    /* ---------- Overlay ---------- */

    let lastOverlayState = null;

    function updateOverlay() {
      const o = els.overlay;
      if (engine.status === 'idle' || engine.status === 'playing') {
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
        els.overlayTitle.textContent = 'SECTOR CLEARED!';
        els.overlayText.textContent =
          'Time ' + fmtTime(engine.time) + ' · ENTER for a new scan';
        renderRanking();
      } else if (engine.status === 'lost') {
        els.overlayTitle.textContent = 'SHIP DESTROYED';
        els.overlayText.textContent =
          'You hit an asteroid! · ENTER to retry';
        renderRanking();
      }
    }

    /* ---------- Board input ---------- */

    function cellFromEvent(e) {
      const rect = els.board.getBoundingClientRect();
      const { cell, ox, oy } = renderer.metrics();
      const px = ((e.clientX - rect.left) / rect.width) * NS.CANVAS;
      const py = ((e.clientY - rect.top) / rect.height) * NS.CANVAS;
      return [Math.floor((px - ox) / cell), Math.floor((py - oy) / cell)];
    }

    function actOn(x, y, flag) {
      if (engine.status === 'won' || engine.status === 'lost') {
        newGame();
        return;
      }
      const cell = engine.grid[y] && engine.grid[y][x];
      if (!cell) return;
      if (flag) {
        engine.toggleFlag(x, y);
      } else if (cell.revealed && cell.n > 0) {
        engine.chord(x, y);
      } else {
        engine.reveal(x, y);
      }
    }

    const press = { active: false, id: 0, x: 0, y: 0, timer: 0, longFired: false };

    els.board.style.touchAction = 'none';

    els.board.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (press.timer) clearTimeout(press.timer);
      if (e.button === 2) {
        // right mouse button places a beacon immediately
        const [cx, cy] = cellFromEvent(e);
        engine.toggleFlag(cx, cy);
        press.active = false;
        return;
      }
      press.active = true;
      press.id = e.pointerId;
      press.x = e.clientX;
      press.y = e.clientY;
      press.longFired = false;
      const [cx, cy] = cellFromEvent(e);
      press.timer = setTimeout(() => {
        // long-press places a beacon
        if (press.active && press.id === e.pointerId) {
          press.longFired = true;
          engine.toggleFlag(cx, cy);
        }
      }, LONG_PRESS_MS);
    });

    els.board.addEventListener('pointermove', (e) => {
      if (press.active && press.id === e.pointerId) {
        if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 12) {
          clearTimeout(press.timer);
        }
      }
    });

    els.board.addEventListener('pointerup', (e) => {
      if (!press.active || press.id !== e.pointerId) return;
      press.active = false;
      clearTimeout(press.timer);
      if (press.longFired) return;
      const moved = Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
      if (moved > 12) return;
      const [cx, cy] = cellFromEvent(e);
      actOn(cx, cy, flagMode);
    });

    els.board.addEventListener('pointercancel', () => {
      press.active = false;
      clearTimeout(press.timer);
    });

    // flagging is handled on pointerdown; just suppress the menu
    els.board.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- Buttons + keyboard ---------- */

    function togglePause() {
      engine.togglePause();
      Sound.setPaused(engine.status === 'paused');
    }

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
    }

    function toggleFlagMode() {
      flagMode = !flagMode;
      els.flagBtn.classList.toggle('diff-active', flagMode);
    }

    els.soundBtn.addEventListener('click', () => { Sound.unlock(); toggleSound(); });
    els.pauseBtn.addEventListener('click', () => { Sound.unlock(); togglePause(); });
    els.flagBtn.addEventListener('click', () => { Sound.unlock(); toggleFlagMode(); });
    els.newBtn.addEventListener('click', () => { Sound.unlock(); newGame(); });
    for (const btn of els.diffBtns) {
      btn.addEventListener('click', () => {
        Sound.unlock();
        newGame(btn.dataset.diff);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      Sound.unlock();
      switch (e.code) {
        case 'KeyP':
        case 'Escape':
          togglePause();
          break;
        case 'KeyM':
          toggleSound();
          break;
        case 'KeyF':
          toggleFlagMode();
          break;
        case 'Enter':
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
        press.active = false;
        clearTimeout(press.timer);
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
      els.mines.textContent = Math.max(0, engine.diff.mines - engine.flags);
      els.time.textContent = fmtTime(engine.time);
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

    syncDiffButtons();
    requestAnimationFrame(frame);
  });

})(window.AstroSweeper);
