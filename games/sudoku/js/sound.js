'use strict';

/* ============================================================
   AstroSudoku — 8-bit sound via WebAudio.
   Gentle star-chart music and soft input effects.
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.06;
  const SFX_VOLUME = 0.16;

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
    set()   { blip(520, 0.04, 'triangle', 0.4, 110); },
    wrong() { blip(160, 0.1, 'square', 0.35, -40); },
    note()  { blip(400, 0.03, 'triangle', 0.3, 60); },
    erase() { blip(240, 0.05, 'triangle', 0.35, -70); },
    move()  { blip(340, 0.02, 'triangle', 0.2); },
    hint()  { arpeggio([79, 84, 88], 0.05, 0.1, 'triangle', 0.4); },
    win()   { arpeggio([72, 76, 79, 84, 88, 91, 96], 0.08, 0.18, 'square', 0.4); },
  };

  /* Slow, floaty original loop: 8 bars of 4/4 at 84 BPM. */
  const TEMPO_EIGHTH = 60 / 84 / 2;

  const MELODY = [
    72, 0, 0, 0, 76, 0, 79, 0,
    83, 0, 0, 0, 79, 0, 76, 0,
    74, 0, 0, 0, 77, 0, 81, 0,
    79, 0, 0, 0, 76, 0, 72, 0,
    72, 0, 0, 0, 76, 0, 79, 0,
    84, 0, 0, 0, 83, 0, 79, 0,
    81, 0, 77, 0, 74, 0, 77, 0,
    76, 0, 0, 0, 72, 0, 0, 0,
  ];

  const BASS = [
    48, 0, 55, 0,
    52, 0, 55, 0,
    50, 0, 57, 0,
    43, 0, 48, 0,
    48, 0, 55, 0,
    45, 0, 52, 0,
    50, 0, 45, 0,
    48, 0, 43, 0,
  ];

  let musicPos = 0;
  let nextNoteTime = 0;

  function scheduleMusic() {
    const ahead = ctx.currentTime + 0.12;
    while (nextNoteTime < ahead) {
      const i = musicPos % MELODY.length;
      const m = MELODY[i];
      if (m) tone(musicGain, midi(m), nextNoteTime, TEMPO_EIGHTH * 1.8, 'triangle', 0.6);
      if (i % 4 === 0) {
        const b = BASS[(i / 2) % BASS.length];
        if (b) tone(musicGain, midi(b), nextNoteTime, TEMPO_EIGHTH * 3.4, 'triangle', 0.45);
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

})(window.AstroSudoku);
