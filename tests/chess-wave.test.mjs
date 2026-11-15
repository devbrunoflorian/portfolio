import test from 'node:test';
import assert from 'node:assert/strict';
import { createChessGrid, chessClip } from '../assets/shared/chess-wave.js';

function revealed(clip, x, y) {
  if (clip === 'inset(0)') return true;
  if (clip === 'inset(50%)') return false;
  let crossings = 0;
  for (const match of clip.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+Z/g)) {
    const [, left, top, width, height] = match.map(Number);
    if (x > left && x < left + width && y > top && y < top + height) crossings++;
  }
  return crossings % 2 === 1;
}

test('the reveal is empty initially, complete finally, and advances from upper right', () => {
  const grid = createChessGrid(1440, 900);
  assert.equal(chessClip(grid, 0), 'inset(50%)');
  assert.equal(chessClip(grid, 1), 'inset(0)');
  const middle = chessClip(grid, .5);
  assert.equal(revealed(middle, 1397, 43), true);
  assert.equal(revealed(middle, 43, 857), false);
});

test('every sampled point stays revealed once reached, including parity holes and merged rows', () => {
  const grid = createChessGrid(400, 400);
  const points = Array.from({ length: 100 }, (_, i) => ({ x: (i % 10) * 39 + 3, y: Math.floor(i / 10) * 39 + 7, visible: false }));
  for (let step = 0; step <= 50; step++) {
    const clip = chessClip(grid, step / 50);
    for (const point of points) {
      const visible = revealed(clip, point.x, point.y);
      assert.ok(!point.visible || visible, `Reveal regressed at ${point.x},${point.y}, step ${step}`);
      point.visible = visible;
    }
  }
  assert.ok(points.every(point => point.visible));
});

test('large and narrow viewports stay within the tile budget and contain only finite paths', () => {
  for (const [width, height] of [[320, 720], [390, 844], [3840, 2160], [7680, 4320]]) {
    const grid = createChessGrid(width, height);
    assert.ok(grid.tiles.length <= 800);
    assert.ok(grid.cell >= 40);
    for (const p of [.01, .25, .5, .75, .99]) assert.doesNotMatch(chessClip(grid, p), /NaN|Infinity/);
  }
});
