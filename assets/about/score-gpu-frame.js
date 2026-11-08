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
