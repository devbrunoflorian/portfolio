import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../assets/about/score.js";
import { contourPathForNotes, contourPoints, contourYForMidi, scoreNotesInWindow, staffYForMidi } from "../assets/about/score-visual.js";

test("only the two melodies enter the rolling score window", () => {
  const notes = scoreNotesInWindow(score, 136);
  assert.ok(notes.length > 0 && notes.length <= 80);
  assert.ok(notes.some(note => note.layer === "melodyOne"));
  assert.ok(notes.some(note => note.layer === "melodyTwo"));
  assert.ok(notes.every(note => ["melodyOne", "melodyTwo"].includes(note.layer)));
  assert.ok(notes.every(note => note.beat + note.duration >= 128 && note.beat <= 144));
});

test("the ending window retains long held notes without loading the whole MIDI", () => {
  const notes = scoreNotesInWindow(score, 424);
  assert.ok(notes.length <= 80);
  assert.ok(notes.some(note => note.beat < 416 && note.beat + note.duration >= 416));
  assert.ok(notes.some(note => note.layer === "melodyOne"));
  assert.ok(notes.some(note => note.layer === "melodyTwo"));
});

test("the two voice contours collapse simultaneous pitches and hold before a smooth transition", () => {
  const points = contourPoints([
    { beat: 1, duration: .5, midi: 60 },
    { beat: 1, duration: 1, midi: 64 },
    { beat: 2, duration: .5, midi: 67 },
  ]);
  assert.deepEqual(points, [
    { beat: 1, midi: 64, duration: 1 },
    { beat: 2, midi: 67, duration: .5 },
  ]);
  const path = contourPathForNotes([{ beat: 1, duration: .5, midi: 60 }, { beat: 2, duration: .5, midi: 64 }], 1.5, {
    cursorX: 100, pixelsPerBeat: 50, staffBottomY: 151, halfStepY: 5.25,
  });
  assert.match(path, /^M 75\.0 124\.8 L 96\.0 124\.8 C 108\.2 124\.8 112\.8 114\.3 125\.0 114\.3 L 150\.0 114\.3$/);
});

test("voice pitches follow the written treble score in a shared register", () => {
  const desktop = { staffBottomY: 151, halfStepY: 5.25 };
  const mobile = { staffBottomY: 136, halfStepY: 2.75 };
  assert.equal(staffYForMidi(64, 151, 5.25), 151); // E4, bottom staff line
  assert.equal(staffYForMidi(71, 151, 5.25), 130); // B4, middle staff line
  assert.equal(contourYForMidi(59, desktop), 130); // MIDI B3 is written as B4 in the supplied score
  assert.equal(contourYForMidi(59, mobile), 125);
});
