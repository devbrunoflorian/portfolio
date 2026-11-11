function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const SCORE_CAMERA_POSE_STOPS = Object.freeze({
  desktop: Object.freeze([0, .13, 1, .42, .8, 1]),
  mobile: Object.freeze([0, .17, 1, .4, .83, 1]),
});

function validateCurve(readingLine, chapterCenters, values, amplitude) {
  if (!Number.isFinite(readingLine)) throw new TypeError('Reading line must be finite.');
  if (!Array.isArray(chapterCenters) || chapterCenters.length < 2
    || chapterCenters.some(center => !Number.isFinite(center))) {
    throw new TypeError('At least two finite chapter centers are required.');
  }
  if (chapterCenters.some((center, index) => index > 0 && center <= chapterCenters[index - 1])) {
    throw new RangeError('Chapter centers must be strictly increasing.');
  }
  if (!Array.isArray(values) || values.length !== chapterCenters.length
    || values.some(value => !Number.isFinite(value))) {
    throw new RangeError('Camera stops must match the chapter centers and be finite.');
  }
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude >= 1) {
    throw new RangeError('Travel amplitude must be in [0,1).');
  }
}

function endpointTangent(firstWidth, secondWidth, firstSlope, secondSlope) {
  let tangent = ((2 * firstWidth + secondWidth) * firstSlope - firstWidth * secondSlope)
    / (firstWidth + secondWidth);
  if (Math.sign(tangent) !== Math.sign(firstSlope)) return 0;
  if (Math.sign(firstSlope) !== Math.sign(secondSlope)
    && Math.abs(tangent) > Math.abs(3 * firstSlope)) {
    tangent = 3 * firstSlope;
  }
  return tangent;
}

function tangentsFor(chapterCenters, values, amplitude) {
  const widths = chapterCenters.slice(1).map((center, index) => center - chapterCenters[index]);
  const slopes = values.slice(1).map((value, index) => (value - values[index]) / widths[index]);
  if (slopes.length === 1) return [slopes[0], slopes[0]];

  const tangents = new Array(values.length);
  tangents[0] = endpointTangent(widths[0], widths[1], slopes[0], slopes[1]);
  tangents[tangents.length - 1] = endpointTangent(
    widths.at(-1),
    widths.at(-2),
    slopes.at(-1),
    slopes.at(-2),
  );

  for (let index = 1; index < values.length - 1; index += 1) {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) {
      tangents[index] = 0;
      continue;
    }
    const beforeWeight = 2 * widths[index] + widths[index - 1];
    const afterWeight = widths[index] + 2 * widths[index - 1];
    tangents[index] = (beforeWeight + afterWeight)
      / (beforeWeight / before + afterWeight / after);
  }

  // A shared tangent at every chapter center keeps joins C1 while slowing the
  // camera around reading zones. Shape-preserving slopes prevent overshoot.
  const centerRate = 1 - amplitude;
  const slowed = tangents.map(tangent => tangent * centerRate);
  slowed[0] = 0;
  slowed[slowed.length - 1] = 0;
  return slowed;
}

/** Prepare a shape-preserving camera curve once, then sample it during scroll. */
export function createScoreCurve(chapterCenters, values, amplitude = .65) {
  validateCurve(chapterCenters?.[0], chapterCenters, values, amplitude);
  const centers = chapterCenters.slice();
  const stops = values.slice();
  const tangents = tangentsFor(centers, stops, amplitude);
  const lastIndex = centers.length - 1;

  return readingLine => {
    if (!Number.isFinite(readingLine)) throw new TypeError('Reading line must be finite.');
    if (readingLine <= centers[0]) return { value: stops[0], velocity: 0 };
    if (readingLine >= centers[lastIndex]) return { value: stops[lastIndex], velocity: 0 };

    let index = 0;
    while (index < lastIndex - 1 && readingLine > centers[index + 1]) index += 1;
    const width = centers[index + 1] - centers[index];
    const progress = clamp((readingLine - centers[index]) / width, 0, 1);
    const squared = progress * progress;
    const cubed = squared * progress;
    const start = stops[index];
    const end = stops[index + 1];
    const startTangent = tangents[index];
    const endTangent = tangents[index + 1];
    const value = (2 * cubed - 3 * squared + 1) * start
      + (cubed - 2 * squared + progress) * width * startTangent
      + (-2 * cubed + 3 * squared) * end
      + (cubed - squared) * width * endTangent;
    const velocity = ((6 * squared - 6 * progress) * start
      + (-6 * squared + 6 * progress) * end) / width
      + (3 * squared - 4 * progress + 1) * startTangent
      + (3 * squared - 2 * progress) * endTangent;
    return {
      value: clamp(value, Math.min(start, end), Math.max(start, end)),
      velocity,
    };
  };
}

/** Sample a reversible, shape-preserving camera value and its scroll velocity. */
export function scoreValueAtReadingLine(readingLine, chapterCenters, values, amplitude = .65) {
  return createScoreCurve(chapterCenters, values, amplitude)(readingLine);
}

/** Prepare chapter progress and reuse the same curve on every scroll update. */
export function createScoreJourneyCurve(chapterCenters, amplitude = .65) {
  const centers = chapterCenters?.slice();
  const lastIndex = centers?.length - 1;
  const valueAtReadingLine = createScoreCurve(
    centers,
    centers?.map((_, index) => index),
    amplitude,
  );

  return readingLine => {
    const journey = valueAtReadingLine(readingLine);
    let index = 0;
    while (index < lastIndex - 1 && readingLine > centers[index + 1]) index += 1;
    const start = centers[index];
    const end = centers[index + 1];
    return {
      index,
      linearProgress: clamp((readingLine - start) / (end - start), 0, 1),
      progress: clamp(journey.value - index, 0, 1),
      normalizedProgress: journey.value / lastIndex,
      velocity: journey.velocity,
    };
  };
}

/** Pick a reversible, eased chapter segment from the global reading position. */
export function scoreJourneyAtReadingLine(readingLine, chapterCenters, amplitude = .65) {
  return createScoreJourneyCurve(chapterCenters, amplitude)(readingLine);
}

/** Map the global reading position to a bounded camera pose. */
export function scorePoseAtReadingLine(readingLine, chapterCenters, poseStops, amplitude = .65) {
  if (!Array.isArray(poseStops) || poseStops.length !== chapterCenters?.length
    || poseStops.some(pose => !Number.isFinite(pose) || pose < 0 || pose > 1)) {
    throw new RangeError('Camera pose stops must match the chapter centers and stay within [0,1].');
  }
  const journey = createScoreJourneyCurve(chapterCenters, amplitude)(readingLine);
  const pose = createScoreCurve(chapterCenters, poseStops, amplitude)(readingLine);
  return { ...journey, pose: pose.value, poseVelocity: pose.velocity };
}
