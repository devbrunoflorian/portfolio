import test from "node:test";
import assert from "node:assert/strict";
import { createJourneyAudio, playbackPositionForDisplay } from "../assets/about-legacy/audio.js";
import { score } from "../assets/about-legacy/score.js";

function parameter(value = 0) {
  return {
    value,
    setTargetAtTime(next) { this.value = next; },
    setValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; },
  };
}

class FakeNode {
  constructor() {
    this.gain = parameter(1);
    this.frequency = parameter();
    this.Q = parameter();
    this.threshold = parameter();
    this.knee = parameter();
    this.ratio = parameter();
  }
  connect(node) { return node; }
  disconnect() {}
  start() {}
  stop() {}
}

class FakeContext {
  static latest;
  constructor() {
    FakeContext.latest = this;
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.destination = new FakeNode();
    this.state = "suspended";
    this.gains = [];
  }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node; }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  getOutputTimestamp() { return { contextTime: this.currentTime, performanceTime: performance.now() }; }
  async resume() { this.state = "running"; }
  async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
}

test("audio snapshot follows the output clock and survives pause and resume", async () => {
  const audio = createJourneyAudio(score, () => {}, { Context: FakeContext });
  try {
    assert.deepEqual(audio.snapshot(), { state: "off", beat: 0, seconds: 0, section: "Intro" });
    await audio.start();
    const context = FakeContext.latest;
    context.currentTime = 12;
    const playing = audio.snapshot();
    assert.equal(playing.state, "playing");
    assert.ok(playing.beat > 0);
    assert.ok(playing.seconds > 11 && playing.seconds < 12);
    audio.pause();
    const paused = audio.snapshot();
    context.currentTime = 20;
    assert.deepEqual(audio.snapshot(), paused);
    await audio.start();
    context.currentTime += .06; // The transport schedules the resumed attack 60 ms ahead.
    const resumed = audio.snapshot();
    assert.equal(resumed.state, "playing");
    assert.ok(Math.abs(resumed.beat - paused.beat) < .01);
  } finally {
    audio.dispose();
  }
});

test("voice tracks start ahead of guitar and strings, and their buses follow mixer values", async () => {
  const audio = createJourneyAudio(score, () => {}, { Context: FakeContext });
  try {
    const vocals = score.tracks.filter(track => track.voice === "vocal");
    const guitar = score.tracks.find(track => track.voice === "guitar");
    const strings = score.tracks.find(track => track.voice === "strings");
    assert.equal(vocals.length, 2);
    assert.deepEqual(score.tracks.map(track => track.voice), ["vocal", "vocal", "guitar", "strings"]);
    assert.ok(vocals.every(track => audio.getTrackVolume(track.id) === 1));
    assert.ok(vocals.every(track => audio.getTrackVolume(track.id) > audio.getTrackVolume(guitar.id)));
    assert.ok(vocals.every(track => audio.getTrackVolume(track.id) > audio.getTrackVolume(strings.id)));

    await audio.start();
    const buses = FakeContext.latest.gains.slice(1, score.tracks.length + 1);
    assert.equal(buses.length, score.tracks.length);
    assert.equal(buses[0].gain.value, 1);
    assert.equal(buses[1].gain.value, 1);
    assert.equal(buses[2].gain.value, 72 / 127);
    assert.equal(buses[3].gain.value, .18);
    assert.equal(audio.setTrackVolume(guitar.id, .4), true);
    assert.equal(audio.getTrackVolume(guitar.id), .4);
    assert.equal(buses[2].gain.value, .4);
    assert.equal(audio.setTrackVolume(404, .5), false);
    assert.equal(audio.getTrackVolume(404), null);
  } finally {
    audio.dispose();
  }
});

test("a completed one-shot stays finished when the page asks to pause it", async () => {
  const audio = createJourneyAudio(score, () => {}, { Context: FakeContext });
  try {
    audio.pause();
    assert.equal(audio.snapshot().state, "off");
    await audio.start();
    audio.setRepeat(false);
    const context = FakeContext.latest;
    context.currentTime = score.durationSeconds + 1;
    await new Promise(resolve => setTimeout(resolve, 35));
    const finished = audio.snapshot();
    assert.equal(finished.state, "finished");
    assert.equal(finished.beat, score.bars * score.beatsPerBar);
    assert.equal(finished.seconds, score.durationSeconds);
    audio.pause();
    assert.deepEqual(audio.snapshot(), finished);
  } finally {
    audio.dispose();
  }
});

test("display position wraps repeats but preserves the completed ending", () => {
  const span = score.bars * score.beatsPerBar;
  assert.deepEqual(playbackPositionForDisplay({ state: "playing", beat: span + 3, seconds: score.durationSeconds + 1.5 }, score), {
    beat: 3,
    seconds: 1.5,
  });
  assert.deepEqual(playbackPositionForDisplay({ state: "finished", beat: span, seconds: score.durationSeconds }, score), {
    beat: span,
    seconds: score.durationSeconds,
  });
});
