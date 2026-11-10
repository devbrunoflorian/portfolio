import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../assets/about-legacy/score.js";
import {
  contourPathForNotes,
  contourPoints,
  contourYForMidi,
  scoreNotesInWindow,
  scoreVoiceNotesInRange,
  staffYForMidi,
} from "../assets/about-legacy/score-visual.js";

test("only the two melodies enter the rolling score window", () => {
  const notes = scoreNotesInWindow(score, 136);
  assert.ok(notes.length > 0);
  assert.ok(notes.some(note => note.layer === "melodyOne"));
  assert.ok(notes.some(note => note.layer === "melodyTwo"));
  assert.ok(notes.every(note => ["melodyOne", "melodyTwo"].includes(note.layer)));
  assert.ok(notes.every(note => note.beat + note.duration >= 128 && note.beat <= 144));
});

test("the ending window retains long held notes without loading the whole MIDI", () => {
  const notes = scoreNotesInWindow(score, 424);
  assert.ok(notes.some(note => note.beat < 416 && note.beat + note.duration >= 416));
  assert.ok(notes.some(note => note.layer === "melodyOne"));
  assert.ok(notes.some(note => note.layer === "melodyTwo"));
});

test("the rolling window retains every visible voice event instead of sampling the melody", () => {
  const denseScore = {
    bars: 4,
    beatsPerBar: 4,
    tracks: [
      { id: 1, name: "Melody I", voice: "vocal" },
      { id: 2, name: "Melody II", voice: "vocal" },
      { id: 3, name: "Guitar I", voice: "guitar" },
    ],
    notes: Array.from({ length: 96 }, (_, index) => ({
      beat: 1 + index / 100,
      duration: .25,
      midi: 48 + index % 24,
      track: index % 2 ? 1 : 2,
    })),
  };
  assert.equal(scoreNotesInWindow(denseScore, 2, 4).length, 96);
});

test("each melody stays hidden until its first real entrance", () => {
  const shortScore = {
    bars: 4,
    beatsPerBar: 4,
    tracks: [
      { id: 1, name: "Melody I", voice: "vocal" },
      { id: 2, name: "Melody II", voice: "vocal" },
    ],
    notes: [
      { beat: 2, duration: 1, midi: 60, track: 1 },
      { beat: 3, duration: 1, midi: 67, track: 2 },
    ],
  };
  assert.deepEqual(scoreNotesInWindow(shortScore, 1.5, 4), []);
  assert.deepEqual(scoreNotesInWindow(shortScore, 2.5, 4).map(note => note.layer), ["melodyOne"]);
  assert.deepEqual(scoreNotesInWindow(shortScore, 3.5, 4).map(note => note.layer), ["melodyOne", "melodyTwo"]);
});

test("the static score system keeps voice entrances even when its center comes earlier", () => {
  const shortScore = {
    tracks: [
      { id: 1, name: "Melody I", voice: "vocal" },
      { id: 2, name: "Melody II", voice: "vocal" },
      { id: 3, name: "Guitar I", voice: "guitar" },
    ],
    notes: [
      { beat: 8, duration: 1, midi: 60, track: 1 },
      { beat: 10, duration: 1, midi: 67, track: 2 },
      { beat: 10, duration: 2, midi: 52, track: 3 },
    ],
  };

  assert.deepEqual(scoreNotesInWindow(shortScore, 6, 12), []);
  assert.deepEqual(scoreVoiceNotesInRange(shortScore, 0, 12).map(note => note.layer), ["melodyOne", "melodyTwo"]);
});

test("the complete static overlay preserves all 399 voice attacks", () => {
  const notes = scoreVoiceNotesInRange(score, 0, score.bars * score.beatsPerBar);
  assert.equal(notes.length, 399);
  assert.equal(notes.filter(note => note.layer === "melodyOne").length, 203);
  assert.equal(notes.filter(note => note.layer === "melodyTwo").length, 196);
  assert.equal(["melodyOne", "melodyTwo"]
    .reduce((total, layer) => total + contourPoints(notes.filter(note => note.layer === layer)).length, 0), 396);
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
