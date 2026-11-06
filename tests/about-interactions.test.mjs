import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../assets/about/score.js";
import { activeNotesAt, beatToSeconds, createScoreTransport, harmonyNotes, secondsToBeat } from "../assets/about/transport.js";
import { knightChallenges, knightMoves } from "../assets/about/experiments.js";

test("transport replaces unscheduled movement requests at the next bar", () => {
  const source = {
    bars: 2,
    beatsPerBar: 4,
    notes: [
      { beat: 0, duration: 1, midi: 60, velocity: 90, voice: "guitar" },
      { beat: 4, duration: 1, midi: 64, velocity: 90, voice: "guitar" },
      { beat: 0, duration: 4, midi: 36, velocity: 90, voice: "bass" },
    ],
  };
  const transport = createScoreTransport(source);
  transport.requestMovement("code", .2);
  transport.requestMovement("games", 1.2);
  assert.equal(transport.pendingAt(0).movement, "games");
  const events = transport.readUntil(4);
  assert.equal(events.find(event => event.beat === 4).movement, "games");
  assert.equal(transport.movementAt(3.99), "opening");
  assert.equal(transport.movementAt(4), "games");

  transport.requestMovement("art", 4);
  assert.equal(transport.pendingAt(4).beat, 8);
  assert.equal(transport.readUntil(8).find(event => event.beat === 8).movement, "art");
});

test("full composition reaches its ending before repeating the Intro", () => {
  const transport = createScoreTransport(score);
  const endBeat = score.bars * score.beatsPerBar;
  const events = transport.readUntil(endBeat + 0.01);
  const original = events.find(event => event.beat === 0 && event.voice === "guitar");
  const repeated = events.find(event => event.beat === endBeat && event.voice === "guitar");
  assert.equal(score.bpm, 102);
  assert.equal(score.beatsPerBar, 4);
  assert.equal(score.bars, 106);
  assert.equal(score.notes.length, 1471);
  assert.equal(score.tracks.filter(track => track.notes > 0).length, 4);
  assert.deepEqual(score.tracks.map(track => track.name), ["Melody I", "Melody II", "Guitar I", "Strings"]);
  assert.deepEqual(score.tracks.map(track => track.voice), ["vocal", "vocal", "guitar", "strings"]);
  assert.ok(score.notes.every(note => note.voice !== "bass" && note.voice !== "percussion"));
  assert.deepEqual(score.tracks.map(track => track.notes), [203, 196, 1004, 68]);
  assert.equal(Math.min(...score.notes.filter(note => note.voice === "strings").map(note => note.beat)), 256);
  assert.deepEqual(score.sections.map(section => section.name), ["Intro", "Verso I", "Ponte I", "Refrão I", "Verso II", "Ponte II", "Refrão II", "Pós Refrão"]);
  assert.equal(score.sectionSource, "prior export markers; Melody events unchanged");
  assert.equal(score.sourceSha256, "a1c14c40d3219d125eb4c1f8667cc372a2c938e96e8b13b42b66d9e8698c9da3");
  assert.match(score.sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(original);
  assert.deepEqual({ midi: repeated.midi, time: repeated.time }, { midi: original.midi, time: score.durationSeconds });
  assert.ok(events.some(event => event.beat >= 408 && event.beat < endBeat));
  assert.ok(score.notes.some(note => Math.abs(note.beat + note.duration - endBeat) < 1e-6));
});

test("final export keeps its constant tempo and invertible beat map", () => {
  assert.ok(Math.abs(score.durationSeconds - 249.41164) < 1e-6);
  assert.equal(score.tempoMap.length, 1);
  assert.deepEqual(score.tempoMap[0], { tick: 0, beat: 0, seconds: 0, tempo: 588235 });
  for (const beat of [0, 32, 128, 256, 400, 411, 423.5, 424]) {
    assert.ok(Math.abs(secondsToBeat(score, beatToSeconds(score, beat)) - beat) < 1e-6);
  }
});

test("turning off repeat stops scheduling at the end of the source", () => {
  const transport = createScoreTransport(score, "opening", 0, false);
  assert.equal(transport.readUntil(425).length, score.notes.length);
  assert.deepEqual(transport.readUntil(600), []);
});

test("repeat toggles do not schedule an early Intro and can be restored near the ending", () => {
  const endBeat = score.bars * score.beatsPerBar;
  const looping = createScoreTransport(score, "opening", 0, true);
  assert.equal(looping.readUntil(endBeat - .01).length, score.notes.length);
  looping.setRepeat(false, endBeat - .01);
  assert.equal(looping.endBeat, endBeat);
  assert.deepEqual(looping.readUntil(endBeat + .2), []);

  const oneShot = createScoreTransport(score, "opening", 0, false);
  assert.equal(oneShot.readUntil(endBeat - .01).length, score.notes.length);
  oneShot.setRepeat(true, endBeat - .01);
  const intro = oneShot.readUntil(endBeat + .2);
  assert.ok(intro.length > 0);
  assert.ok(intro.every(event => event.beat >= endBeat));
});

test("a paused sustained chord can resume for its remaining duration", () => {
  const held = activeNotesAt(score, 420);
  assert.ok(held.some(note => note.voice === "guitar"));
  assert.ok(held.every(note => note.beat < 420 && note.beat + note.duration > 420));
  assert.deepEqual(activeNotesAt(score, 424), []);
  assert.deepEqual(activeNotesAt(score, 420 + 424), held);
});

test("harmony voicings stay within the keyboard and include the bass notes", () => {
  assert.deepEqual(harmonyNotes.em, [52, 55, 59, 66]);
  assert.deepEqual(harmonyNotes.c, [48, 52, 55, 59]);
  assert.deepEqual(harmonyNotes.am, [45, 48, 52, 55, 59]);
  assert.ok(Object.values(harmonyNotes).flat().every(note => note >= 21 && note <= 108));
});

test("the knight can only reach legal squares on the five-square board", () => {
  assert.deepEqual(knightMoves(0), [11, 7]);
  assert.deepEqual(knightMoves(12).sort((a, b) => a - b), [1, 3, 5, 9, 15, 19, 21, 23]);
  assert.equal(knightMoves(12).length, 8);
});

test("each optional knight puzzle has a legal path within its move limit", () => {
  assert.equal(knightChallenges.length, 2);
  for (const challenge of knightChallenges) {
    assert.equal(challenge.path[0], challenge.start);
    assert.equal(challenge.path.at(-1), challenge.target);
    assert.ok(challenge.path.length - 1 <= challenge.limit);
    for (let step = 1; step < challenge.path.length; step += 1) {
      assert.ok(knightMoves(challenge.path[step - 1]).includes(challenge.path[step]));
    }
  }
});
