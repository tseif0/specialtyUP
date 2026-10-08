// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { TiltDetector, upVector } from '../js/motion.js';

const RAD = Math.PI / 180;

// Feeds a steady screen angle (+ ceiling, - floor) at ~60 Hz.
function hold(detector, angleDeg, ms, clock) {
  for (let t = 0; t < ms; t += 16) {
    clock.now += 16;
    detector.update({ x: Math.cos(angleDeg * RAD), y: 0, z: Math.sin(angleDeg * RAD) }, clock.now);
  }
}

function setup(options) {
  const detector = new TiltDetector(options);
  const events = [];
  for (const type of ['correct', 'pass', 'rearm']) detector.addEventListener(type, () => events.push(type));
  const clock = { now: 0 };
  hold(detector, 0, 300, clock);
  return { detector, events, clock, gestures: () => events.filter((e) => e !== 'rearm') };
}

test('upVector: flat face up points through the screen, sideways upright does not', () => {
  assert.ok(Math.abs(upVector(0, 0).z - 1) < 1e-9);
  assert.ok(Math.abs(upVector(0, 90).z) < 1e-9);
  assert.ok(Math.abs(upVector(0, -90).z) < 1e-9);
  assert.ok(upVector(0, 50).z > 0.6); // landscape, screen tipped toward the ceiling
});

test('a nod down scores once, a tilt back passes once', () => {
  const { detector, clock, gestures } = setup();
  hold(detector, -70, 400, clock);
  assert.deepEqual(gestures(), ['correct']);
  hold(detector, -70, 400, clock); // staying down does not repeat
  assert.deepEqual(gestures(), ['correct']);
  hold(detector, 0, 500, clock);
  hold(detector, 70, 400, clock);
  assert.deepEqual(gestures(), ['correct', 'pass']);
});

test('no second gesture until the phone comes back near upright', () => {
  const { detector, clock, gestures } = setup();
  hold(detector, -70, 300, clock);
  hold(detector, -30, 300, clock); // partway back only
  hold(detector, -70, 300, clock);
  assert.deepEqual(gestures(), ['correct']);
});

test('a quick wobble past the threshold does not count', () => {
  const { detector, clock, gestures } = setup();
  hold(detector, 0, 100, clock);
  clock.now += 16;
  detector.update({ x: 0, y: 0, z: Math.sin(-80 * RAD) }, clock.now);
  hold(detector, 0, 300, clock);
  assert.deepEqual(gestures(), []);
});

test('small head movements below the threshold do nothing', () => {
  const { detector, clock, gestures } = setup();
  hold(detector, -35, 500, clock);
  hold(detector, 35, 500, clock);
  assert.deepEqual(gestures(), []);
});

test('swap turns a nod down into a pass', () => {
  const { detector, clock, gestures } = setup({ swap: true });
  hold(detector, -70, 400, clock);
  assert.deepEqual(gestures(), ['pass']);
});

test('calibration measures from a crooked resting position', () => {
  const { detector, clock, gestures } = setup();
  hold(detector, 20, 400, clock); // held tipped 20 degrees back
  detector.calibrate();
  hold(detector, 20, 200, clock);
  hold(detector, 50, 400, clock); // only 30 degrees from rest
  assert.deepEqual(gestures(), []);
  hold(detector, 20, 300, clock);
  hold(detector, -30, 400, clock); // 50 degrees forward from rest
  assert.deepEqual(gestures(), ['correct']);
});
