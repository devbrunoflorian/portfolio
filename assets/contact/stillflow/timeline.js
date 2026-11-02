// A single timeout whose remaining hold survives pause/resume.
export class PausableDelay {
  constructor(duration, { paused = false, signal } = {}) {
    this.remaining = duration;
    this.signal = signal;
    this.done = false;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.abort = () => this.finish(new DOMException('Cancelled', 'AbortError'));
    signal?.addEventListener('abort', this.abort, { once: true });
    if (signal?.aborted) this.abort();
    else if (!paused) this.resume();
  }
  pause() {
    if (this.timer === undefined || this.done) return;
    clearTimeout(this.timer);
    this.remaining = Math.max(0, this.remaining - (performance.now() - this.started));
    this.timer = undefined;
  }
  resume() {
    if (this.timer !== undefined || this.done) return;
    this.started = performance.now();
    this.timer = setTimeout(() => this.finish(), this.remaining);
  }
  finish(error) {
    if (this.done) return;
    this.done = true;
    clearTimeout(this.timer);
    this.signal?.removeEventListener('abort', this.abort);
    if (error) this.reject(error);
    else this.resolve();
  }
}

export function seededRandom(seed) {
  let state = Number(seed) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
