// Game sounds made with Web Audio, so there are no sound files to load.
// Note: the iPhone's silent switch mutes these.

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

// Call from a tap: browsers only allow audio after a user gesture.
export function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ctx ??= new Ctx();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, start, duration, type = 'sine', volume = 0.2) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sounds = {
  correct() { tone(660, 0, 0.12); tone(990, 0.1, 0.2); },
  pass() { tone(330, 0, 0.15, 'triangle', 0.25); tone(220, 0.12, 0.22, 'triangle', 0.25); },
  tick() { tone(1200, 0, 0.05, 'square', 0.06); },
  count() { tone(520, 0, 0.15); },
  go() { tone(880, 0, 0.35); },
  buzzer() { tone(150, 0, 0.8, 'sawtooth', 0.25); },
};

export function buzz(pattern) {
  navigator.vibrate?.(pattern); // Android only; iPhone ignores it
}
