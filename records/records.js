'use strict';

/* ============================================================
   AstroArcade — Hall of Fame.
   Gathers every game's leaderboard from this browser's
   localStorage and renders them on one page.
   ============================================================ */

(function () {

  function load(key) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function fmtSec(ms) {
    return (ms / 1000).toFixed(1) + 's';
  }

  function fmtMin(ms) {
    const total = Math.floor(ms / 1000);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  const DIFF_LABELS = { easy: 'I', medium: 'II', hard: 'III' };

  /* Each section: { title, icon, href, rows: [left, right][] } */
  function sections() {
    const out = [];

    out.push({
      title: 'AstroTetris', icon: '🚀', href: '../games/tetris/index.html',
      rows: load('pokearcade.tetris.scores').map((e, i) =>
        [(i + 1) + '. Lv.' + e.v, String(e.s)]),
    });

    out.push({
      title: 'AstroSnake', icon: '🐛', href: '../games/snake/index.html',
      rows: load('pokearcade.snake.scores').map((e, i) =>
        [(i + 1) + '. Lv.' + e.v, String(e.s)]),
    });

    out.push({
      title: 'AstroBreaker', icon: '🧱', href: '../games/breaker/index.html',
      rows: load('astroarcade.breaker.scores').map((e, i) =>
        [(i + 1) + '. W' + e.v, String(e.s)]),
    });

    const duel = load('astroarcade.duel.scores').map((e, i) =>
      [(i + 1) + '.', '7:' + e.c]);
    const wins = Number(localStorage.getItem('astroarcade.duel.wins') || 0);
    if (wins) duel.unshift(['MATCH WINS', String(wins)]);
    out.push({ title: 'AstroDuel', icon: '🛸', href: '../games/duel/index.html', rows: duel });

    out.push({
      title: 'Astro2048', icon: '▣', href: '../games/2048/index.html',
      rows: load('astroarcade.2048.scores').map((e, i) =>
        [(i + 1) + '. tile ' + e.v, String(e.s)]),
    });

    const perDiff = (base, fmt, extra) => {
      const rows = [];
      for (const d of ['easy', 'medium', 'hard']) {
        load(base + '.' + d).forEach((e, i) => {
          rows.push([
            DIFF_LABELS[d] + ' · ' + (i + 1) + '.' + (extra ? ' ' + extra(e) : ''),
            fmt(e.t),
          ]);
        });
      }
      return rows;
    };

    out.push({
      title: 'AstroSweeper', icon: '🚩', href: '../games/sweeper/index.html',
      rows: perDiff('astroarcade.sweeper.scores', fmtSec),
    });

    out.push({
      title: 'AstroSudoku', icon: '🧠', href: '../games/sudoku/index.html',
      rows: perDiff('astroarcade.sudoku.scores', fmtMin),
    });

    out.push({
      title: 'AstroMemory', icon: '🃏', href: '../games/memory/index.html',
      rows: perDiff('astroarcade.memory.scores', fmtSec, (e) => e.m + ' mv'),
    });

    return out;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('records-grid');
    for (const sec of sections()) {
      const box = document.createElement('section');
      box.className = 'record-box';

      const h = document.createElement('h2');
      const link = document.createElement('a');
      link.href = sec.href;
      link.textContent = sec.icon + ' ' + sec.title;
      h.appendChild(link);
      box.appendChild(h);

      if (!sec.rows.length) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.textContent = 'No records yet — go play!';
        box.appendChild(p);
      } else {
        const ol = document.createElement('ol');
        for (const [left, right] of sec.rows.slice(0, 8)) {
          const li = document.createElement('li');
          const l = document.createElement('span');
          l.textContent = left;
          const r = document.createElement('span');
          r.className = 'r-score';
          r.textContent = right;
          li.append(l, r);
          ol.appendChild(li);
        }
        box.appendChild(ol);
      }
      grid.appendChild(box);
    }
  });

})();
