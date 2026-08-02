'use strict';

/* ============================================================
   AstroDuel — 8-bit sound via WebAudio.
   Sporty duel loop and classic paddle blips.
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.08;
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
    you()   { blip(420, 0.04, 'square', 0.4, 100); },
    cpu()   { blip(280, 0.04, 'square', 0.4, 60); },
    wall()  { blip(200, 0.03, 'triangle', 0.35); },
    serve() { blip(320, 0.08, 'triangle', 0.4, 160); },
    goalYou() { arpeggio([76, 81, 85], 0.06, 0.12, 'square', 0.45); },
    goalCpu() { arpeggio([55, 51, 48], 0.09, 0.16, 'triangle', 0.5); },
    victory() { arpeggio([72, 76, 79, 84, 88, 91, 96], 0.07, 0.16, 'square', 0.45); },
    defeat()  { arpeggio([62, 58, 55, 50], 0.16, 0.3, 'triangle', 0.6); },
  };

  /* Sporty original loop: 8 bars of 4/4 at 138 BPM, eighth grid. */
  const TEMPO_EIGHTH = 60 / 138 / 2;

  const MELODY = [
    67, 0, 71, 0, 74, 71, 74, 0,
    69, 0, 72, 0, 76, 72, 76, 0,
    71, 0, 74, 0, 78, 74, 78, 0,
    76, 74, 72, 71, 69, 0, 67, 0,
    67, 0, 71, 0, 74, 71, 74, 0,
    69, 0, 72, 0, 76, 72, 76, 0,
    78, 0, 76, 0, 74, 0, 72, 0,
    71, 0, 71, 74, 71, 0, 0, 0,
  ];

  const BASS = [
    43, 50, 43, 50,
    45, 52, 45, 52,
    47, 54, 47, 54,
    48, 55, 43, 50,
    43, 50, 43, 50,
    45, 52, 45, 52,
    50, 57, 45, 52,
    43, 50, 43, 43,
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

})(window.AstroDuel);
