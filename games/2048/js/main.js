'use strict';

/* ============================================================
   Astro2048 — input (arrows / WASD / swipes), HUD, score
   leaderboard and overlays.
   ============================================================ */

(function (NS) {

  const BEST_KEY = 'astroarcade.2048.best';
  const SCORES_KEY = 'astroarcade.2048.scores';
  const RANKING_SIZE = 5;
  const SWIPE_MIN = 28;

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      score: document.getElementById('stat-score'),
      best: document.getElementById('stat-best'),
      tile: document.getElementById('stat-tile'),
      moves: document.getElementById('stat-moves'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      soundBtn: document.getElementById('btn-sound'),
      pauseBtn: document.getElementById('btn-pause'),
      newBtn: document.getElementById('btn-new'),
    };

    const Sound = NS.Sound;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let lastRankIdx = -1;
    let musicOn = false;

    /* ---------- Leaderboard ---------- */

    function loadScores() {
      try {
        const list = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveScore(score, bestTile) {
      if (score <= 0) return -1;
      const list = loadScores();
      const entry = { s: score, v: bestTile, d: Date.now() };
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
        rank.textContent = (i + 1) + '. ▣' + e.v;
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = e.s;
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
      onMove(moved) {
        if (moved) {
          renderer.kick();
          Sound.sfx.slide();
          startMusicOnce();
        } else {
          Sound.sfx.stuck();
        }
      },
      onMerge(gained) { Sound.sfx.merge(gained); },
      onWin() {
        Sound.sfx.win();
        showFX('STARCORE 2048!', true);
      },
      onGameOver() {
        Sound.sfx.gameOver();
        Sound.stopMusic();
        musicOn = false;
        if (engine.score > best) {
          best = engine.score;
          localStorage.setItem(BEST_KEY, String(best));
        }
        lastRankIdx = saveScore(engine.score, engine.bestTile());
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
    NS.renderer = renderer;

    function newGame() {
      engine.reset();
      renderer.kick();
      Sound.stopMusic();
      musicOn = false;
      lastRankIdx = -1;
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

      if (engine.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap ⏸ to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (engine.status === 'over') {
        els.overlayTitle.textContent = 'GRID JAMMED';
        els.overlayText.textContent =
          'Score ' + engine.score + ' · best tile ' + engine.bestTile() +
          ' · ENTER to retry';
        renderRanking();
      }
    }

    /* ---------- Input ---------- */

    function doMove(dx, dy) {
      if (engine.status === 'over') return;
      engine.move(dx, dy);
    }

    document.addEventListener('keydown', (e) => {
      Sound.unlock();
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          doMove(-1, 0);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          doMove(1, 0);
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          doMove(0, -1);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          doMove(0, 1);
          break;
        case 'KeyP':
        case 'Escape':
          if (e.repeat) return;
          if (engine.status !== 'over') {
            engine.togglePause();
            Sound.setPaused(engine.status === 'paused');
          }
          break;
        case 'KeyM':
          if (e.repeat) return;
          toggleSound();
          break;
        case 'Enter':
          if (engine.status === 'over') newGame();
          break;
        case 'KeyR':
          if (e.repeat) return;
          newGame();
          break;
      }
    });

    /* Swipes on the board (whole page on touch devices). */

    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const surface = (coarse && document.querySelector('.g2048-layout')) || els.board;

    els.board.style.touchAction = 'none';
    surface.style.touchAction = 'none';

    const gesture = { active: false, x0: 0, y0: 0 };

    surface.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'over') {
        newGame();
        return;
      }
      gesture.active = true;
      gesture.x0 = e.clientX;
      gesture.y0 = e.clientY;
    });

    surface.addEventListener('pointerup', (e) => {
      if (!gesture.active) return;
      gesture.active = false;
      const dx = e.clientX - gesture.x0;
      const dy = e.clientY - gesture.y0;
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 1 : -1, 0);
      else doMove(0, dy > 0 ? 1 : -1);
    });

    surface.addEventListener('pointercancel', () => { gesture.active = false; });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- Header buttons ---------- */

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
    }

    els.soundBtn.addEventListener('click', () => { Sound.unlock(); toggleSound(); });
    els.pauseBtn.addEventListener('click', () => {
      Sound.unlock();
      if (engine.status !== 'over') {
        engine.togglePause();
        Sound.setPaused(engine.status === 'paused');
      }
    });
    els.newBtn.addEventListener('click', () => { Sound.unlock(); newGame(); });

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
      els.tile.textContent = engine.bestTile();
      els.moves.textContent = engine.moves;
    }

    let last = performance.now();

    function frame(now) {
      last = now;
      renderer.draw(now);
      updateHUD();
      updateOverlay();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });

})(window.Astro2048);
