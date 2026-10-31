import test from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../assets/shared/clock.js';
import { createSeededRandom } from '../assets/shared/random.js';

test('seeded random preserves the existing Labs sequence and instance isolation', () => {
  const first = createSeededRandom(0x4c414253);
  const second = createSeededRandom(0x4c414253);
  const values = [0.5870268098078668, 0.036663412349298596, 0.40250868909060955];
  assert.deepEqual(values.map(() => first()), values);
  assert.equal(second(), values[0]);
  assert.throws(() => createSeededRandom(-1), TypeError);
  assert.throws(() => createSeededRandom(2 ** 32), TypeError);
});

test('hidden startup and hidden intervals contribute no visible or cinematic time', () => {
  const clock = createClock({ visible: false });
  clock.sample(0);
  clock.sample(8000);
  assert.equal(clock.visibleTime, 0);
  assert.equal(clock.t, 0);
  clock.setVisible(true, 10000);
  const resumed = clock.sample(10020);
  assert.equal(resumed.visibleTime, 0.02);
  assert.equal(resumed.t, 0.02);
  assert.equal(resumed.frameValid, false);
  assert.equal(clock.sample(10040).frameValid, true);
});

test('visible deadlines use raw time while cinematic delta is capped', () => {
  const clock = createClock();
  clock.sample(0);
  const delayed = clock.sample(5000);
  assert.equal(delayed.visibleTime, 5);
  assert.equal(delayed.rawDelta, 5);
  assert.equal(delayed.dt, 0.05);
  assert.equal(delayed.t, 0.05);
  clock.pause();
  clock.sample(12000);
  assert.equal(clock.visibleTime, 12);
  assert.equal(clock.t, 0.05);
});

test('seek changes presentation without advancing visible time or the timestamp anchor', () => {
  const clock = createClock();
  clock.sample(100);
  clock.sample(120);
  clock.seek(4);
  assert.equal(clock.visibleTime, 0.02);
  assert.equal(clock.t, 4);
  const next = clock.sample(140);
  assert.equal(next.dt, 0.02);
  assert.equal(next.visibleTime, 0.04);
  assert.equal(next.t, 4.02);
});

test('visibility boundaries invalidate only the crossing frame interval', () => {
  const clock = createClock();
  clock.sample(0);
  assert.equal(clock.sample(16).frameValid, true);
  clock.setVisible(false, 20);
  assert.equal(clock.sample(2000).frameValid, false);
  clock.setVisible(true, 4000);
  assert.equal(clock.sample(4016).frameValid, false);
  assert.equal(clock.sample(4032).frameValid, true);
  assert.ok(Math.abs(clock.visibleTime - 0.052) < 1e-12);
});

test('resetting frame sampling avoids a resumed delta without erasing accumulated time', () => {
  const clock = createClock();
  clock.sample(0);
  clock.sample(16);
  clock.resetFrame();
  const resumed = clock.sample(9000);
  assert.equal(resumed.dt, 0);
  assert.equal(resumed.visibleTime, 0.016);
  assert.equal(resumed.t, 0.016);
});

test('invalid clock input fails without corrupting its previous sample', () => {
  const clock = createClock();
  clock.sample(100);
  for (const value of [99, -1, NaN, Infinity]) assert.throws(() => clock.sample(value), RangeError);
  assert.throws(() => clock.seek(NaN), RangeError);
  assert.throws(() => createClock({ maxDelta: 0 }), TypeError);
  assert.equal(clock.sample(120).dt, 0.02);
});

test('negative finite capture time remains supported for the existing Labs API', () => {
  const clock = createClock({ paused: true });
  clock.seek(-1);
  assert.equal(clock.t, -1);
  assert.equal(clock.sample(100).t, -1);
});
