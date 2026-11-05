import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../assets/about/score.js";
import { beatToSeconds, createScoreTransport, harmonyNotes, secondsToBeat } from "../assets/about/transport.js";
import { knightMoves } from "../assets/about/experiments.js";

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
  assert.equal(score.notes.length, 4099);
  assert.equal(score.tracks.filter(track => track.notes > 0).length, 6);
  assert.deepEqual(score.sections.map(section => section.name), ["Intro", "Verso I", "Ponte I", "Refrão I", "Verso II", "Ponte II", "Refrão II", "Pós Refrão"]);
  assert.match(score.sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(original);
  assert.deepEqual({ midi: repeated.midi, time: repeated.time }, { midi: original.midi, time: score.durationSeconds });
  assert.ok(events.some(event => event.beat >= 408 && event.beat < endBeat));
  assert.ok(score.notes.some(note => Math.abs(note.beat + note.duration - endBeat) < 1e-6));
});

test("tempo map preserves the final rallentando and its inverse", () => {
  assert.ok(Math.abs(score.durationSeconds - 249.95142925) < 1e-6);
  assert.ok(score.tempoMap.some(change => change.beat === 411 && change.tempo === 618556));
  for (const beat of [0, 32, 128, 256, 400, 411, 423.5, 424]) {
    assert.ok(Math.abs(secondsToBeat(score, beatToSeconds(score, beat)) - beat) < 1e-6);
  }
});

test("turning off repeat stops scheduling at the end of the source", () => {
  const transport = createScoreTransport(score, "opening", 0, false);
  assert.equal(transport.readUntil(425).length, score.notes.length);
  assert.deepEqual(transport.readUntil(600), []);
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
