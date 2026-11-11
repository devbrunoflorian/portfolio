import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedNotationForBars } from '../assets/about-legacy/score-gpu-scroll.js';
import { scoreRibbonTimeline as score } from '../assets/about-legacy/score-ribbon-timeline.js';
import { buildRibbonGeometry } from '../assets/about-legacy/score-gpu-ribbon-geometry.js';
import { pixelSpriteAtlasData, SCORE_MATERIAL } from '../assets/about-legacy/score-gpu-materials.js';

test('the pixel whole rest retains the written rest anchor and ink dimensions', () => {
  const notation = selectedNotationForBars(31, 33);
  const geometry = buildRibbonGeometry(score, notation.view, notation.groups, notation.engraving, notation.voicePaths, null);
  try {
    const { feature, sourceUV, glyphOffset } = geometry.attributes;
    const vertices = Array.from({ length: feature.count }, (_, i) => i)
      .filter(i => feature.getY(i) === SCORE_MATERIAL.PIXEL_REST);
    assert.equal(vertices.length, 6);
    const rest = notation.engraving.rest;
    for (const i of vertices) {
      assert.ok(Math.abs(sourceUV.getX(i) - rest.x) < .001);
      assert.equal(sourceUV.getY(i), rest.y);
    }
    const atlas = pixelSpriteAtlasData();
    const pixels = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (atlas.data[((15 - y) * atlas.width + 64 + x) * 4 + 3]) pixels.push([x, y]);
    }
    const columns = Math.max(...pixels.map(p => p[0])) - Math.min(...pixels.map(p => p[0])) + 1;
    const rows = Math.max(...pixels.map(p => p[1])) - Math.min(...pixels.map(p => p[1])) + 1;
    const width = Math.max(...vertices.map(i => glyphOffset.getX(i))) - Math.min(...vertices.map(i => glyphOffset.getX(i)));
    const height = Math.max(...vertices.map(i => glyphOffset.getY(i))) - Math.min(...vertices.map(i => glyphOffset.getY(i)));
    assert.ok(Math.abs(width * columns / 16 - rest.width) < 1e-6);
    assert.ok(Math.abs(height * rows / 16 - rest.height) < 1e-6);
  } finally { geometry.dispose(); }
});
