// Game sounds made with Web Audio, so there are no sound files to load.
// Each sound layers a few voices into a compressor, which keeps them loud
// and punchy without distorting.

let ctx = null;
let out = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

// Call from a tap: browsers only allow audio after a user gesture.
export function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  // iPhone (iOS 17+): play through the media channel. It is louder than the
  // default ringer channel and isn't silenced by the mute switch. The game's
  // Sounds setting still turns sound off.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* older Safari */ }
  if (!ctx) {
    ctx = new Ctx();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 6;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.12;
    const level = ctx.createGain();
    level.gain.value = 1.4; // make-up gain after compression
    compressor.connect(level).connect(ctx.destination);
    out = compressor;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

// One note. `to` slides the pitch, `cutoff` rounds off harsh waveforms.
function voice(freq, start, duration, { type = 'square', volume = 0.5, to = null, cutoff = null } = {}) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  // Fast attack, short full-volume hold, then a quick fade: reads as "bold".
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.005);
  gain.gain.setValueAtTime(volume, t0 + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  let node = osc.connect(gain);
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    node = node.connect(filter);
  }
  node.connect(out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sounds = {
  // Bright two-note "ding-DING".
  correct() {
    voice(880, 0, 0.12, { volume: 0.45, cutoff: 6000 });
    voice(1760, 0, 0.12, { type: 'triangle', volume: 0.4 });
    voice(1319, 0.11, 0.3, { volume: 0.5, cutoff: 7000 });
    voice(2637, 0.11, 0.3, { type: 'triangle', volume: 0.35 });
  },
  // Low downward "whomp".
  pass() {
    voice(340, 0, 0.32, { type: 'sawtooth', volume: 0.6, to: 120, cutoff: 1800 });
    voice(170, 0, 0.32, { type: 'square', volume: 0.45, to: 60, cutoff: 900 });
  },
  // Sharp woodblock click for the last five seconds.
  tick() {
    voice(1500, 0, 0.05, { volume: 0.45, cutoff: 5000 });
    voice(750, 0, 0.05, { type: 'triangle', volume: 0.4 });
  },
  count() {
    voice(660, 0, 0.2, { volume: 0.5, cutoff: 5000 });
    voice(1320, 0, 0.2, { type: 'triangle', volume: 0.3 });
  },
  go() {
    voice(880, 0, 0.45, { volume: 0.5, cutoff: 6000 });
    voice(1320, 0, 0.45, { type: 'triangle', volume: 0.4 });
    voice(1760, 0, 0.45, { type: 'triangle', volume: 0.3 });
  },
  // Game-show buzzer: detuned low saws.
  buzzer() {
    voice(110, 0, 1.0, { type: 'sawtooth', volume: 0.6, cutoff: 2500 });
    voice(114, 0, 1.0, { type: 'sawtooth', volume: 0.6, cutoff: 2500 });
    voice(55, 0, 1.0, { type: 'square', volume: 0.5, cutoff: 800 });
  },
};

export function buzz(pattern) {
  navigator.vibrate?.(pattern); // Android only; iPhone ignores it
}
