import { createTravelProjector } from './score-travel-geometry.js';

// Aim at points on the actual score, including the start of its header.
// The middle staff line has no vertical displacement, so these samples
// also apply when playback loads a measure window of a different width.
export function measureJourneyFrames(anchors, poses, zooms, mobile) {
  const width = window.innerWidth, height = window.innerHeight;
  const staff = { staffLines: [-8, -6, -4, -2, 0] };
  const range = { x0: 0, x1: 1 };
  const aimU = [0, .44, 0, .52, .51, .5];
  return anchors.map((anchor, index) => {
    const bounds = anchor.getBoundingClientRect();
    const project = createTravelProjector(width, height, staff, poses[index], range, .2, true, null, zooms[index]);
    const staffPoint = project(aimU[index], -4);
    let targetX = bounds.left + bounds.width * .5;
    let targetY = height * .52;
    if (index === 0) {
      // The entry curve starts at the left edge and halfway down its own viewport.
      return { x: bounds.left + bounds.width * (mobile ? .05 : .09), y: targetY - height / 2 };
    }
    if (index === 2) targetX = mobile ? 16 : (width - Math.min(width * .9, 1630)) / 2;
    if (index === 4) targetY += Math.min(height * .13, 96);
    if (index === 5) targetY += Math.min(height * .25, 180);
    return { x: targetX - staffPoint.x, y: targetY - staffPoint.y };
  });
}

/** Map the editorial chapter frame onto the GPU camera without moving its DOM canvas. */
export function createGpuEditorialFrame(current, music, baseZoom = 1) {
  for (const [label, frame] of [["current", current], ["music", music]]) {
    if (!frame || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)
      || !Number.isFinite(frame.scale) || frame.scale <= 0) {
      throw new TypeError(`The ${label} score frame must have finite x/y and a positive scale.`);
    }
  }
  if (!Number.isFinite(baseZoom) || baseZoom <= 0) {
    throw new RangeError("The base camera zoom must be positive and finite.");
  }
  return {
    offset: { x: current.x - music.x, y: current.y - music.y },
    zoom: baseZoom * current.scale / music.scale,
  };
}
