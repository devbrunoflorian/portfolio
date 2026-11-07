import test from "node:test";
import assert from "node:assert/strict";
import { createProjector, createTravelProjector } from "../assets/about/score-ribbon-geometry.js";

const study = { x0: 0, x1: 160, y0: -18, y1: 12, staffLines: [-8, -6, -4, -2, 0] };

test('travel moves the observer and its look direction and retraces the same pose', () => {
  const a=createTravelProjector(1280,800,study,.25);
  const b=createTravelProjector(1280,800,study,.65);
  assert.ok(Math.hypot(...a.camera.position.map((v,i)=>v-b.camera.position[i]))>100);
  assert.ok(Math.hypot(...a.camera.forward.map((v,i)=>v-b.camera.forward[i]))>.1);
  const down=createTravelProjector(1280,800,study,.5)(125,-2);
  const up=createTravelProjector(1280,800,study,1-.5)(125,-2);
  assert.deepEqual(down,up);
});

test('travel has bounded discrete curvature and tangent turn around the 90 percent arrival', () => {
  for(let progress=.875;progress<=.950001;progress+=.0025){
    const samples=createTravelProjector(1280,800,study,progress).samples;
    for(let i=1;i<samples.length-1;i++){
      const v=samples[i].position.map((x,j)=>x-samples[i-1].position[j]);
      const w=samples[i+1].position.map((x,j)=>x-samples[i].position[j]);
      const l=Math.hypot(...v),r=Math.hypot(...w);
      assert.ok(l>0 && r>0,'No collapsed tangent');
      const cross=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
      const curvature=2*Math.hypot(...cross)/(l*r*(l+r));
      const turn=Math.acos(Math.max(-1,Math.min(1,v.reduce((sum,x,j)=>sum+x*w[j],0)/(l*r))));
      assert.ok(curvature<.05,'Curvature exceeds the inspected arrival bound');
      assert.ok(turn<.07,'Visible tangent kink');
    }
  }
});

test('entry crosses the left border and Music occupies 94 percent of the frame', () => {
  const entry = createProjector(1280, 800, study, 0);
  assert.ok(entry(0, -4).x < 0);
  assert.ok(entry(160, -4).x > 0);
  const front = createProjector(1280, 800, study, 1);
  assert.ok(Math.abs((front(160, -4).x - front(0, -4).x) / 1280 - .94) < 1e-8);
});

test('ten intermediate poses retrace the same note and scale it with depth', () => {
  const down = Array.from({length:12}, (_,i)=>createProjector(1280,800,study,i/11)(125,-2));
  const up = Array.from({length:12}, (_,i)=>createProjector(1280,800,study,1-i/11)(125,-2)).reverse();
  down.forEach((p,i)=>{
    assert.ok(Math.abs(p.x-up[i].x)<1e-8 && Math.abs(p.y-up[i].y)<1e-8);
  });
  assert.ok(Math.max(...down.map(p=>p.perspective)) > Math.min(...down.map(p=>p.perspective))*2);
});

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
