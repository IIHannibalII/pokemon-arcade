'use strict';

/* ============================================================
   Astro2048 — 8-bit sound via WebAudio.
   Floaty merge chimes and a patient original loop.
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
    slide() { blip(220, 0.03, 'triangle', 0.25, 60); },
    merge(value) {
      // pitch climbs with the merged value
      const base = 60 + Math.min(24, Math.round(Math.log2(value)) * 2);
      arpeggio([base, base + 4], 0.04, 0.09, 'triangle', 0.4);
    },
    stuck() { blip(140, 0.05, 'square', 0.3, -30); },
    win()   { arpeggio([72, 76, 79, 84, 88, 91, 96], 0.08, 0.18, 'square', 0.4); },
    gameOver() { arpeggio([62, 58, 55, 50], 0.16, 0.3, 'triangle', 0.6); },
  };

  /* Patient original loop: 8 bars of 4/4 at 90 BPM. */
  const TEMPO_EIGHTH = 60 / 90 / 2;

  const MELODY = [
    69, 0, 0, 72, 0, 0, 76, 0,
    74, 0, 0, 71, 0, 0, 67, 0,
    69, 0, 0, 72, 0, 0, 77, 0,
    76, 0, 72, 0, 69, 0, 0, 0,
    71, 0, 0, 74, 0, 0, 78, 0,
    76, 0, 0, 72, 0, 0, 69, 0,
    67, 0, 0, 71, 0, 0, 74, 0,
    72, 0, 69, 0, 65, 0, 0, 0,
  ];

  const BASS = [
    45, 0, 52, 0,
    43, 0, 50, 0,
    41, 0, 48, 0,
    45, 0, 45, 0,
    43, 0, 50, 0,
    45, 0, 52, 0,
    43, 0, 47, 0,
    41, 0, 45, 0,
  ];

  let musicPos = 0;
  let nextNoteTime = 0;

  function scheduleMusic() {
    const ahead = ctx.currentTime + 0.12;
    while (nextNoteTime < ahead) {
      const i = musicPos % MELODY.length;
      const m = MELODY[i];
      if (m) tone(musicGain, midi(m), nextNoteTime, TEMPO_EIGHTH * 1.7, 'triangle', 0.6);
      if (i % 4 === 0) {
        const b = BASS[(i / 2) % BASS.length];
        if (b) tone(musicGain, midi(b), nextNoteTime, TEMPO_EIGHTH * 3.2, 'triangle', 0.45);
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

})(window.Astro2048);
