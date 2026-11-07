import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRibbonTimeline as score } from '../assets/about/score-ribbon-timeline.js';
import { scoreRibbonData } from '../assets/about/score-ribbon-data.js';
import { buildEngraving, projectBeamPoint, projectEngravingGlyph } from '../assets/about/score-engraving.js';
import { createTravelProjector } from '../assets/about/score-ribbon-geometry.js';
import { projectHeadStem } from '../assets/about/score-head-stems.js';

const view = { x0: score.bars[30].xStart, x1: score.bars[32].xEnd };
const notes = score.pdfGlyphs.filter(g => g.noteId && g.x >= view.x0 && g.x <= view.x1)
  .map(g => ({ id: g.noteId, x: g.x, y: Math.round(g.y) }));
const engraving = buildEngraving(score, notes, view);

test('the source has six triplet groups, six figures and twenty-four unique bracket strokes', () => {
  assert.equal(engraving.beams.length, 6);
  assert.deepEqual(engraving.beams.map(b => b.members.length), [3, 3, 3, 3, 3, 3]);
  assert.equal(new Set(engraving.beams.flatMap(b => b.members.map(m => m.note.id))).size, 18);
  assert.equal(engraving.glyphs.filter(g => g.glyph.text === '3').length, 6);
  assert.equal(engraving.brackets.length, 24);
  assert.equal(new Set(engraving.brackets.map(b => JSON.stringify(b.command))).size, 24);
  assert.ok(engraving.brackets.every(b => b.command.kind === 'l'), 'No ties or slurs in this source excerpt');
});

test('every beam passes through its three attached stem tips in both inspected poses', () => {
  for (const pose of [1, .13]) {
    const project = createTravelProjector(1280, 711, score, pose, view);
    for (const beam of engraving.beams) for (const pair of beam.members) {
      const tip = projectHeadStem(pair, project).end;
      const beamPoint = projectBeamPoint(beam, ...pair.stem.end, project);
      assert.ok(Math.hypot(tip.x - beamPoint.x, tip.y - beamPoint.y) < 1e-7, pair.note.id);
    }
    for (const glyph of engraving.glyphs) {
      const point = projectEngravingGlyph(glyph, project);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.scale > 0);
    }
  }
});

test('one printed sharp applies to both D sharp 5 events in bar 31', () => {
  const accidental = engraving.glyphs.filter(g => g.glyph.text !== '3');
  assert.equal(accidental.length, 1);
  assert.equal(accidental[0].glyph.text, 'D'); // Guitar Pro's embedded sharp glyph, checked against the PDF.
  assert.equal(accidental[0].pair.note.id, 'guitar-31-4-1');
  const heads = scoreRibbonData.systems.flatMap(s => s.heads);
  for (const id of ['guitar-31-4-1', 'guitar-31-10-1']) {
    assert.equal(heads.find(h => h.id === id).writtenMidi, 75);
  }
});

test('bar 32 uses the requested whole-measure rest and does not resurrect the old high chord', () => {
  assert.equal(engraving.pairs.filter(p => p.note.id.startsWith('guitar-32-')).length, 0);
  assert.equal(engraving.glyphs.filter(g => g.glyph.text === '=').length, 0);
  assert.equal(engraving.rest.bar, 32);
  assert.equal(engraving.rest.x, (score.bars[31].xStart + score.bars[31].xEnd) / 2);
  assert.equal(engraving.rest.y, -6);
});
