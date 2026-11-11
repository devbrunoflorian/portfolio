import test from "node:test";
import assert from "node:assert/strict";
import {
  SCORE_CAMERA_POSE_STOPS,
  createScoreCurve,
  createScoreJourneyCurve,
  scoreJourneyAtReadingLine,
  scorePoseAtReadingLine,
  scoreValueAtReadingLine,
} from "../assets/about-legacy/score-camera-journey.js";

const centers = [120, 640, 1980, 2650, 3360, 4020];

test("journey keyframes are exact and joins remain continuous", () => {
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
    assert.ok(Math.abs(exact.progress - 1) < 1e-12);
    assert.ok(Math.abs(before.normalizedProgress - after.normalizedProgress) < 1e-6);
    assert.ok(exact.velocity > 0, `journey should keep moving at chapter ${centerIndex}`);
  }

  const end = scoreJourneyAtReadingLine(centers.at(-1), centers);
  assert.equal(end.index, centers.length - 2);
  assert.equal(end.progress, 1);
  assert.equal(end.normalizedProgress, 1);
});

test("global chapter progress is reversible, monotonic, and eases at reading centers", () => {
  const positions = Array.from({ length: 1001 }, (_, index) => centers[0]
    + (centers.at(-1) - centers[0]) * index / 1000);
  const journeyValue = position => {
    const sample = scoreJourneyAtReadingLine(position, centers);
    return sample.index + sample.progress;
  };
  const down = positions.map(journeyValue);
  const up = [...positions].reverse().map(journeyValue);

  assert.deepEqual(up, [...down].reverse());
  assert.ok(down.every((value, index) => index === 0 || value >= down[index - 1]));
  for (let index = 1; index < centers.length - 1; index += 1) {
    const leftSecant = 1 / (centers[index] - centers[index - 1]);
    const rightSecant = 1 / (centers[index + 1] - centers[index]);
    const sample = scoreJourneyAtReadingLine(centers[index], centers);
    assert.ok(sample.velocity < Math.min(leftSecant, rightSecant));
  }
  assert.ok(down.every((value, index) => index === 0 || value > down[index - 1]));
});

test("global journey derivative is continuous and has bounded sampled acceleration", () => {
  for (let centerIndex = 1; centerIndex < centers.length - 1; centerIndex += 1) {
    const center = centers[centerIndex];
    const epsilon = Math.min(center - centers[centerIndex - 1], centers[centerIndex + 1] - center) * 1e-5;
    const leftVelocity = scoreJourneyAtReadingLine(center - epsilon, centers).velocity;
    const atCenter = scoreJourneyAtReadingLine(center, centers).velocity;
    const rightVelocity = scoreJourneyAtReadingLine(center + epsilon, centers).velocity;
    const tolerance = Math.max(1e-7, Math.abs(atCenter) * 1e-3);
    assert.ok(Math.abs(leftVelocity - atCenter) < tolerance);
    assert.ok(Math.abs(rightVelocity - atCenter) < tolerance);
  }

  const samples = Array.from({ length: 2001 }, (_, index) => scoreJourneyAtReadingLine(
    centers[0] + (centers.at(-1) - centers[0]) * index / 2000,
    centers,
  ));
  const acceleration = samples.slice(1).map((sample, index) => {
    const dx = (centers.at(-1) - centers[0]) / 2000;
    return Math.abs(sample.velocity - samples[index].velocity) / dx;
  });
  assert.ok(acceleration.every(Number.isFinite));
  assert.ok(Math.max(...acceleration) < 3e-5);
});

test("any scroll position maps to a bounded chapter and the path never overshoots a keyframe", () => {
  for (let position = centers[0] - 1000; position <= centers.at(-1) + 1000; position += 13) {
    const sample = scoreJourneyAtReadingLine(position, centers);
    assert.ok(sample.index >= 0 && sample.index < centers.length - 1);
    assert.ok(sample.progress >= 0 && sample.progress <= 1);
    assert.ok(sample.normalizedProgress >= 0 && sample.normalizedProgress <= 1);
    assert.ok(sample.velocity >= 0);
  }

  for (const poses of Object.values(SCORE_CAMERA_POSE_STOPS)) {
    for (let index = 0; index < centers.length - 1; index += 1) {
      for (let step = 0; step <= 100; step += 1) {
        const position = centers[index] + (centers[index + 1] - centers[index]) * step / 100;
        const sample = scorePoseAtReadingLine(position, centers, poses);
        assert.ok(sample.pose >= Math.min(poses[index], poses[index + 1]) - 1e-12);
        assert.ok(sample.pose <= Math.max(poses[index], poses[index + 1]) + 1e-12);
      }
    }
  }
});

test("GPU poses reach the approved frontal at Music and remain reversible", () => {
  for (const poses of Object.values(SCORE_CAMERA_POSE_STOPS)) {
    assert.equal(poses[2], 1);
    const positions = Array.from({ length: 1001 }, (_, index) => centers[0]
      + (centers.at(-1) - centers[0]) * index / 1000);
    const down = positions.map(position => scorePoseAtReadingLine(position, centers, poses).pose);
    const up = [...positions].reverse().map(position => scorePoseAtReadingLine(position, centers, poses).pose);
    assert.deepEqual(up, [...down].reverse());
    poses.forEach((pose, index) => assert.ok(Math.abs(
      scorePoseAtReadingLine(centers[index], centers, poses).pose - pose,
    ) < 1e-12));
  }
});

test("camera values share continuous derivatives across both rising and turning joins", () => {
  for (const stops of Object.values(SCORE_CAMERA_POSE_STOPS)) {
    for (let centerIndex = 1; centerIndex < centers.length - 1; centerIndex += 1) {
      const center = centers[centerIndex];
      const epsilon = Math.min(center - centers[centerIndex - 1], centers[centerIndex + 1] - center) * 1e-5;
      const left = scoreValueAtReadingLine(center - epsilon, centers, stops).velocity;
      const at = scoreValueAtReadingLine(center, centers, stops).velocity;
      const right = scoreValueAtReadingLine(center + epsilon, centers, stops).velocity;
      const tolerance = Math.max(1e-7, Math.abs(at) * 1e-3);
      assert.ok(Math.abs(left - at) < tolerance, `left derivative mismatch at ${centerIndex}`);
      assert.ok(Math.abs(right - at) < tolerance, `right derivative mismatch at ${centerIndex}`);
    }
  }
});

test("prepared camera curves reuse copied keyframes for repeated scroll samples", () => {
  const mutableCenters = [...centers];
  const mutableValues = [0, .13, 1, .42, .8, 1];
  const poseCurve = createScoreCurve(mutableCenters, mutableValues);
  const journeyCurve = createScoreJourneyCurve(mutableCenters);
  const positions = Array.from({ length: 101 }, (_, index) => centers[0]
    + (centers.at(-1) - centers[0]) * index / 100);
  const expectedPoses = positions.map(position => scoreValueAtReadingLine(position, centers, mutableValues));
  const expectedJourney = positions.map(position => scoreJourneyAtReadingLine(position, centers));

  mutableCenters.fill(-1);
  mutableValues.fill(-1);
  assert.deepEqual(positions.map(position => poseCurve(position)), expectedPoses);
  assert.deepEqual(positions.map(position => journeyCurve(position)), expectedJourney);
});

test("invalid centers, values, pose stops, and a stopped journey profile are rejected", () => {
  assert.throws(() => scoreJourneyAtReadingLine(0, [0]), /At least two/);
  assert.throws(() => scoreJourneyAtReadingLine(0, [0, 0]), /strictly increasing/);
  assert.throws(() => scoreJourneyAtReadingLine(0, [0, 1], 1), /in \[0,1\)/);
  assert.throws(() => scoreValueAtReadingLine(0, centers, [0, 1]), /match the chapter centers/);
  assert.throws(() => scorePoseAtReadingLine(0, centers, [0, .2]), /match the chapter centers/);
  assert.throws(() => scorePoseAtReadingLine(0, centers, [0, .2, 1.2, .4, .8, 1]), /within \[0,1\]/);
});
