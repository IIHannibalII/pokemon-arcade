'use strict';

/* ============================================================
   PokéSnake — main loop, input (keyboard + swipes + D-pad),
   HUD, leaderboard and overlays.
   ============================================================ */

(function (NS) {

  const BEST_KEY = 'pokearcade.snake.best';
  const SCORES_KEY = 'pokearcade.snake.scores';
  const RANKING_SIZE = 5;
  const SWIPE_STEP = 24; // px of finger travel per direction change

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      score: document.getElementById('stat-score'),
      best: document.getElementById('stat-best'),
      length: document.getElementById('stat-length'),
      level: document.getElementById('stat-level'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      fx: document.getElementById('fx'),
      soundBtn: document.getElementById('btn-sound'),
      boardWrap: document.querySelector('.board-wrap'),
      touchControls: document.getElementById('touch-controls'),
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

    function saveScore(score, level, length) {
      if (score <= 0) return -1;
      const list = loadScores();
      const entry = { s: score, v: level, n: length, d: Date.now() };
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
      onCatch(isBonus) {
        if (isBonus) {
          Sound.sfx.bonus();
          showFX('GREAT CATCH! +50', true);
        } else {
          Sound.sfx.catch();
        }
      },
      onBonusSpawn() {
        Sound.sfx.spawn();
        showFX('A GREAT BALL appeared!');
      },
      onLevelUp(level) {
        Sound.sfx.levelUp();
        showFX('LEVEL ' + level + '!');
      },
      onGameOver() {
        Sound.sfx.gameOver();
        Sound.stopMusic();
        if (engine.score > best) {
          best = engine.score;
          localStorage.setItem(BEST_KEY, String(best));
        }
        lastRankIdx = saveScore(engine.score, engine.level, engine.snake.length);
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
      document.querySelectorAll('.js-sound-icon').forEach((el) => {
        el.textContent = muted ? '🔇' : '🔊';
      });
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
        els.overlayTitle.textContent = 'POKéSNAKE';
        els.overlayText.textContent = 'Press ENTER or tap to start';
        renderRanking();
      } else if (engine.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap | | to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (engine.status === 'over') {
        els.overlayTitle.textContent = 'GAME OVER';
        els.overlayText.textContent =
          'The wild snake fainted! · Score ' + engine.score + ' · ENTER to retry';
        renderRanking();
      }
    }

    /* ---------- Keyboard ---------- */

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      Sound.unlock();
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          engine.setDir(-1, 0);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          engine.setDir(1, 0);
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          engine.setDir(0, -1);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          engine.setDir(0, 1);
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

    /* ---------- Swipes on the board ----------
       Slide your finger — every SWIPE_STEP px of travel in the
       dominant axis turns the snake; keep sliding to chain turns. */

    const gesture = { active: false, ax: 0, ay: 0 };

    /* On touch devices the whole page is the gesture surface. */
    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const surface = (coarse && document.querySelector('.snake-layout')) || els.board;

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
      gesture.ax = e.clientX;
      gesture.ay = e.clientY;
    });

    surface.addEventListener('pointermove', (e) => {
      if (!gesture.active) return;
      const dx = e.clientX - gesture.ax;
      const dy = e.clientY - gesture.ay;
      if (Math.abs(dx) < SWIPE_STEP && Math.abs(dy) < SWIPE_STEP) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        engine.setDir(dx > 0 ? 1 : -1, 0);
      } else {
        engine.setDir(0, dy > 0 ? 1 : -1);
      }
      gesture.ax = e.clientX;
      gesture.ay = e.clientY;
    });

    const endGesture = () => { gesture.active = false; };
    surface.addEventListener('pointerup', endGesture);
    surface.addEventListener('pointercancel', endGesture);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- Touch D-pad ---------- */

    els.touchControls.querySelectorAll('button').forEach((btn) => {
      const act = btn.dataset.act;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Sound.unlock();
        if (engine.status === 'ready' || engine.status === 'over') {
          startGame();
          return;
        }
        if (act === 'up') engine.setDir(0, -1);
        else if (act === 'down') engine.setDir(0, 1);
        else if (act === 'left') engine.setDir(-1, 0);
        else if (act === 'right') engine.setDir(1, 0);
        else if (act === 'pause') togglePause();
        else if (act === 'sound') toggleSound();
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    els.soundBtn.addEventListener('click', () => {
      Sound.unlock();
      toggleSound();
    });

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
        gesture.active = false; // don't let finger #1 steer the snake
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
      els.length.textContent = engine.snake.length;
      els.level.textContent = engine.level;
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

})(window.PokeSnake);
