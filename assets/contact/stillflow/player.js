import { PausableDelay, seededRandom } from './timeline.js';

function cancellable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class StillflowPlayer {
  constructor({ frames, manifest, onChange = () => {}, onError = () => {} }) {
    if (frames.length !== 2) throw new TypeError('STILLFLOW requires two picture elements');
    this.frames = frames;
    this.manifest = manifest;
    this.onChange = onChange;
    this.onError = onError;
    this.current = frames.find(frame => frame.hasAttribute('data-sf-current')) || frames[0];
    this.next = frames.find(frame => frame !== this.current);
    this.stateId = this.current.dataset.sfState || manifest.initial;
    if (!Object.hasOwn(manifest.stills, this.stateId)) throw new TypeError('Unknown initial still');
    this.pauses = new Set();
    this.lifecycle = new AbortController();
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.decodeSamples = [];
    this.sequence = [];
    this.current.style.opacity = '1';
    this.current.style.zIndex = '1';
    this.next.style.opacity = '0';
    this.next.style.zIndex = '2';
    if (this.motion.matches) this.pauses.add('reduced-motion');
    if (document.hidden) this.pauses.add('hidden');
    document.addEventListener('visibilitychange', () => this.setPause('hidden', document.hidden), { signal: this.lifecycle.signal });
    this.motion.addEventListener('change', event => {
      if (event.matches) {
        this.stopAuto();
        this.cancelTransition();
      }
      this.setPause('reduced-motion', event.matches);
    }, { signal: this.lifecycle.signal });
  }

  get paused() { return this.pauses.size > 0; }

  snapshot() {
    const operation = this.operation;
    return {
      stateId: this.stateId,
      targetId: operation?.id || null,
      phase: this.disposed ? 'disposed' : operation?.phase || 'idle',
      paused: this.paused,
      pauseReasons: [...this.pauses],
      automatic: Boolean(this.autoController),
      error: this.error || null,
      alpha: operation?.animation ? Math.min(1, Number(operation.animation.currentTime || 0) / operation.duration) : 0,
      decodeSamples: [...this.decodeSamples],
      sequence: [...this.sequence],
    };
  }

  emit() { if (!this.disposed) this.onChange(this.snapshot()); }

  setPause(reason, value) {
    if (this.disposed) return;
    if (value) this.pauses.add(reason);
    else this.pauses.delete(reason);
    if (this.paused) {
      this.operation?.animation?.pause();
      this.waiter?.pause();
    } else {
      this.operation?.animation?.play();
      this.waiter?.resume();
    }
    this.emit();
  }

  setPaused(value) { this.setPause('manual', Boolean(value)); }

  async ready() {
    const started = performance.now();
    await cancellable(this.current.querySelector('img').decode(), this.lifecycle.signal);
    this.recordDecode(this.stateId, started);
    this.emit();
  }

  recordDecode(id, started) {
    this.decodeSamples.push({ id, milliseconds: +(performance.now() - started).toFixed(2) });
    if (this.decodeSamples.length > 12) this.decodeSamples.shift();
  }

  setSource(frame, id) {
    const still = this.manifest.stills[id];
    if (!Object.hasOwn(this.manifest.stills, id)) throw new TypeError(`Unknown still: ${id}`);
    frame.dataset.sfState = id;
    frame.querySelector('source').srcset = still.mobile;
    frame.querySelector('img').src = still.desktop;
  }

  clearFrame(frame) {
    frame.style.opacity = '0';
    frame.removeAttribute('data-sf-state');
    frame.querySelector('source').removeAttribute('srcset');
    frame.querySelector('img').removeAttribute('src');
  }

  cancelTransition() {
    const operation = this.operation;
    if (!operation) return;
    this.operation = null;
    operation.controller.abort();
    operation.animation?.cancel();
    this.clearFrame(operation.frame);
    this.emit();
  }

  async fadeTo(id, { duration = 2600, signal, onPrepared } = {}) {
    if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Invalid fade duration');
    if (this.disposed || this.operation || signal?.aborted) return false;
    if (id === this.stateId) return true;
    if (!Object.hasOwn(this.manifest.stills, id)) throw new TypeError(`Unknown still: ${id}`);
    const operation = { id, frame: this.next, phase: 'decoding', controller: new AbortController(), duration };
    this.error = null;
    const abort = () => operation.controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.operation = operation;
    this.emit();
    try {
      this.setSource(operation.frame, id);
      const image = operation.frame.querySelector('img');
      const started = performance.now();
      await cancellable(image.decode(), operation.controller.signal);
      if (this.disposed || this.operation !== operation || operation.controller.signal.aborted) return false;
      const still = this.manifest.stills[id];
      const validSize = [[still.width, still.height], [still.mobileWidth, still.mobileHeight]];
      if (!validSize.some(([width, height]) => image.naturalWidth === width && image.naturalHeight === height)) throw new Error(`Unexpected dimensions for ${id}`);
      this.recordDecode(id, started);
      const milliseconds = this.motion.matches ? 0 : duration;
      if (milliseconds > 0) {
        operation.phase = 'fading';
        operation.animation = operation.frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: milliseconds, easing: 'linear', fill: 'both' });
        if (this.paused) operation.animation.pause();
        onPrepared?.();
        this.emit();
        await cancellable(operation.animation.finished, operation.controller.signal);
      }
      if (this.disposed || this.operation !== operation || operation.controller.signal.aborted) return false;
      const previous = this.current;
      this.current = operation.frame;
      this.next = previous;
      this.current.style.opacity = '1';
      this.current.style.zIndex = '1';
      this.current.dataset.sfCurrent = '';
      this.current.dataset.sfState = id;
      this.next.removeAttribute('data-sf-current');
      this.next.style.zIndex = '2';
      this.clearFrame(this.next);
      operation.animation?.cancel();
      this.stateId = id;
      this.sequence.push(id);
      if (this.sequence.length > 20) this.sequence.shift();
      return true;
    } catch (error) {
      if (!this.disposed && this.operation === operation) {
        operation.animation?.cancel();
        this.clearFrame(operation.frame);
        if (error.name !== 'AbortError') {
          this.error = error.message;
          this.onError(error);
        }
      }
      return false;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (this.operation === operation) {
        this.operation = null;
        this.emit();
      }
    }
  }

  seek(fraction) {
    if (!this.paused || !this.operation?.animation || !Number.isFinite(fraction)) return false;
    this.operation.animation.currentTime = Math.max(0, Math.min(1, fraction)) * this.operation.duration;
    this.emit();
    return true;
  }

  async show(id) {
    this.stopAuto();
    this.cancelTransition();
    this.error = null;
    this.emit();
    return this.fadeTo(id, { duration: 0 });
  }

  stopAuto() {
    const controller = this.autoController;
    this.autoController = null;
    controller?.abort();
    if (controller) this.cancelTransition();
    this.emit();
  }

  startAuto({ seed = 42, minHold = 12000, maxHold = 24000, duration = 2600 } = {}) {
    if (this.disposed || this.motion.matches || this.autoController || this.manifest.ambient.length < 2) return false;
    if (![minHold, maxHold, duration].every(value => Number.isFinite(value) && value >= 0) || maxHold < minHold) throw new RangeError('Invalid playback timing');
    const controller = new AbortController();
    const random = seededRandom(seed);
    this.autoController = controller;
    this.setPaused(false);
    this.emit();
    this.automaticFinished = (async () => {
      try {
        while (!controller.signal.aborted) {
          const waiter = new PausableDelay(minHold + Math.floor(random() * (maxHold - minHold)), { paused: this.paused, signal: controller.signal });
          this.waiter = waiter;
          await waiter.promise;
          if (this.waiter === waiter) this.waiter = null;
          const choices = this.manifest.ambient.filter(id => id !== this.stateId);
          if (!choices.length) break;
          const id = choices[Math.floor(random() * choices.length)];
          if (!await this.fadeTo(id, { duration, signal: controller.signal })) break;
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !this.disposed) this.onError(error);
      } finally {
        if (this.autoController === controller) this.autoController = null;
        if (this.waiter?.signal === controller.signal) this.waiter = null;
        this.emit();
      }
    })();
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.stopAuto();
    this.cancelTransition();
    this.lifecycle.abort();
    this.disposed = true;
  }
}
