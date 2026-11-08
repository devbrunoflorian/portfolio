function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const SCORE_CAMERA_POSE_STOPS = Object.freeze({
  desktop: Object.freeze([0, .14, .50, .60, .83, 1]),
  mobile: Object.freeze([0, .17, .55, .65, .88, 1]),
});

/**
 * Pick a reversible camera segment between chapter reading centers.
 * The travel profile slows near each center without ever stopping.
 */
export function scoreJourneyAtReadingLine(readingLine, chapterCenters, amplitude = .65) {
  if (!Number.isFinite(readingLine)) throw new TypeError('Reading line must be finite.');
  if (!Array.isArray(chapterCenters) || chapterCenters.length < 2
    || chapterCenters.some(center => !Number.isFinite(center))) {
    throw new TypeError('At least two finite chapter centers are required.');
  }
  if (chapterCenters.some((center, index) => index > 0 && center <= chapterCenters[index - 1])) {
    throw new RangeError('Chapter centers must be strictly increasing.');
  }
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude >= 1) {
    throw new RangeError('Travel amplitude must be in [0,1).');
  }

  const first = chapterCenters[0];
  const last = chapterCenters.at(-1);
  const normalizedProgress = clamp((readingLine - first) / (last - first), 0, 1);
  let index = 0;
  while (index < chapterCenters.length - 2 && readingLine > chapterCenters[index + 1]) index += 1;

  const start = chapterCenters[index];
  const end = chapterCenters[index + 1];
  const linearProgress = clamp((readingLine - start) / (end - start), 0, 1);
  const easedProgress = linearProgress
    - amplitude * Math.sin(2 * Math.PI * linearProgress) / (2 * Math.PI);

  return { index, linearProgress, progress: easedProgress, normalizedProgress };
}

/** Map the continuous reading journey onto monotonically ordered GPU camera poses. */
export function scorePoseAtReadingLine(readingLine, chapterCenters, poseStops, amplitude = .65) {
  if (!Array.isArray(poseStops) || poseStops.length !== chapterCenters?.length
    || poseStops.some(pose => !Number.isFinite(pose) || pose < 0 || pose > 1)
    || poseStops.some((pose, index) => index > 0 && pose <= poseStops[index - 1])) {
    throw new RangeError('Camera pose stops must match the chapter centers and increase within [0,1].');
  }
  const journey = scoreJourneyAtReadingLine(readingLine, chapterCenters, amplitude);
  const start = poseStops[journey.index];
  const end = poseStops[journey.index + 1];
  return { ...journey, pose: start + (end - start) * journey.progress };
}
