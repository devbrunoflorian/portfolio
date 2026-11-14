import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, clamp01, easeInCubic, easeOutCubic, scrollFillProgress, smoothstep } from '../assets/shared/motion.js';

test('motion curves clamp at their endpoints and preserve their intended direction', () => {
  for (const ease of [easeInCubic, easeOutCubic, smoothstep]) {
    assert.equal(ease(-1), 0);
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
    assert.equal(ease(2), 1);
    assert.ok(ease(.6) > ease(.4));
  }
  assert.equal(clamp01(.4), .4);
  assert.deepEqual(MOTION.scrollFill, { start: .86, finish: .46 });
  assert.equal(scrollFillProgress(860, 1000), 0);
  assert.equal(scrollFillProgress(660, 1000), .5);
  assert.equal(scrollFillProgress(460, 1000), 1);
  assert.equal(scrollFillProgress(660, 1000), scrollFillProgress(660, 1000));
  assert.equal(scrollFillProgress(100, 0), 0);
  assert.equal(MOTION.opening.syllableRiseEm, .08);
  assert.equal(MOTION.opening.bodyRiseEm, .16);
});
