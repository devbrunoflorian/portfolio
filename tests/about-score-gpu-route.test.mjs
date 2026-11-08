import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseGpuScoreScroll } from '../assets/about/score-gpu-route.js';

test('About enables the GPU score journey on its normal route', () => {
  assert.equal(shouldUseGpuScoreScroll(new URLSearchParams()), true);
});

test('About can return to the previous Canvas renderer', () => {
  assert.equal(shouldUseGpuScoreScroll(new URLSearchParams('score-gpu=off')), false);
});

test('score study routes keep their current renderer by default', () => {
  for (const query of ['score-gate=2a', 'score-grid=study', 'score-ribbon=storyboard']) {
    assert.equal(shouldUseGpuScoreScroll(new URLSearchParams(query)), false, query);
  }
});

test('the explicit GPU route overrides a study-route default', () => {
  assert.equal(shouldUseGpuScoreScroll(new URLSearchParams('score-ribbon=study&score-gpu=scroll')), true);
});
