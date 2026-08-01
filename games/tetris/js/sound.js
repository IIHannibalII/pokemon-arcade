'use strict';

/* ============================================================
   PokéTetris — 8-bit sound via WebAudio.
   All SFX are synthesized square/triangle blips; the music is
   an original chiptune loop (no Nintendo melodies).
   ============================================================ */

(function (NS) {

  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let paused = false;
  let musicTimer = null;

  const MUSIC_VOLUME = 0.10;
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

  /* One synthesized note. slide (Hz) bends the pitch over the duration. */
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

  /* Play a fast arpeggio of midi notes. */
  function arpeggio(notes, step, dur, type, vol) {
    notes.forEach((n, i) => blip(midi(n), dur, type, vol, 0, i * step));
  }

  const sfx = {
    move()   { blip(220, 0.03, 'square', 0.25); },
    rotate() { blip(330, 0.05, 'square', 0.3, 60); },
    lock()   { blip(140, 0.05, 'triangle', 0.5); },
    hold()   { blip(300, 0.05, 'square', 0.3); blip(450, 0.05, 'square', 0.3, 0, 0.06); },
    drop()   { blip(90, 0.09, 'square', 0.6, -30); },
    clear(n) {
      if (n >= 4) {
        // legendary catch fanfare
        arpeggio([72, 76, 79, 84, 88, 91, 96], 0.07, 0.14, 'square', 0.5);
      } else {
        arpeggio([72, 76, 79].slice(0, 2 + n), 0.06, 0.1, 'square', 0.45);
      }
    },
    levelUp() {
      // evolution jingle: rising sweep + chord
      blip(200, 0.35, 'triangle', 0.5, 500);
      arpeggio([76, 81, 85, 88], 0.09, 0.22, 'square', 0.4);
    },
    gameOver() {
      arpeggio([64, 60, 57, 53], 0.16, 0.3, 'triangle', 0.6);
    },
  };

  /* ---------- Original chiptune loop ----------
     8 bars of 4/4 at 132 BPM, eighth-note grid.
     Melody: square wave. Bass: triangle, quarter notes.
     0 = rest. */
  const TEMPO_EIGHTH = 60 / 132 / 2;

  const MELODY = [
    76, 76, 79, 76, 74, 72, 74, 76,
    72, 72, 76, 72, 71, 69, 71, 72,
    74, 74, 77, 74, 72, 71, 72, 74,
    76, 79, 76, 72, 74, 71, 72, 0,
    79, 79, 81, 79, 76, 72, 76, 79,
    81, 81, 84, 81, 79, 76, 79, 81,
    79, 76, 72, 76, 74, 71, 74, 77,
    76, 72, 67, 72, 72, 0, 72, 0,
  ];

  const BASS = [
    48, 55, 48, 55,
    45, 52, 45, 52,
    41, 48, 41, 48,
    48, 55, 43, 55,
    43, 50, 43, 50,
    45, 52, 45, 52,
    43, 50, 43, 50,
    48, 55, 48, 55,
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

})(window.PokeTetris);
