'use strict';

/* ============================================================
   PokéSnake — 8-bit sound via WebAudio.
   Same synth approach as PokéTetris but with its own original
   tune (no Nintendo melodies).
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.09;
  const SFX_VOLUME = 0.22;

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
    catch()  { blip(500, 0.05, 'square', 0.4, 240); blip(880, 0.08, 'square', 0.35, 0, 0.05); },
    bonus()  { arpeggio([76, 80, 83, 88], 0.06, 0.12, 'square', 0.45); },
    spawn()  { blip(660, 0.07, 'triangle', 0.4, 120); },
    levelUp() {
      blip(220, 0.3, 'triangle', 0.5, 440);
      arpeggio([74, 78, 81, 86], 0.08, 0.2, 'square', 0.4);
    },
    gameOver() {
      arpeggio([62, 58, 55, 50], 0.16, 0.3, 'triangle', 0.6);
    },
  };

  /* ---------- Original chiptune loop ----------
     Bouncier and lighter than the Tetris tune: 8 bars of 4/4
     at 144 BPM, eighth-note grid. 0 = rest. */
  const TEMPO_EIGHTH = 60 / 144 / 2;

  const MELODY = [
    69, 0, 72, 69, 74, 72, 76, 0,
    74, 72, 74, 76, 72, 0, 69, 0,
    67, 0, 71, 67, 72, 71, 74, 0,
    72, 71, 72, 74, 76, 0, 0, 0,
    69, 0, 72, 69, 74, 72, 76, 0,
    79, 0, 76, 74, 76, 0, 72, 0,
    74, 76, 74, 72, 71, 72, 71, 67,
    69, 0, 69, 72, 69, 0, 0, 0,
  ];

  const BASS = [
    45, 52, 45, 52,
    50, 57, 45, 52,
    43, 50, 43, 50,
    48, 55, 52, 55,
    45, 52, 45, 52,
    48, 55, 48, 55,
    50, 57, 43, 50,
    45, 52, 45, 45,
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

})(window.PokeSnake);
