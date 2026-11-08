import test from "node:test";
import assert from "node:assert/strict";
import { SCORE_CAMERA_POSE_STOPS, scoreJourneyAtReadingLine, scorePoseAtReadingLine } from "../assets/about/score-camera-journey.js";

const centers = [120, 640, 1980, 2650, 3360, 4020];

test("camera poses land on each chapter center and stay continuous at joins", () => {
  const start = scoreJourneyAtReadingLine(centers[0], centers);
  assert.equal(start.index, 0);
  assert.equal(start.progress, 0);
  assert.equal(start.normalizedProgress, 0);

  for (let centerIndex = 1; centerIndex < centers.length - 1; centerIndex += 1) {
    const center = centers[centerIndex];
    const before = scoreJourneyAtReadingLine(center - .001, centers);
    const exact = scoreJourneyAtReadingLine(center, centers);
    const after = scoreJourneyAtReadingLine(center + .001, centers);
    assert.equal(exact.index, centerIndex - 1);
    assert.equal(exact.progress, 1);
    assert.ok(Math.abs(before.progress - 1) < 1e-5);
    assert.equal(after.index, centerIndex);
    assert.ok(after.progress < 1e-5);
    assert.ok(Math.abs(before.normalizedProgress - after.normalizedProgress) < 1e-5);
  }

  const end = scoreJourneyAtReadingLine(centers.at(-1), centers);
  assert.equal(end.index, centers.length - 2);
  assert.equal(end.progress, 1);
  assert.equal(end.normalizedProgress, 1);
});

test("travel is reversible and slows near reading centers without stopping", () => {
  const start = centers[1];
  const end = centers[2];
  const positions = Array.from({ length: 101 }, (_, index) => start + (end - start) * index / 100);
  const journeyValue = position => {
    const sample = scoreJourneyAtReadingLine(position, centers);
    return sample.index + sample.progress;
  };
  const down = positions.map(journeyValue);
  const up = [...positions].reverse().map(journeyValue);

  assert.deepEqual(up, [...down].reverse());
  assert.ok(down.every((value, index) => index === 0 || value >= down[index - 1]));
  const localTravel = down.map(value => value - down[0]);
  assert.ok(localTravel[10] > 0 && localTravel[10] < .1);
  assert.ok(localTravel[50] >= .5);
  assert.ok(localTravel[90] > .9 && localTravel[90] < 1);
  assert.ok(localTravel[1] > 0);
  assert.ok(localTravel.at(-2) < 1);
  assert.ok(localTravel[1] - localTravel[0] < localTravel[50] - localTravel[49]);
  assert.ok(localTravel[100] - localTravel[99] < localTravel[50] - localTravel[49]);
});

test("any scroll position maps to a bounded chapter segment and page progress", () => {
  for (let position = centers[0] - 1000; position <= centers.at(-1) + 1000; position += 13) {
    const sample = scoreJourneyAtReadingLine(position, centers);
    assert.ok(sample.index >= 0 && sample.index < centers.length - 1);
    assert.ok(sample.progress >= 0 && sample.progress <= 1);
    assert.ok(sample.normalizedProgress >= 0 && sample.normalizedProgress <= 1);
  }
});

test("GPU camera traverses every chapter keyframe continuously and reversibly", () => {
  const positions = Array.from({ length: 1001 }, (_, index) => centers[0]
    + (centers.at(-1) - centers[0]) * index / 1000);
  for (const poses of Object.values(SCORE_CAMERA_POSE_STOPS)) {
    const poseAt = position => scorePoseAtReadingLine(position, centers, poses).pose;
    const down = positions.map(poseAt);
    const up = [...positions].reverse().map(poseAt);

    assert.deepEqual(up, [...down].reverse());
    assert.ok(down.every((pose, index) => index === 0 || pose > down[index - 1]));
    poses.forEach((pose, index) => assert.ok(Math.abs(poseAt(centers[index]) - pose) < 1e-12));
    const frameTravel = down.slice(1).map((pose, index) => pose - down[index]);
    assert.ok(frameTravel.every(delta => delta > 0 && delta < .01));
    const frameAcceleration = frameTravel.slice(1).map((speed, index) => speed - frameTravel[index]);
    assert.ok(frameAcceleration.every(delta => Math.abs(delta) < .002));
  }
});

test("camera pose stops must provide one increasing pose for each chapter", () => {
  assert.throws(() => scorePoseAtReadingLine(0, centers, [0, .2]), /must match/);
  assert.throws(() => scorePoseAtReadingLine(0, centers, [0, .2, .2, .5, .7, 1]), /must match/);
  assert.throws(() => scorePoseAtReadingLine(0, centers, [0, .2, .4, .6, 1.2, 1.3]), /must match/);
});

test("invalid chapter centers and a stopped travel profile are rejected", () => {
  assert.throws(() => scoreJourneyAtReadingLine(0, [0]), /At least two/);
  assert.throws(() => scoreJourneyAtReadingLine(0, [0, 0]), /strictly increasing/);
  assert.throws(() => scoreJourneyAtReadingLine(0, [0, 1], 1), /in \[0,1\)/);
});
