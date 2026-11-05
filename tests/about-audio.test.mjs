import test from "node:test";
import assert from "node:assert/strict";
import { createJourneyAudio } from "../assets/about/audio.js";
import { score } from "../assets/about/score.js";

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

test("track highlighting attenuates other source buses and restores the original mix", async () => {
  const audio = createJourneyAudio(score, () => {}, { Context: FakeContext });
  try {
    await audio.start();
    const buses = FakeContext.latest.gains.slice(1, score.tracks.length + 1);
    assert.equal(buses.length, score.tracks.length);
    assert.ok(buses.every(bus => bus.gain.value === 1));
    assert.equal(audio.highlightTrack(4), true);
    assert.equal(buses[3].gain.value, 1);
    assert.ok(buses.filter((_, index) => index !== 3).every(bus => bus.gain.value === .18));
    assert.equal(audio.highlightTrack(404), false);
    assert.equal(audio.highlightTrack(null), true);
    assert.ok(buses.every(bus => bus.gain.value === 1));
  } finally {
    audio.dispose();
  }
});
