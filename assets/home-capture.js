import { createClock } from "./shared/clock.js";
import { createSeededRandom } from "./shared/random.js";

const enabled = new URLSearchParams(location.search).get("home-capture") === "1";
const captureParameters = new URLSearchParams(location.search);
const requestedChunks = Number(captureParameters.get("chunks"));
const chunkCount = enabled && [24, 32, 40].includes(requestedChunks) ? requestedChunks : 32;
const requestedAssemblyMode = enabled ? captureParameters.get("assembly") : null;
const assemblyMode = ["surface", "volume"].includes(requestedAssemblyMode) ? requestedAssemblyMode : null;
const requestedFocusLayer = enabled ? captureParameters.get("layer") : null;
const focusLayer = ["target", "obsidian"].includes(requestedFocusLayer) ? requestedFocusLayer : null;

function createCapture() {
  const seed = 0x484f4d45;
  const random = createSeededRandom(seed);
  const clock = createClock({ paused: true });
  let time = 0;
  let delta = 16;
  let nextTimer = 1;
  let scene;
  let systems;
  let bootstrap;
  let resolveReady;
  let disposed = false;
  const timers = new Map();
  const animations = new Map();
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const frame = document.querySelector("#scene-frame");

  function syncAnimations() {
    const current = new Set(document.getAnimations());
    for (const animation of animations.keys()) {
      if (!current.has(animation)) animations.delete(animation);
    }
    for (const animation of current) {
      if (!animations.has(animation)) animations.set(animation, clock.t * 1000);
      animation.pause();
      animation.currentTime = clock.t * 1000 - animations.get(animation);
      const timing = animation.effect?.getComputedTiming();
      if (timing && clock.t * 1000 - animations.get(animation) >= timing.endTime) {
        animation.finish();
      }
    }
  }

  function schedule(callback, delay = 0, repeat = false) {
    const id = nextTimer++;
    const interval = Math.max(repeat ? 1 : 0, Number(delay) || 0);
    timers.set(id, { callback, at: time + interval, interval, repeat });
    return id;
  }

  function runTimers(until) {
    while (true) {
      let next;
      for (const entry of timers) {
        if (entry[1].at <= until && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      const [id, timer] = next;
      time = timer.at;
      clock.seek(time / 1000);
      if (timer.repeat) timer.at += timer.interval;
      else timers.delete(id);
      timer.callback();
      syncAnimations();
    }
  }

  function setTime(seconds) {
    const target = Number(seconds) * 1000;
    if (!Number.isFinite(target) || target < time) {
      throw new RangeError("Home capture time must be finite and monotonic; reload to rewind interaction history.");
    }
    if (!scene) throw new Error("Wait for Home capture readiness before setting time.");
    while (time < target) {
      const previous = time;
      const next = Math.min(target, previous + 1000 / 60);
      runTimers(next);
      time = next;
      clock.seek(time / 1000);
      delta = next - previous;
      scene.render(clock.t * 1000);
      syncAnimations();
    }
    frame.dataset.captureTime = (time / 1000).toFixed(3);
    return snapshot();
  }

  function snapshot() {
    return {
      time: clock.t,
      seed,
      scene: { ...frame.dataset },
      systems: systems?.snapshot(),
      renderer: scene?.info(),
      pendingTimers: timers.size,
    };
  }

  const observer = new MutationObserver(() => { if (!disposed) syncAnimations(); });
  observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  syncAnimations();

  const api = {
    ready,
    setTime,
    setPointer(x, y) {
      if (x == null && y == null) {
        document.querySelector(".hero-screen").dispatchEvent(new PointerEvent("pointerleave"));
      } else {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("Home capture pointer must be finite or null.");
        document.querySelector(".hero-screen").dispatchEvent(new PointerEvent("pointermove", {
          clientX: x, clientY: y, pointerType: "mouse", bubbles: true,
        }));
      }
    },
    setScroll(pixels) {
      if (!Number.isFinite(pixels) || pixels < 0) throw new TypeError("Home capture scroll must be finite and nonnegative.");
      window.scrollTo({ top: pixels, behavior: "instant" });
      scene?.updateProgress();
      syncAnimations();
    },
    trigger(name) {
      systems?.trigger(name);
      syncAnimations();
      return snapshot();
    },
    snapshot,
    dispose() {
      bootstrap?.dispose?.();
      scene?.dispose?.();
      disposed = true;
      observer.disconnect();
      timers.clear();
      for (const animation of animations.keys()) animation.cancel();
      animations.clear();
      delete window.__homeCapture;
    },
  };
  window.__homeCapture = Object.freeze(api);
  frame.dataset.captureSeed = `0x${seed.toString(16)}`;
  frame.dataset.captureChunks = String(chunkCount);

  return {
    chunkCount,
    assemblyMode,
    focusLayer,
    random,
    get delta() { return delta; },
    setTimeout: (callback, delay) => schedule(callback, delay),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    clearTimer: (id) => timers.delete(id),
    bindSystems(value) { systems = value; },
    bindBootstrap(value) { bootstrap = value; },
    bindScene(value) {
      scene = value;
      scene.render(clock.t * 1000);
      syncAnimations();
      frame.dataset.captureReady = "true";
      resolveReady(true);
    },
    fallback() {
      frame.dataset.captureReady = "true";
      resolveReady(false);
    },
  };
}

export const homeCapture = enabled ? createCapture() : null;
