// Turns the phone's orientation into two gestures:
//   "correct" = screen tipped toward the floor (a nod down)
//   "pass"    = screen tipped toward the ceiling (a tilt back)
//
// The only number that matters is how far the screen faces up or down,
// which is the same whichever way the phone is turned, so the logic does
// not care about landscape left vs. right.

const DEG = 180 / Math.PI;
const SMOOTHING = 0.35; // 0..1, higher follows the sensor more closely

export async function requestMotionPermission() {
  const Orientation = window.DeviceOrientationEvent;
  if (!Orientation) return 'unsupported';
  // iPhone (iOS 13+) only sends sensor data after asking, from a tap.
  if (typeof Orientation.requestPermission === 'function') {
    try {
      return await Orientation.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

// World "up" in the phone's own frame (x right, y toward the top, z out of
// the screen), from the browser's beta/gamma angles.
export function upVector(betaDeg, gammaDeg) {
  const b = betaDeg / DEG;
  const g = gammaDeg / DEG;
  return {
    x: -Math.cos(b) * Math.sin(g),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(g),
  };
}

export class TiltDetector extends EventTarget {
  constructor({ triggerDeg = 45, rearmDeg = 20, holdMs = 80, cooldownMs = 400, swap = false } = {}) {
    super();
    Object.assign(this, { triggerDeg, rearmDeg, holdMs, cooldownMs, swap });
    this.raw = null; // smoothed screen angle: + faces ceiling, - faces floor
    this.baseline = 0;
    this.tilt = 0;
    this.up = null;
    this.armed = false;
    this.pending = null;
    this.cooldownUntil = 0;
    this.onOrientation = this.onOrientation.bind(this);
  }

  start() {
    window.addEventListener('deviceorientation', this.onOrientation);
  }

  stop() {
    window.removeEventListener('deviceorientation', this.onOrientation);
  }

  get hasData() {
    return this.raw !== null;
  }

  // Treat the current position as "upright" so a crooked hold plays fairly.
  calibrate() {
    if (this.raw !== null) this.baseline = this.raw;
    this.armed = false;
    this.pending = null;
  }

  onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    this.update(upVector(e.beta, e.gamma), performance.now());
  }

  update(up, now) {
    const angle = Math.asin(Math.max(-1, Math.min(1, up.z))) * DEG;
    this.raw = this.raw === null ? angle : this.raw + SMOOTHING * (angle - this.raw);
    this.up = up;
    const tilt = (this.raw - this.baseline) * (this.swap ? -1 : 1);
    this.tilt = tilt;
    this.emit('tilt', { tilt, raw: this.raw, up });

    if (!this.armed) {
      if (Math.abs(tilt) < this.rearmDeg) {
        this.armed = true;
        this.emit('rearm');
      }
      return;
    }
    if (now < this.cooldownUntil) return;

    const dir = tilt <= -this.triggerDeg ? 'correct' : tilt >= this.triggerDeg ? 'pass' : null;
    if (!dir) {
      this.pending = null;
      return;
    }
    if (!this.pending || this.pending.dir !== dir) this.pending = { dir, since: now };
    if (now - this.pending.since >= this.holdMs) {
      this.pending = null;
      this.armed = false;
      this.cooldownUntil = now + this.cooldownMs;
      this.emit(dir);
    }
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
