'use strict';

/* ============================================================
   AstroSweeper — 8-bit sound via WebAudio.
   Calm thinking-music loop and soft scan effects.
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.07;
  const SFX_VOLUME = 0.18;

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
    reveal() { blip(560, 0.03, 'square', 0.25, 120); },
    bigReveal() { arpeggio([76, 79, 83], 0.04, 0.06, 'square', 0.3); },
    flag()   { blip(340, 0.05, 'triangle', 0.45, 90); },
    unflag() { blip(260, 0.05, 'triangle', 0.4, -60); },
    chord()  { blip(480, 0.05, 'square', 0.3, 100); },
    boom() {
      blip(90, 0.5, 'sawtooth', 0.7, -60);
      blip(45, 0.7, 'triangle', 0.8, -20, 0.05);
    },
    win() {
      arpeggio([72, 76, 79, 84, 88, 91, 96], 0.07, 0.16, 'square', 0.45);
    },
  };

  /* Calm original loop: 8 bars of 4/4 at 96 BPM, eighth grid. */
  const TEMPO_EIGHTH = 60 / 96 / 2;

  const MELODY = [
    76, 0, 0, 74, 0, 0, 71, 0,
    72, 0, 0, 69, 0, 0, 67, 0,
    69, 0, 0, 71, 0, 0, 72, 0,
    74, 0, 71, 0, 67, 0, 0, 0,
    76, 0, 0, 79, 0, 0, 78, 0,
    76, 0, 0, 74, 0, 0, 72, 0,
    71, 0, 0, 72, 0, 0, 74, 0,
    71, 0, 67, 0, 64, 0, 0, 0,
  ];

  const BASS = [
    48, 0, 52, 0,
    45, 0, 48, 0,
    41, 0, 45, 0,
    43, 0, 43, 0,
    48, 0, 52, 0,
    45, 0, 48, 0,
    43, 0, 47, 0,
    48, 0, 43, 0,
  ];

  let musicPos = 0;
  let nextNoteTime = 0;

  function scheduleMusic() {
    const ahead = ctx.currentTime + 0.12;
    while (nextNoteTime < ahead) {
      const i = musicPos % MELODY.length;
      const m = MELODY[i];
      if (m) tone(musicGain, midi(m), nextNoteTime, TEMPO_EIGHTH * 1.6, 'triangle', 0.6);
      if (i % 4 === 0) {
        const b = BASS[(i / 2) % BASS.length];
        if (b) tone(musicGain, midi(b), nextNoteTime, TEMPO_EIGHTH * 3.2, 'triangle', 0.5);
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

})(window.AstroSweeper);
