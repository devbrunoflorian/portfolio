import test from 'node:test';
import assert from 'node:assert/strict';
import { readingOffset } from '../assets/about/scene/camera.js';

test('reading offsets remain continuous when adjacent chapter zones overlap', () => {
  const centers = [0, 240, 480, 720, 960, 1200];
  const height = 800;
  for (let y = 0; y <= 1200; y += .5) {
    const before = readingOffset(centers, y - .0001, height);
    const after = readingOffset(centers, y + .0001, height);
    assert.ok(Math.abs(after - before) < .001, `discontinuity at ${y}`);
    assert.ok(Math.abs(after) <= height * .12);
  }
});

test('reading offsets give identical frames in either scroll direction', () => {
  const centers = [100, 1500, 2700, 3900, 5200, 6400];
  const positions = Array.from({ length: 101 }, (_, i) => i * 64);
  const down = positions.map(y => readingOffset(centers, y, 844));
  const up = positions.toReversed().map(y => readingOffset(centers, y, 844)).reverse();
  assert.deepEqual(up, down);
});
