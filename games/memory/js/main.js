'use strict';

/* ============================================================
   AstroMemory — DOM card grid with CSS flips.
   Find all the pairs of space objects; fewest seconds wins.
   ============================================================ */

(function (NS) {

  const RANKING_SIZE = 5;

  const DIFFS = {
    easy:   { label: '4×4', cols: 4, pairs: 8 },
    medium: { label: '6×5', cols: 6, pairs: 15 },
    hard:   { label: '6×6', cols: 6, pairs: 18 },
  };

  const ICONS = ['🚀', '🛸', '⭐', '🌙', '🪐', '☄', '✨', '👽', '🌍',
                 '💫', '🔭', '🛰', '⚡', '❄', '🔥', '🌈', '🌞', '🎇'];

  function scoresKey(diff) {
    return 'astroarcade.memory.scores.' + diff;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  document.addEventListener('DOMContentLoaded', () => {

    const els = {
      grid: document.getElementById('cards'),
      wrap: document.querySelector('.cards-wrap'),
      moves: document.getElementById('stat-moves'),
      time: document.getElementById('stat-time'),
      bestTime: document.getElementById('stat-besttime'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      rankingBox: document.getElementById('ranking-box'),
      ranking: document.getElementById('ranking'),
      soundBtn: document.getElementById('btn-sound'),
      pauseBtn: document.getElementById('btn-pause'),
      newBtn: document.getElementById('btn-new'),
      diffBtns: [...document.querySelectorAll('[data-diff]')],
    };

    const Sound = NS.Sound;

    const game = {
      diffKey: localStorage.getItem('astroarcade.memory.diff') || 'easy',
      status: 'idle', // idle | playing | paused | won
      time: 0,
      moves: 0,
      matched: 0,
      open: [],       // currently face-up unmatched cards (max 2)
      lock: false,
      cards: [],
    };
    if (!DIFFS[game.diffKey]) game.diffKey = 'easy';
    NS.game = game; // exposed for debugging

    let lastRankIdx = -1;
    let musicOn = false;

    /* ---------- Best times ---------- */

    function loadScores(diff) {
      try {
        const list = JSON.parse(localStorage.getItem(scoresKey(diff)) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveScore(timeMs, moves) {
      const list = loadScores(game.diffKey);
      const entry = { t: Math.round(timeMs), m: moves, d: Date.now() };
      list.push(entry);
      list.sort((a, b) => a.t - b.t || a.d - b.d);
      const top = list.slice(0, RANKING_SIZE);
      localStorage.setItem(scoresKey(game.diffKey), JSON.stringify(top));
      return top.indexOf(entry);
    }

    function fmtTime(ms) {
      return (ms / 1000).toFixed(1) + 's';
    }

    function renderRanking() {
      const list = loadScores(game.diffKey);
      els.rankingBox.hidden = list.length === 0;
      els.ranking.innerHTML = '';
      list.forEach((e, i) => {
        const li = document.createElement('li');
        if (i === lastRankIdx && game.status === 'won') li.className = 'r-new';
        const rank = document.createElement('span');
        rank.textContent = (i + 1) + '. ' + e.m + ' mv';
        const score = document.createElement('span');
        score.className = 'r-score';
        score.textContent = fmtTime(e.t);
        li.append(rank, score);
        els.ranking.appendChild(li);
      });
    }

    /* ---------- Deal ---------- */

    function newGame(diff) {
      if (diff && DIFFS[diff]) {
        game.diffKey = diff;
        localStorage.setItem('astroarcade.memory.diff', diff);
      }
      const d = DIFFS[game.diffKey];
      game.status = 'idle';
      game.time = 0;
      game.moves = 0;
      game.matched = 0;
      game.open = [];
      game.lock = false;
      lastRankIdx = -1;
      Sound.stopMusic();
      musicOn = false;

      const icons = shuffle(ICONS.slice()).slice(0, d.pairs);
      const deck = shuffle([...icons, ...icons]);
      els.grid.style.gridTemplateColumns = 'repeat(' + d.cols + ', 1fr)';
      els.grid.innerHTML = '';
      game.cards = deck.map((icon, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card';
        btn.innerHTML =
          '<span class="card-inner">' +
          '<span class="card-face card-back">✦</span>' +
          '<span class="card-face card-front">' + icon + '</span>' +
          '</span>';
        const card = { icon, btn, matched: false, open: false, idx: i };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          Sound.unlock();
          flip(card);
        });
        els.grid.appendChild(btn);
        return card;
      });
      syncDiffButtons();
    }

    function syncDiffButtons() {
      for (const btn of els.diffBtns) {
        btn.classList.toggle('diff-active', btn.dataset.diff === game.diffKey);
      }
    }

    /* ---------- Flip logic ---------- */

    function flip(card) {
      if (game.status === 'won') {
        newGame();
        return;
      }
      if (game.status === 'paused' || game.lock || card.matched || card.open) return;

      if (game.status === 'idle') {
        game.status = 'playing';
      }
      if (!musicOn) {
        Sound.startMusic();
        musicOn = true;
      }

      Sound.sfx.flip();
      card.open = true;
      card.btn.classList.add('open');
      game.open.push(card);

      if (game.open.length === 2) {
        game.moves++;
        const [a, b] = game.open;
        if (a.icon === b.icon) {
          a.matched = b.matched = true;
          a.btn.classList.add('matched');
          b.btn.classList.add('matched');
          game.open = [];
          game.matched++;
          Sound.sfx.match();
          if (game.matched === DIFFS[game.diffKey].pairs) {
            game.status = 'won';
            Sound.sfx.win();
            Sound.stopMusic();
            musicOn = false;
            lastRankIdx = saveScore(game.time, game.moves);
          }
        } else {
          game.lock = true;
          setTimeout(() => {
            Sound.sfx.miss();
            a.open = b.open = false;
            a.btn.classList.remove('open');
            b.btn.classList.remove('open');
            game.open = [];
            game.lock = false;
          }, 700);
        }
      }
    }

    /* ---------- Pause / sound / difficulty ---------- */

    function togglePause() {
      if (game.status === 'playing') game.status = 'paused';
      else if (game.status === 'paused') game.status = 'playing';
      Sound.setPaused(game.status === 'paused');
    }

    function toggleSound() {
      const muted = Sound.toggleMute();
      els.soundBtn.textContent = muted ? '🔇' : '🔊';
    }

    els.soundBtn.addEventListener('click', () => { Sound.unlock(); toggleSound(); });
    els.pauseBtn.addEventListener('click', () => { Sound.unlock(); togglePause(); });
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
        case 'Enter':
        case 'KeyR':
          newGame();
          break;
      }
    });

    /* Auto-pause when the window loses focus mid-game. */
    window.addEventListener('blur', () => {
      if (game.status === 'playing') togglePause();
    });

    /* A two-finger tap toggles page scrolling on phones. */
    const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    let scrollFree = false;
    const activePointers = new Set();

    function setScrollFree(on) {
      scrollFree = on;
      document.documentElement.classList.toggle('scroll-free', on);
    }

    document.addEventListener('pointerdown', (e) => {
      activePointers.add(e.pointerId);
      if (activePointers.size === 1 && scrollFree && game.status === 'playing') {
        setScrollFree(false);
        return;
      }
      if (activePointers.size === 2) {
        if (!scrollFree && game.status === 'playing') togglePause();
        setScrollFree(!scrollFree);
      }
    });

    const releasePointer = (e) => activePointers.delete(e.pointerId);
    document.addEventListener('pointerup', releasePointer);
    document.addEventListener('pointercancel', releasePointer);

    /* ---------- Overlay + HUD + loop ---------- */

    let lastOverlayState = null;

    function updateOverlay() {
      const o = els.overlay;
      if (game.status === 'idle' || game.status === 'playing') {
        o.hidden = true;
        lastOverlayState = 'live';
        return;
      }
      o.hidden = false;
      const state = game.status + ':' + Math.round(game.time) + (scrollFree ? ':s' : '');
      if (state === lastOverlayState) return;
      lastOverlayState = state;

      if (game.status === 'paused') {
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayText.textContent = coarse
          ? (scrollFree
              ? 'Scrolling ON · two-finger tap to lock'
              : 'Tap ⏸ to resume · two-finger tap to scroll')
          : 'Press P to resume';
        els.rankingBox.hidden = true;
      } else if (game.status === 'won') {
        els.overlayTitle.textContent = 'ALL PAIRS FOUND!';
        els.overlayText.textContent =
          'Time ' + fmtTime(game.time) + ' · ' + game.moves +
          ' moves · ENTER for a new deal';
        renderRanking();
      }
    }

    function updateHUD() {
      els.moves.textContent = game.moves;
      els.time.textContent = fmtTime(game.time);
      const list = loadScores(game.diffKey);
      els.bestTime.textContent = list.length ? fmtTime(list[0].t) : '—';
    }

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(now - last, 100);
      last = now;
      if (game.status === 'playing') game.time += dt;
      updateHUD();
      updateOverlay();
      requestAnimationFrame(frame);
    }

    NS.newGame = newGame;
    NS.flip = flip;
    newGame();
    requestAnimationFrame(frame);
  });

})(window.AstroMemory = window.AstroMemory || {});
