const FRAME_WINDOW = 60;
const MAX_CONTINUOUS_GAP_MS = 100;
const FRAME_BUDGET_MS = 20;

export function initialGpuPixelRatio(devicePixelRatio = globalThis.devicePixelRatio || 1) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, 1.5);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function nextLowerRatio(ratio) {
  if (ratio > 1.25) return 1.25;
  if (ratio > 1) return 1;
  return ratio;
}

/**
 * Observe consecutive rendered-pose RAFs. Long idle gaps start a new window so
 * an intentional pause between scroll gestures cannot lower the device DPR.
 * The first decision uses 59 intervals from 60 pose timestamps.
 */
export function createAdaptiveDpr(initialRatio) {
  if (!Number.isFinite(initialRatio) || initialRatio <= 0) {
    throw new RangeError('Initial pixel ratio must be positive.');
  }
  let ratio = Math.min(initialRatio, 1.5);
  let previousTime = null;
  let intervals = [];

  return {
    get pixelRatio() { return ratio; },
    reset() { previousTime = null; intervals = []; },
    observe(timestamp) {
      if (!Number.isFinite(timestamp)) return null;
      if (previousTime !== null) {
        const interval = timestamp - previousTime;
        if (interval <= 0 || interval > MAX_CONTINUOUS_GAP_MS) intervals = [];
        else intervals.push(interval);
      }
      previousTime = timestamp;
      if (intervals.length < FRAME_WINDOW - 1) return null;

      const p95 = percentile(intervals, 0.95);
      const previousRatio = ratio;
      if (p95 > FRAME_BUDGET_MS) ratio = nextLowerRatio(ratio);
      const result = { frames: FRAME_WINDOW, intervals: intervals.length, p95, previousRatio, pixelRatio: ratio, lowered: ratio < previousRatio };
      intervals = [];
      return result;
    },
  };
}
