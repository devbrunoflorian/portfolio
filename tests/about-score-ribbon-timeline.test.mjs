import test from "node:test";
import assert from "node:assert/strict";
import { scoreRibbonData } from "../assets/about-legacy/score-ribbon-data.js";
import {
  scorePlaybackWindowAtBeat,
  scorePositionAtBeat,
  scoreRibbonTimeline,
  scoreWindowAtBeat,
  STATIC_SCORE_BEAT,
} from "../assets/about-legacy/score-ribbon-timeline.js";
import { visualVoiceSegments } from "../assets/about-legacy/score-ribbon-renderer.js";

test("the continuous ribbon preserves the complete guitar score and both melodies", () => {
  const bars = scoreRibbonData.systems.flatMap(system => system.bars);
  const guitarHeads = scoreRibbonData.systems.flatMap(system => system.heads);

  assert.equal(scoreRibbonData.bars, 106);
  assert.equal(scoreRibbonData.totalBeats, 424);
  assert.deepEqual(bars.map(bar => bar.number), Array.from({ length: 106 }, (_, index) => index + 1));
  assert.equal(guitarHeads.length, 1005);
  assert.equal(scoreRibbonData.noteheadsMatched, guitarHeads.length);
  assert.ok(scoreRibbonData.maxPdfPitchErrorPoints < 0.5);
  assert.equal(scoreRibbonTimeline.voices.length, 399);
  assert.ok(scoreRibbonTimeline.voices.every(note => Math.abs(note.x - scorePositionAtBeat(note.beat)) < .0001));
  assert.ok(scoreRibbonTimeline.pdfDrawings.every(drawing => (
    Number.isFinite(drawing.minX)
    && Number.isFinite(drawing.maxX)
    && drawing.minX <= drawing.maxX
  )), "each drawing needs cheap bounds before the renderer samples its paths");

  const first = scoreRibbonTimeline.pdfGlyphs.find(glyph => glyph.noteId === "guitar-1-1-1");
  const second = scoreRibbonTimeline.pdfGlyphs.find(glyph => glyph.noteId === "guitar-1-2-1");
  const expectedSpacing = (96.75 - 77.25) / scoreRibbonData.systems[0].sourceHalfStep;
  assert.ok(Math.abs((second.x - first.x) - expectedSpacing) < .001);
  assert.ok(second.x - first.x > 8, "the PDF's editorial spacing must not collapse to a uniform beat grid");

  const beforeBoundary = scorePositionAtBeat(3.999);
  const boundary = scorePositionAtBeat(4);
  const afterBoundary = scorePositionAtBeat(4.001);
  assert.ok(beforeBoundary < boundary && boundary < afterBoundary, "score time must remain continuous across printed systems");
});

test("playback keeps the score moving under a fixed cursor", () => {
  const first = scorePlaybackWindowAtBeat(20, 1280);
  const later = scorePlaybackWindowAtBeat(20.25, 1280);
  assert.ok(later.startX > first.startX);
  assert.ok(later.endX > first.endX);
  assert.ok(Math.abs((later.endX - later.startX) - (first.endX - first.startX)) < .0001);
  assert.ok(scorePositionAtBeat(20.25) > scorePositionAtBeat(20));
});

test("the silent frame is bars 33–35 and the viewport follows the active beat", () => {
  assert.equal(STATIC_SCORE_BEAT, 134);
  const staticDesktop = scoreWindowAtBeat(STATIC_SCORE_BEAT, 1280);
  assert.deepEqual(
    { ...staticDesktop, startX: undefined, endX: undefined },
    { startBeat: 128, endBeat: 140, firstBar: 33, lastBar: 35, startX: undefined, endX: undefined },
  );
  assert.ok(staticDesktop.endX > staticDesktop.startX);

  const staticMobile = scoreWindowAtBeat(STATIC_SCORE_BEAT, 390);
  assert.deepEqual(
    { ...staticMobile, startX: undefined, endX: undefined },
    { startBeat: 132, endBeat: 136, firstBar: 34, lastBar: 34, startX: undefined, endX: undefined },
  );
  assert.deepEqual(
    (({ startBeat, endBeat, firstBar, lastBar }) => ({ startBeat, endBeat, firstBar, lastBar }))(scoreWindowAtBeat(0, 1280)),
    { startBeat: 0, endBeat: 12, firstBar: 1, lastBar: 3 },
  );
  assert.deepEqual(
    (({ startBeat, endBeat, firstBar, lastBar }) => ({ startBeat, endBeat, firstBar, lastBar }))(scoreWindowAtBeat(424, 1280)),
    { startBeat: 412, endBeat: 424, firstBar: 104, lastBar: 106 },
  );
});

test("voice trails stop at real silences and use one contour point per attack", () => {
  const events = [
    { track: 1, beat: 1, duration: 1, writtenMidi: 64, x: 10 },
    { track: 1, beat: 1, duration: 1, writtenMidi: 67, x: 10 },
    { track: 1, beat: 2, duration: 1, writtenMidi: 69, x: 20 },
    { track: 1, beat: 5, duration: 1, writtenMidi: 71, x: 50 },
  ];
  const segments = visualVoiceSegments(events, 1, { x0: 0, x1: 60 });
  assert.deepEqual(segments.map(segment => segment.map(note => note.writtenMidi)), [[67, 69], [71]]);
});
