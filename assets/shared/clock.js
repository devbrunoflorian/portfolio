export function createClock({ visible = true, paused = false, maxDelta = 0.05 } = {}) {
  if (!Number.isFinite(maxDelta) || maxDelta <= 0) {
    throw new TypeError('Clock delta limit must be finite and positive.');
  }
  let time = 0;
  let visibleTime = 0;
  let previous = null;
  let timestamp = 0;
  let dt = 0;
  let rawDelta = 0;
  let crossedVisibility = true;
  let frameValid = false;

  function sample(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0 || (previous !== null && milliseconds < previous)) {
      throw new RangeError('Clock timestamps must be finite, nonnegative and monotonic.');
    }
    const elapsed = previous === null ? 0 : (milliseconds - previous) * 0.001;
    frameValid = previous !== null && visible && !crossedVisibility;
    timestamp = milliseconds * 0.001;
    rawDelta = visible ? elapsed : 0;
    dt = visible && !paused ? Math.min(elapsed, maxDelta) : 0;
    visibleTime += rawDelta;
    time += dt;
    previous = milliseconds;
    crossedVisibility = false;
    return { t: time, visibleTime, timestamp, dt, rawDelta, frameValid };
  }

  return {
    get t() { return time; },
    get visibleTime() { return visibleTime; },
    get paused() { return paused; },
    get visible() { return visible; },
    sample,
    seek(seconds) {
      if (!Number.isFinite(seconds)) throw new RangeError('Clock seek time must be finite.');
      time = seconds;
      dt = 0;
    },
    pause(value = true) {
      paused = Boolean(value);
    },
    setVisible(value, milliseconds) {
      sample(milliseconds);
      if (visible !== Boolean(value)) {
        visible = Boolean(value);
        crossedVisibility = true;
        frameValid = false;
      }
    },
    resetFrame() {
      previous = null;
      dt = rawDelta = 0;
      frameValid = false;
      crossedVisibility = true;
    },
  };
}
