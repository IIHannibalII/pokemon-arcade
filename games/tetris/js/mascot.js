'use strict';

/* ============================================================
   PokéTetris — partner mascot.
   Sprite-based partner: Pikachu evolving into Raichu (Lv.5)
   and Alolan Raichu (Lv.10). Sprites are fan-art pixel images
   generated locally (ComfyUI + SDXL), stored in
   assets/img/partner/.
   ============================================================ */

(function (NS) {

  const SPRITE_BASE = '../../assets/img/partner/';

  const STAGES = [
    { name: 'PIKACHU', minLevel: 1, file: 'pikachu.png' },
    { name: 'RAICHU', minLevel: 5, file: 'raichu.png' },
    { name: 'ALOLAN RAICHU', minLevel: 10, file: 'raichu-alola.png' },
  ];

  for (const stage of STAGES) {
    stage.img = new Image();
    stage.img.src = SPRITE_BASE + stage.file;
  }

  function stageForLevel(level) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (level >= STAGES[i].minLevel) idx = i;
    }
    return idx;
  }

  let silCanvas = null; // offscreen buffer for the evolution flash

  /**
   * Draw a stage onto a canvas 2d context, scaled to fit.
   * opts.silhouette paints the whole sprite white — used for
   * the evolution flash.
   */
  function draw(canvasCtx, stageIdx, opts) {
    const canvas = canvasCtx.canvas;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const img = STAGES[stageIdx].img;
    if (!img.complete || !img.naturalWidth) return; // still loading

    const scale = Math.min(canvas.width / img.naturalWidth,
                           canvas.height / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;

    canvasCtx.imageSmoothingEnabled = false;

    if (opts && opts.silhouette) {
      if (!silCanvas) silCanvas = document.createElement('canvas');
      silCanvas.width = canvas.width;
      silCanvas.height = canvas.height;
      const sctx = silCanvas.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, silCanvas.width, silCanvas.height);
      sctx.drawImage(img, dx, dy, dw, dh);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, silCanvas.width, silCanvas.height);
      sctx.globalCompositeOperation = 'source-over';
      canvasCtx.drawImage(silCanvas, 0, 0);
    } else {
      canvasCtx.drawImage(img, dx, dy, dw, dh);
    }
  }

  NS.Mascot = { STAGES, stageForLevel, draw };

})(window.PokeTetris);
