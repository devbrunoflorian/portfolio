import test from "node:test";
import assert from "node:assert/strict";
import { scoreGridStudy } from "../assets/about/score-grid-study-data.js";

test("the guitar notation grid represents the complete 106-bar source", () => {
  assert.match(scoreGridStudy.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(scoreGridStudy.bars.length, 106);
  assert.deepEqual(scoreGridStudy.bars.map(bar => bar.number), Array.from({ length: 106 }, (_, index) => index + 1));
  assert.equal(Object.keys(scoreGridStudy.patterns).length, 26);
});

test("repeated bars share one pattern while every event retains its musical timing", () => {
  const eventCount = scoreGridStudy.bars.reduce((sum, bar) => {
    const pattern = scoreGridStudy.patterns[bar.pattern];
    assert.ok(pattern, `bar ${bar.number} references an existing pattern`);
    assert.ok(pattern.sourceBar >= 1 && pattern.sourceBar <= 106);
    return sum + pattern.events.length;
  }, 0);
  const noteheadCount = scoreGridStudy.bars.reduce((sum, bar) => {
    return sum + scoreGridStudy.patterns[bar.pattern].events.reduce((barSum, event) => barSum + event.notes.length, 0);
  }, 0);
  const tiedNoteCount = scoreGridStudy.bars.reduce((sum, bar) => {
    return sum + scoreGridStudy.patterns[bar.pattern].events.reduce((barSum, event) => {
      return barSum + event.notes.filter(note => note.tie).length;
    }, 0);
  }, 0);

  assert.equal(eventCount, 1004);
  assert.equal(noteheadCount, 1005);
  assert.equal(tiedNoteCount, 9);
  assert.equal(scoreGridStudy.bars.length - Object.keys(scoreGridStudy.patterns).length, 80);

  for (const pattern of Object.values(scoreGridStudy.patterns)) {
    assert.ok(pattern.events.length > 0);
    for (const event of pattern.events) {
      assert.ok(Number.isInteger(event.beatTick));
      assert.ok(event.beatTick >= 0 && event.beatTick < scoreGridStudy.beatsPerBar * scoreGridStudy.subdivisionsPerBeat);
      assert.ok(Number.isInteger(event.durationTicks) && event.durationTicks > 0);
      assert.equal(event.rest, event.notes.length === 0);
      for (const note of event.notes) {
        assert.ok(Number.isInteger(note.soundingMidi));
        assert.ok(Number.isInteger(note.writtenMidi));
        assert.equal(note.writtenMidi, note.soundingMidi + 12);
      }
    }
  }
});

test("patterns are deduplicated by their complete written event sequence", () => {
  const signatures = Object.values(scoreGridStudy.patterns).map(pattern => JSON.stringify(pattern.events));
  assert.equal(new Set(signatures).size, signatures.length);

  for (const [patternId, pattern] of Object.entries(scoreGridStudy.patterns)) {
    assert.match(patternId, /^pattern-[a-f0-9]{16}$/);
    assert.ok(scoreGridStudy.bars.some(bar => bar.number === pattern.sourceBar && bar.pattern === patternId));
  }
});
