'use strict';

/* ============================================================
   AstroBreaker — main loop, input (keys / mouse / touch), HUD,
   leaderboard and overlays.
   ============================================================ */

(function (NS) {

  const BEST_KEY = 'astroarcade.breaker.best';
  const SCORES_KEY = 'astroarcade.breaker.scores';
  const RANKING_SIZE = 5;

  const FX_TEXT = {
    wide: 'WIDE SHIP!',
    slow: 'SLOW ORB!',
    multi: 'MULTIBALL!',
    life: '+1 SHIP!',
  };

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      score: document.getElementById('stat-score'),
      best: document.getElementById('stat-best'),
      wave: document.getElementById('stat-wave'),
      ships: document.getElementById('stat-ships'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      soundBtn: document.getElementById('btn-sound'),
      pauseBtn: document.getElementById('btn-pause'),
    };

    const Sound = NS.Sound;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let lastRankIdx = -1;

    /* ---------- Leaderboard ---------- */

    function loadScores() {
      try {
        const list = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveScore(score, wave) {
      if (score <= 0) return -1;
      const list = loadScores();
      const entry = { s: score, v: wave, d: Date.now() };
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
        rank.textContent = (i + 1) + '. W' + e.v;
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = e.s;
        li.append(rank, score);
        els.ranking.appendChild(li);
      });
    }

    /* ---------- FX label ---------- */

    function showFX(text, legendary) {
      els.fx.textContent = text;
      els.fx.classList.remove('fx--run', 'fx--legendary');
      void els.fx.offsetWidth;
      if (legendary) els.fx.classList.add('fx--legendary');
      els.fx.classList.add('fx--run');
    }

    /* ---------- Engine + hooks ---------- */

    const engine = new NS.Engine({
      onBrick(destroyed) {
        if (destroyed) Sound.sfx.brick();
        else Sound.sfx.armor();
      },
      onPaddleHit() { Sound.sfx.paddle(); },
      onLaunch() { Sound.sfx.launch(); },
      onPowerup(kind) {
        if (kind === 'multi') Sound.sfx.multi();
        else if (kind === 'life') Sound.sfx.life();
        else Sound.sfx.powerup();
        showFX(FX_TEXT[kind], kind === 'multi' || kind === 'life');
      },
      onLifeLost() {
        Sound.sfx.lost();
        showFX('SHIP LOST!');
      },
      onLevelUp(level) {
        Sound.sfx.wave();
        showFX('WAVE ' + level + '!', true);
      },
      onGameOver() {
        Sound.sfx.gameOver();
        Sound.stopMusic();
        if (engine.score > best) {
          best = engine.score;
          localStorage.setItem(BEST_KEY, String(best));
        }
        lastRankIdx = saveScore(engine.score, engine.level);
      },
    });

    const renderer = NS.createRenderer(engine, els.board);
    NS.game = engine; // exposed for debugging

    function startGame() {
      engine.start();
      Sound.startMusic();
      Sound.setPaused(false);
    }

    function togglePause() {
      engine.togglePause();
      Sound.setPaused(engine.status === 'paused');
    }

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
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
      if (state === lastOverlayState) return;
      lastOverlayState = state;

      if (engine.status === 'ready') {
        els.overlayTitle.textContent = 'ASTROBREAKER';
        els.overlayText.textContent = 'Press ENTER or tap to start';
        renderRanking();
      } else if (engine.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap ⏸ to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (engine.status === 'over') {
        els.overlayTitle.textContent = 'GAME OVER';
        els.overlayText.textContent =
          'The fleet is lost! · Score ' + engine.score + ' · ENTER to retry';
        renderRanking();
      }
    }

    /* ---------- Keyboard ---------- */

    const held = { left: false, right: false };

    function syncKeys() {
      engine.setKeys(held.left === held.right ? 0 : (held.left ? -1 : 1));
    }

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      Sound.unlock();
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          held.left = true;
          syncKeys();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          held.right = true;
          syncKeys();
          break;
        case 'Space':
        case 'ArrowUp':
          e.preventDefault();
          engine.launch();
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
          else engine.launch();
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
        case 'KeyA':
          held.left = false;
          syncKeys();
          break;
        case 'ArrowRight':
        case 'KeyD':
          held.right = false;
          syncKeys();
          break;
      }
    });

    /* ---------- Pointer: the ship follows the finger / mouse ---------- */

    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const surface = (coarse && document.querySelector('.breaker-layout')) || els.board;

    els.board.style.touchAction = 'none';
    surface.style.touchAction = 'none';

    function paddleFromEvent(e) {
      const rect = els.board.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * NS.CONST.W;
      engine.setPaddleX(x);
    }

    const gesture = { active: false, x0: 0, y0: 0, t0: 0 };

    surface.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') {
        startGame();
        return;
      }
      gesture.active = true;
      gesture.x0 = e.clientX;
      gesture.y0 = e.clientY;
      gesture.t0 = performance.now();
      paddleFromEvent(e);
    });

    surface.addEventListener('pointermove', (e) => {
      // mouse steers without pressing; touch steers while pressed
      if (e.pointerType === 'mouse' || gesture.active) paddleFromEvent(e);
    });

    surface.addEventListener('pointerup', (e) => {
      if (!gesture.active) return;
      gesture.active = false;
      const dt = performance.now() - gesture.t0;
      const moved = Math.abs(e.clientX - gesture.x0) + Math.abs(e.clientY - gesture.y0);
      if (dt < 300 && moved < 14) engine.launch(); // tap launches the orb
    });
    surface.addEventListener('pointercancel', () => { gesture.active = false; });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    els.board.addEventListener('click', () => { /* click-to-launch handled via pointerup */ });

    /* ---------- Header buttons ---------- */

    els.soundBtn.addEventListener('click', () => {
      Sound.unlock();
      toggleSound();
    });

    els.pauseBtn.addEventListener('click', () => {
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') startGame();
      else togglePause();
    });

    /* Auto-pause when the window loses focus mid-game. */
    window.addEventListener('blur', () => {
      if (engine.status === 'playing') {
        engine.togglePause();
        Sound.setPaused(true);
      }
    });

    /* A two-finger tap toggles page scrolling on phones. */
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
        setScrollFree(false);
        return;
      }
      if (activePointers.size === 2) {
        gesture.active = false;
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
      els.score.textContent = engine.score;
      els.best.textContent = Math.max(best, engine.score);
      els.wave.textContent = engine.level;
      els.ships.textContent = '🚀'.repeat(Math.max(0, Math.min(engine.lives, 5))) || '—';
    }

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(now - last, 100);
      last = now;
      engine.update(dt);
      renderer.draw(now);
      updateHUD();
      updateOverlay();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });

})(window.AstroBreaker);
