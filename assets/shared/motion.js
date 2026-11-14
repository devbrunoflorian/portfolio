export const MOTION = Object.freeze({
  opening: Object.freeze({ syllableRiseEm: 0.08, bodyRiseEm: 0.16 }),
  scrollFill: Object.freeze({ start: 0.86, finish: 0.46 }),
});

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

export function easeInCubic(value) {
  return clamp01(value) ** 3;
}

export function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function scrollFillProgress(top, viewportHeight, timing = MOTION.scrollFill) {
  if (!Number.isFinite(top) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  const startLine = viewportHeight * timing.start;
  const finishLine = viewportHeight * timing.finish;
  return clamp01((startLine - top) / (startLine - finishLine));
}
