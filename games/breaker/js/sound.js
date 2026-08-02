'use strict';

/* ============================================================
   AstroBreaker — 8-bit sound via WebAudio.
   Same synth approach as the other games with its own original
   tune.
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.09;
  const SFX_VOLUME = 0.2;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      sfxGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain.connect(ctx.destination);
      musicGain.connect(ctx.destination);
      applyGains();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function applyGains() {
    if (!ctx) return;
    sfxGain.gain.value = muted ? 0 : SFX_VOLUME;
    musicGain.gain.value = muted || paused ? 0 : MUSIC_VOLUME;
  }

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function tone(dest, freq, start, dur, type, vol, slide) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function blip(freq, dur, type, vol, slide, delay) {
    if (!ensure()) return;
    tone(sfxGain, freq, ctx.currentTime + (delay || 0), dur, type, vol || 0.5, slide);
  }

  function arpeggio(notes, step, dur, type, vol) {
    notes.forEach((n, i) => blip(midi(n), dur, type, vol, 0, i * step));
  }

  const sfx = {
    paddle() { blip(300, 0.04, 'square', 0.4, 80); },
    brick()  { blip(520, 0.05, 'square', 0.4, 140); },
    armor()  { blip(180, 0.05, 'triangle', 0.5); },
    launch() { blip(240, 0.12, 'triangle', 0.4, 300); },
    powerup() { arpeggio([72, 76, 79], 0.05, 0.1, 'square', 0.45); },
    multi()  { arpeggio([76, 80, 83, 88], 0.05, 0.12, 'square', 0.45); },
    life()   { arpeggio([72, 79, 84], 0.08, 0.18, 'square', 0.45); },
    lost()   { arpeggio([57, 52, 45], 0.12, 0.25, 'triangle', 0.55); },
    wave()   { blip(200, 0.3, 'triangle', 0.5, 460); arpeggio([74, 78, 81, 86], 0.08, 0.2, 'square', 0.4); },
    gameOver() { arpeggio([62, 58, 55, 50], 0.16, 0.3, 'triangle', 0.6); },
  };

  /* ---------- Original chiptune loop ----------
     Driving and steady: 8 bars of 4/4 at 150 BPM, eighth grid. */
  const TEMPO_EIGHTH = 60 / 150 / 2;

  const MELODY = [
    64, 0, 64, 67, 71, 0, 67, 0,
    69, 0, 69, 72, 76, 0, 72, 0,
    71, 0, 71, 74, 78, 0, 74, 0,
    76, 74, 71, 67, 64, 0, 0, 0,
    64, 0, 64, 67, 71, 0, 67, 0,
    69, 0, 69, 72, 76, 0, 72, 0,
    78, 0, 76, 74, 76, 0, 71, 0,
    76, 0, 76, 0, 76, 76, 0, 0,
  ];

  const BASS = [
    40, 47, 40, 47,
    45, 52, 45, 52,
    43, 50, 43, 50,
    40, 47, 43, 47,
    40, 47, 40, 47,
    45, 52, 45, 52,
    47, 54, 43, 50,
    40, 47, 40, 40,
  ];

  let musicPos = 0;
  let nextNoteTime = 0;

  function scheduleMusic() {
    const ahead = ctx.currentTime + 0.12;
    while (nextNoteTime < ahead) {
      const i = musicPos % MELODY.length;
      const m = MELODY[i];
      if (m) tone(musicGain, midi(m), nextNoteTime, TEMPO_EIGHTH * 0.9, 'square', 0.5);
      if (i % 2 === 0) {
        const b = BASS[(i / 2) % BASS.length];
        if (b) tone(musicGain, midi(b), nextNoteTime, TEMPO_EIGHTH * 1.7, 'triangle', 0.7);
      }
      nextNoteTime += TEMPO_EIGHTH;
      musicPos++;
    }
  }

  function startMusic() {
    if (!ensure()) return;
    stopMusic();
    musicPos = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    musicTimer = setInterval(scheduleMusic, 40);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  NS.Sound = {
    sfx,
    startMusic,
    stopMusic,
    unlock() { ensure(); },
    setPaused(p) { paused = p; applyGains(); },
    toggleMute() {
      muted = !muted;
      applyGains();
      return muted;
    },
    isMuted() { return muted; },
  };

})(window.AstroBreaker);
