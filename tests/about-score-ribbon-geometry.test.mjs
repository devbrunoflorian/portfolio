import test from "node:test";
import assert from "node:assert/strict";
import { createProjector } from "../assets/about/score-ribbon-geometry.js";

const study = { x0: 0, x1: 160, y0: -18, y1: 12, staffLines: [-8, -6, -4, -2, 0] };

test("Music is a uniform frontal projection of the editorial score", () => {
  const project = createProjector(1280, 800, study, 1);
  const a = project(20, -4);
  const b = project(40, -4);
  const c = project(40, 0);
  assert.ok(Math.abs(a.y - b.y) < 1e-8);
  assert.ok(Math.abs((b.x - a.x) / 20 - (c.y - b.y) / 4) < 1e-8);
  assert.ok(Math.abs(a.scale - c.scale) < 1e-8);
});

test("the return overlaps the outgoing branch at a distinct depth", () => {
  const project = createProjector(1280, 800, study, .6);
  const points = Array.from({ length: 201 }, (_, i) => project(i * .8, -4));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const crossings = [];
  for (let i = 0; i < 199; i += 1) {
    for (let j = i + 4; j < 200; j += 1) {
      const [a, b, c, d] = [points[i], points[i + 1], points[j], points[j + 1]];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) crossings.push([a, c]);
    }
  }
  assert.ok(crossings.length > 0);
  assert.ok(crossings.some(([a, b]) => Math.abs(a.depth - b.depth) > 200));
  assert.ok(points.some((p, i) => i && p.x < points[i - 1].x));
});

test("scroll reversal reconstructs the same note without pose history", () => {
  for (const width of [390, 1280]) {
    const forward = [.0, .35, .6, 1].map(pose => createProjector(width, 800, study, pose)(83, -6));
    const reverse = [1, .6, .35, .0].map(pose => createProjector(width, 800, study, pose)(83, -6)).reverse();
    assert.deepEqual(forward, reverse);
    assert.ok(forward.every(point => Object.values(point).every(Number.isFinite)));
  }
});

test("arc samples accumulate world distance and transported frames never flip", () => {
  const project = createProjector(1280, 800, study, .6);
  const samples = project.samples;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1]; const b = samples[i];
    assert.ok(Math.abs(b.distance - a.distance - Math.hypot(...b.position.map((v, axis) => v - a.position[axis]))) < 1e-8);
    assert.ok(b.normal.reduce((sum, v, axis) => sum + v * a.normal[axis], 0) > .95);
  }
});
