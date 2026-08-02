'use strict';

/* ============================================================
   AstroTetris — partner rocket.
   An original ship drawn as 16x16 pixel art in code. It gets
   upgraded as the level grows:
   SCOUT (Lv.1) → SHUTTLE (Lv.5) → STARSHIP (Lv.10).
   ============================================================ */

(function (NS) {

  const PALETTE = {
    D: '#212121', // outline
    W: '#f4f6fb', // hull white
    R: '#ee1515', // nose & fins
    C: '#7fc7ff', // window glass
    G: '#9aa3b2', // gray details
    O: '#f08030', // flame outer
    Y: '#ffcb05', // flame inner
  };

  const STAGES = [
    {
      name: 'SCOUT',
      minLevel: 1,
      sprite: [
        '................',
        '.......DD.......',
        '......DRRD......',
        '......DRRD......',
        '.....DRRRRD.....',
        '.....DWWWWD.....',
        '....DWWCCWWD....',
        '....DWWCCWWD....',
        '....DWWWWWWD....',
        '....DWWWWWWD....',
        '...DRDWWWWDRD...',
        '..DRRDWWWWDRRD..',
        '..DRRDDDDDDRRD..',
        '....DOYYYOD.....',
        '.....OYYO.......',
        '......YY........',
      ],
    },
    {
      name: 'SHUTTLE',
      minLevel: 5,
      sprite: [
        '................',
        '.......DD.......',
        '......DWWD......',
        '.....DWWWWD.....',
        '.....DWCCWD.....',
        '.....DWCCWD.....',
        '..DD.DWWWWD.DD..',
        '.DRRDDWWWWDDRRD.',
        '.DRRDWWWWWWDRRD.',
        '.DRRDWWWWWWDRRD.',
        '.DRRDWWWWWWDRRD.',
        '.DRRDDWWWWDDRRD.',
        '.DDDDDDDDDDDDDD.',
        '..OY.DOYYOD.YO..',
        '..YY..OYYO..YY..',
        '.......YY.......',
      ],
    },
    {
      name: 'STARSHIP',
      minLevel: 10,
      sprite: [
        '.......DD.......',
        '......DRRD......',
        '......DRRD......',
        '.....DWWWWD.....',
        '.....DWCCWD.....',
        '.....DWCCWD.....',
        '.....DWWWWD.....',
        '....DWGGGGWD....',
        '....DWGCCGWD....',
        '....DWGCCGWD....',
        '...DWWGGGGWWD...',
        '..DRWWWWWWWWRD..',
        '.DRRDWWWWWWDRRD.',
        'DRRD.DOYYOD.DRRD',
        'DDD..OYYYYO..DDD',
        '......YYYY......',
      ],
    },
  ];

  function stageForLevel(level) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (level >= STAGES[i].minLevel) idx = i;
    }
    return idx;
  }

  /**
   * Draw a stage onto a canvas 2d context, scaled to fit.
   * opts.silhouette paints every pixel white — used for the
   * upgrade flash.
   */
  function draw(canvasCtx, stageIdx, opts) {
    const canvas = canvasCtx.canvas;
    const sprite = STAGES[stageIdx].sprite;
    const scale = Math.floor(canvas.width / 16);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const ch = sprite[y][x];
        if (ch === '.') continue;
        canvasCtx.fillStyle = (opts && opts.silhouette) ? '#ffffff' : PALETTE[ch];
        canvasCtx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  NS.Mascot = { STAGES, stageForLevel, draw };

})(window.PokeTetris);
