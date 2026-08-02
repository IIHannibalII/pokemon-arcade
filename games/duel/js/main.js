'use strict';

/* ============================================================
   AstroDuel — main loop, input (keys / mouse / touch-follow),
   HUD, match leaderboard and overlays.
   ============================================================ */

(function (NS) {

  const SCORES_KEY = 'astroarcade.duel.scores';
  const WINS_KEY = 'astroarcade.duel.wins';
  const RANKING_SIZE = 5;

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      board: document.getElementById('board'),
      you: document.getElementById('stat-you'),
      cpu: document.getElementById('stat-cpu'),
      wins: document.getElementById('stat-wins'),
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
    let wins = Number(localStorage.getItem(WINS_KEY) || 0);
    let lastRankIdx = -1;

    /* ---------- Match results leaderboard (best margins) ---------- */

    function loadScores() {
      try {
        const list = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveMatch(cpuScore) {
      const list = loadScores();
      const entry = { c: cpuScore, d: Date.now() };
      list.push(entry);
      list.sort((a, b) => a.c - b.c || a.d - b.d); // cleanest wins first
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
        if (i === lastRankIdx && engine.status === 'over' && engine.playerWon) {
          li.className = 'r-new';
        }
        const rank = document.createElement('span');
        rank.textContent = (i + 1) + '.';
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = NS.CONST.WIN_SCORE + ':' + e.c;
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
      onPaddleHit(byPlayer) {
        if (byPlayer) Sound.sfx.you();
        else Sound.sfx.cpu();
      },
      onWall() { Sound.sfx.wall(); },
      onServe() { Sound.sfx.serve(); },
      onGoal(byPlayer) {
        if (byPlayer) {
          Sound.sfx.goalYou();
          showFX('GOAL!');
        } else {
          Sound.sfx.goalCpu();
          showFX('SAUCER SCORES!');
        }
        const w = NS.CONST.WIN_SCORE - 1;
        if (engine.status === 'playing' &&
            (engine.scoreYou === w || engine.scoreCpu === w)) {
          setTimeout(() => showFX('MATCH POINT!', true), 900);
        }
      },
      onMatchEnd(playerWon) {
        Sound.stopMusic();
        if (playerWon) {
          Sound.sfx.victory();
          wins++;
          localStorage.setItem(WINS_KEY, String(wins));
          lastRankIdx = saveMatch(engine.scoreCpu);
        } else {
          Sound.sfx.defeat();
          lastRankIdx = -1;
        }
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
      const state = engine.status + ':' + engine.scoreYou + ':' + engine.scoreCpu +
        (typeof scrollFree !== 'undefined' && scrollFree ? ':s' : '');
      if (state === lastOverlayState) return;
      lastOverlayState = state;

      if (engine.status === 'ready') {
        els.overlayTitle.textContent = 'ASTRODUEL';
        els.overlayText.textContent =
          'First to ' + NS.CONST.WIN_SCORE + ' beats the saucer · ENTER or tap to start';
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
        els.overlayTitle.textContent = engine.playerWon ? 'VICTORY!' : 'DEFEAT';
        els.overlayText.textContent =
          engine.scoreYou + ':' + engine.scoreCpu +
          (engine.playerWon ? ' · The saucer flees!' : ' · The saucer gloats…') +
          ' · ENTER for a rematch';
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
    const surface = (coarse && document.querySelector('.duel-layout')) || els.board;

    els.board.style.touchAction = 'none';
    surface.style.touchAction = 'none';

    function paddleFromEvent(e) {
      const rect = els.board.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * NS.CONST.W;
      engine.setPaddleX(x);
    }

    const gesture = { active: false };

    surface.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (engine.status === 'ready' || engine.status === 'over') {
        startGame();
        return;
      }
      gesture.active = true;
      paddleFromEvent(e);
    });

    surface.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || gesture.active) paddleFromEvent(e);
    });

    surface.addEventListener('pointerup', () => { gesture.active = false; });
    surface.addEventListener('pointercancel', () => { gesture.active = false; });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- Header buttons ---------- */

    els.soundBtn.addEventListener('click', () => { Sound.unlock(); toggleSound(); });
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
      els.you.textContent = engine.scoreYou;
      els.cpu.textContent = engine.scoreCpu;
      els.wins.textContent = wins;
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

})(window.AstroDuel);
