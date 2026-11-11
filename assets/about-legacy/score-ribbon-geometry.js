const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = a => { const length = Math.hypot(...a); return a.map(v => v / (length || 1)); };

const loop = [
  [[-.65, .38, .65], [-.1, .5, .55], [.78, .05, -.75], [.44, -.24, -.85]],
  [[.44, -.24, -.85], [.10, -.53, -.95], [-.58, -.25, .25], [-.24, .05, .72]],
  [[-.24, .05, .72], [.10, .35, 1.19], [.45, .18, -.12], [.66, -.02, -.38]],
];

function loopPoint(t) {
  const segment = Math.min(2, Math.floor(t * 3));
  const u = t * 3 - segment;
  const v = 1 - u;
  return loop[segment][0].map((_, axis) => v ** 3 * loop[segment][0][axis]
    + 3 * v * v * u * loop[segment][1][axis]
    + 3 * v * u * u * loop[segment][2][axis] + u ** 3 * loop[segment][3][axis]);
}

/** Arc distance is measured in world units, before perspective. No mutable pose history. */
export function createProjector(width, height, study, progress = 1, view = study, traveling = false, verticalOffset = 0) {
  const pose = clamp(progress ?? 1);
  const tail = clamp((1 - pose) / .25);
  const fold = Math.sin(Math.PI * pose) ** 1.3 * (traveling ? tail * tail * (3 - 2 * tail) : 1);
  const rangeX = view.x1 - view.x0;
  const inset = width * .03;
  const unitScale = Math.min((width - inset * 2) / rangeX, (height - 76) / (study.y1 - study.y0));
  const middle = (study.staffLines[0] + study.staffLines.at(-1)) / 2;
  const center = t => {
    const curved = loopPoint(t);
    const flat = [(t - .5) * rangeX * unitScale, 0, 0];
    const entry = [(-.68 + 1.7 * t) * width, (.25 - .46 * t) * height, (.45 - 1.8 * t) * width];
    const distant = (1 - pose) * (1 - fold);
    const frontal = pose * (1 - fold);
    return [
      flat[0] * frontal + curved[0] * width * fold + entry[0] * distant,
      curved[1] * height * fold + entry[1] * distant,
      curved[2] * width * fold + entry[2] * distant,
    ];
  };
  const count = 360;
  const samples = Array.from({ length: count + 1 }, (_, i) => ({ position: center(i / count), distance: 0 }));
  let normal = [0, 1, 0];
  let previousTangent = normalize(subtract(samples[1].position, samples[0].position));
  normal = normalize(subtract(normal, previousTangent.map(v => v * dot(normal, previousTangent))));
  samples.forEach((sample, i) => {
    if (i) sample.distance = samples[i - 1].distance + Math.hypot(...subtract(sample.position, samples[i - 1].position));
    const tangent = normalize(subtract(samples[Math.min(count, i + 1)].position, samples[Math.max(0, i - 1)].position));
    const axis = cross(previousTangent, tangent);
    const cosine = dot(previousTangent, tangent);
    // Minimal rotation parallel-transports the transverse vector without a sign switch at the return.
    const first = cross(axis, normal);
    const second = cross(axis, first);
    normal = normalize(normal.map((v, j) => v + first[j] + second[j] / Math.max(.00001, 1 + cosine)));
    sample.normal = normal;
    previousTangent = tangent;
  });
  const totalLength = samples.at(-1).distance;
  const journey = Math.sin(Math.PI * pose) ** 2;
  const cameraPosition = traveling ? [width * .22 * Math.sin(pose * Math.PI * 2) * journey,
    -height * .18 * journey, width * (1.45 - .3 * journey)] : [0, 0, width * 1.45];
  const cameraTarget = traveling ? [width * .16 * Math.sin(Math.PI * pose) * journey,
    height * .38 * journey, width * .12 * journey] : [0,0,0];
  const forward = normalize(subtract(cameraTarget,cameraPosition));
  const right = normalize(cross(forward,[0,1,0]));
  const up = normalize(cross(right,forward));
  const project = (x, y) => {
    const u = (x - view.x0) / rangeX;
    const distance = clamp(u) * totalLength;
    let low = 0;
    let high = count;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (samples[mid].distance < distance) low = mid; else high = mid;
    }
    const a = samples[low];
    const b = samples[high];
    const t = (distance - a.distance) / Math.max(.00001, b.distance - a.distance);
    const position = a.position.map((v, i) => mix(v, b.position[i], t));
    const transverse = normalize(a.normal.map((v, i) => mix(v, b.normal[i], t)));
    const offset = (y - middle) * unitScale;
    const point = position.map((v, i) => v + transverse[i] * offset);
    const relative = subtract(point,cameraPosition);
    const distanceToCamera = dot(relative,forward);
    const perspective = width * 1.45 / distanceToCamera;
    return { x: width * .5 + dot(relative,right) * perspective, y: height * .5 + verticalOffset + dot(relative,up) * perspective,
      depth: -distanceToCamera, perspective, scale: unitScale * perspective, u };
  };
  project.samples = samples;
  project.arcLength = totalLength;
  project.camera = { position: cameraPosition, target: cameraTarget, forward };
  return project;
}

export { createTravelProjector } from './score-travel-geometry.js';
