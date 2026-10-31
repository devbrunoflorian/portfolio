import { clamp, smoothstep } from "./context.js";

const KNIGHT_START = 1.35;
const OBSIDIAN_START = 1.0;
const FLOOR_START = 2.1;
const KNIGHT_HANDOFF = 1.85;
const FINAL_TIME = 6.75;
const SESSION_KEY = "home-entrance-00-played";

function easeInOutQuad(value) {
  return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
}

function easeInQuad(value) {
  return value * value;
}

function getAssemblyProgress(time) {
  const elapsed = clamp((time - 1.1) / 0.6);
  if (elapsed <= 0) return 0;
  if (elapsed < 0.18) return 0.28 * easeInOutQuad(elapsed / 0.18);
  if (elapsed < 0.7) return 0.28 + 0.37 * easeInOutQuad((elapsed - 0.18) / 0.52);
  return 0.65 + 0.35 * easeInQuad((elapsed - 0.7) / 0.3);
}

function getAssemblyRim(time) {
  if (time < 0.55) return 0;
  if (time < 0.85) return smoothstep(0.55, 0.85, time);
  if (time < 1.7) return 1;
  if (time <= 2.0) {
    const pulse = smoothstep(1.72, 1.86, time);
    const settle = smoothstep(1.86, 2.0, time);
    return 1 - 0.28 * pulse + 0.22 * settle;
  }
  if (time < 2.25) {
    const elapsed = time - 1.7;
    const pulse = 0.8 + 0.22 * Math.sin(elapsed * Math.PI * 2 * 0.3);
    const lockIn = smoothstep(1.7, 1.78, time);
    return 1 + (pulse - 1) * lockIn;
  }
  return (0.8 + 0.22 * Math.sin(0.55 * Math.PI * 2 * 0.3)) * (1 - smoothstep(2.25, 2.75, time));
}

function chooseOpeningMode(ctx) {
  if (ctx.homeCapture?.openingSequence && !ctx.mobileViewport.matches) return "capture";
  if (ctx.homeCapture || ctx.debugMode || ctx.mobileViewport.matches || ctx.reducedMotion.matches) return "none";
  if (new URLSearchParams(location.search).get("home-opening") === "1") return "forced";
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return "none";
    sessionStorage.setItem("home-opening-storage-check", "1");
    sessionStorage.removeItem("home-opening-storage-check");
    return "first-visit";
  } catch {
    return "microintro";
  }
}

export function createOpeningController({ frame, heroScreen, revealCopy, ctx }) {
  let disposed = false;
  let finalCaptureState = false;
  let sequenceMode = chooseOpeningMode(ctx);
  let sequenceStarted = false;
  let sequenceFinished = false;
  let visibleElapsed = 0;
  let lastVisibleTimestamp = null;
  let waitVisibleMs = 0;
  let lastWaitTimestamp = performance.now();
  let waitTimer = 0;
  let microintroTimer = 0;
  let skipButton = null;
  let entryAnimations = [];
  let savedOverflow = "";
  let savedInert = [];
  let pageLocked = false;
  let degraded = false;
  let degradedAt = 0;
  let degradedTimeline = 0;
  let performanceStart = null;
  let performanceLastFrame = null;
  let performanceDiscarded = 0;
  const performanceSamples = [];
  const focusLayerCapture = ["target", "obsidian", "floor"].includes(ctx.homeCapture?.focusLayer)
    && !ctx.mobileViewport.matches;
  const targetFocusCapture = focusLayerCapture && ctx.homeCapture.focusLayer === "target";
  const obsidianFocusCapture = focusLayerCapture && ctx.homeCapture.focusLayer === "obsidian";
  const floorFocusCapture = focusLayerCapture && ctx.homeCapture.focusLayer === "floor";
  const previousFocusLayer = document.documentElement.dataset.homeFocusLayer;
  if (focusLayerCapture) document.documentElement.dataset.homeFocusLayer = ctx.homeCapture.focusLayer;
  ctx.openingMode = sequenceMode === "capture" || sequenceMode === "forced" || sequenceMode === "first-visit";

  const interactiveRegions = [
    document.querySelector(".skip-link"),
    document.querySelector(".site-header"),
    document.querySelector("main"),
    document.querySelector(".site-footer"),
  ].filter(Boolean);

  function setInert(active) {
    if (active) {
      if (pageLocked) return;
      savedInert = interactiveRegions.map((element) => [element, element.inert]);
      interactiveRegions.forEach((element) => { element.inert = true; });
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      pageLocked = true;
      return;
    }
    if (!pageLocked) return;
    for (const [element, wasInert] of savedInert) element.inert = wasInert;
    savedInert = [];
    document.body.style.overflow = savedOverflow;
    pageLocked = false;
  }

  function restoreFocusLayerCapture() {
    if (!focusLayerCapture) return;
    if (previousFocusLayer === undefined) delete document.documentElement.dataset.homeFocusLayer;
    else document.documentElement.dataset.homeFocusLayer = previousFocusLayer;
  }

  function setIntactKnight() {
    ctx.assemblyTimeUniform.value = 2.35;
    ctx.assemblyUniform.value = 1;
    ctx.rimAssemblyUniform.value = 0;
    ctx.facetRevealUniform.value = 1;
    ctx.reflectorReflectionUniform.value = 1;
    ctx.reflectorFloorUniform.value = 1;
    if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
    ctx.volumetricBaseMeshes?.forEach((mesh) => { mesh.visible = true; });
    ctx.volumetricBaseLines?.forEach((line) => { line.visible = true; });
    if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = true;
    if (ctx.whiteRevealLight) ctx.whiteRevealLight.intensity = ctx.whiteRevealIntensity;
    ctx.assemblyLights.forEach(({ light, intensity }) => { light.intensity = intensity; });
  }

  function removeSkipButton() {
    skipButton?.remove();
    skipButton = null;
  }

  function releasePage({ complete = false, focus = false } = {}) {
    document.body.removeAttribute("data-home-opening-active");
    if (complete) document.body.dataset.homeOpeningComplete = "true";
    setInert(false);
    removeSkipButton();
    ctx.homeEnvironment?.setActive(true);
    if (focus) document.querySelector(".skip-link")?.focus({ preventScroll: true });
  }

  function createSkipButton() {
    if (ctx.homeCapture || skipButton) return;
    skipButton = document.createElement("button");
    skipButton.type = "button";
    skipButton.className = "home-opening-skip";
    skipButton.hidden = true;
    skipButton.textContent = document.documentElement.lang.startsWith("pt") ? "Pular abertura" : "Skip intro";
    skipButton.addEventListener("click", () => {
      if (!sequenceStarted) disableSequence("skip-before-ready");
      else completeSequence(true);
    });
    document.body.append(skipButton);
  }

  function markSessionConsumed() {
    if (sequenceMode === "first-visit") {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* Current tab still consumes this run. */ }
    }
  }

  function updateWaitTimer() {
    if (disposed || sequenceMode === "none" || sequenceMode === "capture" || sequenceStarted || sequenceFinished) return;
    const now = performance.now();
    if (document.visibilityState === "visible") waitVisibleMs += Math.max(0, now - lastWaitTimestamp);
    lastWaitTimestamp = now;
    if (waitVisibleMs >= 4000 && skipButton) {
      skipButton.hidden = false;
      skipButton.textContent = document.documentElement.lang.startsWith("pt")
        ? "Ver sem abertura"
        : "View without intro";
    }
    if (waitVisibleMs >= 5000 && frame.dataset.openingBootstrapStarted !== "true") {
      disableSequence("bootstrap-timeout");
      return;
    }
    if (waitVisibleMs >= 12000) disableSequence("essential-timeout");
  }

  function addEntryAnimation(element, start, duration = 360) {
    if (!element) return;
    const animation = element.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "both" },
    );
    animation.pause();
    ctx.homeCapture?.registerAnimation(animation, start * 1000);
    entryAnimations.push({ animation, start });
  }

  function createEntryAnimations() {
    entryAnimations = [];
    addEntryAnimation(document.querySelector(".site-header"), 4.05, 500);
    addEntryAnimation(document.querySelector(".hero-copy .eyebrow"), 4.7, 400);
    addEntryAnimation(document.querySelector("#hero-title"), 4.7, 520);
    addEntryAnimation(document.querySelector(".hero-copy .intro"), 5.4, 420);
    addEntryAnimation(document.querySelector(".hero-actions"), 5.98, 420);
    addEntryAnimation(document.querySelector(".hero-side-note"), 6.22, 400);
    addEntryAnimation(document.querySelector(".environment-labels"), 6.22, 420);
    addEntryAnimation(document.querySelector(".temporary-note"), 6.35, 320);
    addEntryAnimation(document.querySelector(".scroll-cue"), 6.35, 360);
  }

  function setEntryAnimations(time) {
    for (const { animation, start } of entryAnimations) {
      animation.pause();
      animation.currentTime = (time - start) * 1000;
    }
  }

  function startSequence(timestamp) {
    if (sequenceStarted || sequenceMode === "none" || disposed) return;
    sequenceStarted = true;
    waitTimer && clearInterval(waitTimer);
    waitTimer = 0;
    markSessionConsumed();
    document.body.dataset.homeOpeningActive = "true";
    setInert(true);
    createEntryAnimations();
    visibleElapsed = 0;
    lastVisibleTimestamp = document.visibilityState === "visible" ? timestamp : null;
    performanceStart = 0;
    performanceLastFrame = null;
    performanceDiscarded = 0;
    performanceSamples.length = 0;
    if (skipButton) {
      skipButton.hidden = false;
      skipButton.textContent = document.documentElement.lang.startsWith("pt") ? "Pular abertura" : "Skip intro";
    }
    frame.dataset.openingState = "playing";
    applyOpeningSequence(0);
  }

  function readLiveElapsed(timestamp) {
    if (ctx.homeCapture) return Math.max(0, timestamp / 1000);
    if (document.visibilityState !== "visible") {
      lastVisibleTimestamp = null;
      performanceLastFrame = null;
      return visibleElapsed;
    }
    if (lastVisibleTimestamp === null) lastVisibleTimestamp = timestamp;
    else {
      visibleElapsed += Math.max(0, timestamp - lastVisibleTimestamp) / 1000;
      lastVisibleTimestamp = timestamp;
    }
    return visibleElapsed;
  }

  function collectPerformance(timestamp, elapsed) {
    if (ctx.homeCapture || degraded) return;
    if (performanceStart === null) performanceStart = elapsed;
    if (performanceLastFrame === null) {
      performanceLastFrame = timestamp;
      return;
    }
    const frameTime = Math.max(0, timestamp - performanceLastFrame);
    performanceLastFrame = timestamp;
    if (performanceDiscarded < 3) {
      performanceDiscarded++;
      return;
    }
    performanceSamples.push(frameTime);
    const closed = performanceSamples.length >= 8 || elapsed - performanceStart >= 1;
    if (!closed) return;
    const sorted = performanceSamples.slice().sort((a, b) => a - b);
    const median = sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : Infinity;
    if (sorted.length < 4 || median > 33) {
      degraded = true;
      degradedAt = elapsed;
      degradedTimeline = elapsed;
      frame.dataset.openingDegraded = "true";
    }
  }

  function applyOpeningSequence(time) {
    const t = clamp(time, 0, FINAL_TIME);
    const knightTime = Math.max(0, t - KNIGHT_START);
    const boundedKnightTime = Math.min(2.35, knightTime);
    const assemblyOnlyLighting = smoothstep(0, 1, getAssemblyProgress(knightTime));
    const facetReveal = smoothstep(2.0, 2.25, knightTime);
    const reflectionAmount = smoothstep(2.1, 2.55, t);
    const floorAmount = smoothstep(2.1, 2.4, t);
    const volumetricHandoff = knightTime >= KNIGHT_HANDOFF;

    ctx.assemblyTimeUniform.value = boundedKnightTime;
    ctx.assemblyUniform.value = getAssemblyProgress(knightTime);
    ctx.rimAssemblyUniform.value = getAssemblyRim(knightTime);
    ctx.facetRevealUniform.value = facetReveal;
    ctx.reflectorReflectionUniform.value = reflectionAmount;
    ctx.reflectorFloorUniform.value = floorAmount;
    ctx.assemblyLights.forEach(({ light, intensity }) => {
      const volumeGain = light.name === "fixed-red-right-light" ? 0.12 : 0.38;
      light.intensity = intensity * assemblyOnlyLighting * volumeGain;
    });
    if (ctx.whiteRevealLight) {
      ctx.whiteRevealLight.intensity = ctx.whiteRevealIntensity
        * smoothstep(2.25, 2.75, knightTime)
        * smoothstep(0, 1, ctx.assemblyUniform.value);
    }
    if (ctx.reflectiveFloor) {
      ctx.reflectiveFloor.visible = t >= FLOOR_START;
      ctx.reflectiveFloor.material.transparent = t < FINAL_TIME;
      ctx.reflectiveFloor.material.depthWrite = t >= FINAL_TIME;
    }
    if (ctx.volumetricMesh) ctx.volumetricMesh.visible = knightTime >= 0.55 && !volumetricHandoff;
    ctx.volumetricBaseMeshes?.forEach((mesh) => { mesh.visible = volumetricHandoff; });
    ctx.volumetricBaseLines?.forEach((line) => { line.visible = !volumetricHandoff; });
    ctx.spatialEnvironment?.setTargetVisible(true);
    ctx.spatialEnvironment?.setTargetTime(t);
    ctx.spatialEnvironment?.setObsidianTime(Math.max(0, t - OBSIDIAN_START));
    ctx.spatialEnvironment?.setFloorTime(Math.max(0, t - FLOOR_START));
    ctx.spatialEnvironment?.setWorldVisible(t >= OBSIDIAN_START);
    ctx.spatialEnvironment?.setFloorVisible(t >= FLOOR_START);
    ctx.spatialEnvironment?.setReflectionVisible(false);
    frame.dataset.assemblyProgress = ctx.assemblyUniform.value.toFixed(4);
    frame.dataset.assemblyRim = ctx.rimAssemblyUniform.value.toFixed(4);
    frame.dataset.facetReveal = facetReveal.toFixed(4);
    frame.dataset.reflectorOpacity = floorAmount.toFixed(4);
    frame.dataset.reflectionOpacity = reflectionAmount.toFixed(4);
    frame.dataset.worldVisible = String(t >= OBSIDIAN_START);
    frame.dataset.volumetricHandoff = String(volumetricHandoff);
    frame.dataset.openingTime = t.toFixed(3);
    setEntryAnimations(t);
    if (t >= FINAL_TIME) completeSequence(false);
  }

  function completeSequence(focus) {
    if (!sequenceStarted || sequenceFinished || disposed) return;
    sequenceFinished = true;
    applyOpeningSequence(FINAL_TIME - 0.001);
    sequenceFinished = true;
    setIntactKnight();
    ctx.spatialEnvironment?.setTargetVisible(true);
    ctx.spatialEnvironment?.setTargetTime(FINAL_TIME);
    ctx.spatialEnvironment?.setObsidianTime(FINAL_TIME - OBSIDIAN_START);
    ctx.spatialEnvironment?.setFloorTime(FINAL_TIME - FLOOR_START);
    ctx.spatialEnvironment?.setWorldVisible(true);
    ctx.spatialEnvironment?.setFloorVisible(true);
    frame.dataset.openingState = "complete";
    frame.dataset.openingTime = FINAL_TIME.toFixed(3);
    setEntryAnimations(FINAL_TIME);
    sequenceMode = "none";
    releasePage({ complete: true, focus });
    revealCopy();
  }

  function setIntactFallback() {
    setIntactKnight();
    ctx.spatialEnvironment?.disableOpeningLayers();
    ctx.spatialEnvironment?.setWorldVisible(true);
    ctx.spatialEnvironment?.setFloorVisible(true);
  }

  function disableSequence(reason = "cancelled") {
    if (sequenceMode === "none") return;
    markSessionConsumed();
    sequenceMode = "none";
    sequenceFinished = true;
    if (waitTimer) clearInterval(waitTimer);
    waitTimer = 0;
    setIntactFallback();
    frame.dataset.openingState = reason;
    entryAnimations.forEach(({ animation }) => animation.cancel());
    entryAnimations = [];
    releasePage({ focus: pageLocked });
    if (sequenceStarted) revealCopy();
  }

  function onVisibilityChange() {
    lastWaitTimestamp = performance.now();
    if (document.visibilityState !== "visible") {
      lastVisibleTimestamp = null;
      performanceLastFrame = null;
    } else if (sequenceStarted) {
      lastVisibleTimestamp = performance.now();
    }
  }

  function onKeyDown(event) {
    if (sequenceStarted && !sequenceFinished && event.key === "Escape") {
      event.preventDefault();
      completeSequence(true);
    }
  }

  function onMobileChange() {
    if (sequenceMode !== "none" && ctx.mobileViewport.matches) disableSequence("mobile-change");
  }

  if (["first-visit", "forced"].includes(sequenceMode)) {
    document.body.dataset.homeOpeningActive = "true";
    setInert(true);
  }
  if (sequenceMode !== "none" && sequenceMode !== "capture" && sequenceMode !== "microintro") {
    createSkipButton();
    waitTimer = window.setInterval(updateWaitTimer, 100);
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("keydown", onKeyDown);
  ctx.mobileViewport.addEventListener("change", onMobileChange);

  function update(timeMilliseconds) {
    if (disposed) return;
    if (sequenceStarted && !sequenceFinished) {
      const elapsed = readLiveElapsed(timeMilliseconds);
      collectPerformance(timeMilliseconds, elapsed);
      let sequenceTime = elapsed;
      if (degraded) {
        sequenceTime = degradedTimeline
          + (FINAL_TIME - degradedTimeline) * smoothstep(degradedAt, degradedAt + 0.25, elapsed);
      }
      applyOpeningSequence(sequenceTime);
      return;
    }
    if (sequenceStarted && sequenceFinished) return;
    if (!ctx.homeCapture) return;
    const time = Math.max(0, timeMilliseconds / 1000);
    const assemblyOnly = ctx.homeCapture.assemblyMode === "volume";
    const timelineTime = assemblyOnly ? Math.min(2.35, time) : time;

    ctx.assemblyTimeUniform.value = assemblyOnly ? timelineTime : 0;
    ctx.assemblyUniform.value = getAssemblyProgress(timelineTime);
    ctx.rimAssemblyUniform.value = getAssemblyRim(timelineTime);
    const facetReveal = assemblyOnly ? 0 : smoothstep(2.0, 2.25, time);
    const assemblyLighting = obsidianFocusCapture ? 1 : smoothstep(0, 1, ctx.assemblyUniform.value);
    ctx.facetRevealUniform.value = facetReveal;
    ctx.assemblyLights.forEach(({ light, intensity }) => {
      const volumeGain = assemblyOnly
        ? (light.name === "fixed-red-right-light" ? 0.12 : 0.38)
        : 1;
      light.intensity = intensity * assemblyLighting * volumeGain;
    });

    const reflectionAmount = assemblyOnly ? 0 : smoothstep(1.1, 1.5, time);
    const floorAmount = assemblyOnly ? 0 : smoothstep(2.0, 2.25, time);
    const volumetricHandoff = assemblyOnly && timelineTime >= 1.85;
    ctx.reflectorReflectionUniform.value = reflectionAmount;
    ctx.reflectorFloorUniform.value = floorAmount;
    if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = !assemblyOnly;
    const normalExperience = !assemblyOnly && time >= 3.9;
    frame.dataset.assemblyProgress = ctx.assemblyUniform.value.toFixed(4);
    frame.dataset.assemblyRim = ctx.rimAssemblyUniform.value.toFixed(4);
    frame.dataset.facetReveal = facetReveal.toFixed(4);
    frame.dataset.reflectorOpacity = floorAmount.toFixed(4);
    frame.dataset.reflectionOpacity = reflectionAmount.toFixed(4);
    frame.dataset.worldVisible = String(!assemblyOnly && time >= 2.0);
    frame.dataset.volumetricHandoff = String(volumetricHandoff);
    if (ctx.volumetricMesh) ctx.volumetricMesh.visible = !assemblyOnly || (timelineTime >= 0.55 && !volumetricHandoff);
    ctx.volumetricBaseMeshes?.forEach((mesh) => { mesh.visible = volumetricHandoff; });
    ctx.volumetricBaseLines?.forEach((line) => { line.visible = !volumetricHandoff; });
    if (ctx.whiteRevealLight) {
      const whiteReveal = assemblyOnly || obsidianFocusCapture || floorFocusCapture ? 0 : smoothstep(2.25, 2.75, time);
      ctx.whiteRevealLight.intensity = ctx.whiteRevealIntensity * whiteReveal * smoothstep(0, 1, ctx.assemblyUniform.value);
    }
    if (normalExperience !== finalCaptureState && ctx.reflectiveFloor) {
      ctx.reflectiveFloor.material.transparent = !normalExperience;
      ctx.reflectiveFloor.material.depthWrite = normalExperience;
      finalCaptureState = normalExperience;
    }
    ctx.spatialEnvironment?.setWorldVisible(!assemblyOnly && time >= 2.0);
    if (assemblyOnly) ctx.spatialEnvironment?.setReflectionVisible(false);

    if (targetFocusCapture) {
      if (ctx.scene.background?.isColor) ctx.scene.background.set(0x000000);
      ctx.modelPivot.visible = false;
      if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
      if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = false;
      ctx.spatialEnvironment?.setWorldVisible(false);
      ctx.spatialEnvironment?.setTargetVisible(true);
      ctx.spatialEnvironment?.setTargetTime(time);
      frame.dataset.worldVisible = "false";
    }
    if (obsidianFocusCapture) {
      if (ctx.scene.background?.isColor) ctx.scene.background.set(0x000000);
      ctx.modelPivot.visible = false;
      if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
      if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = false;
      ctx.spatialEnvironment?.setReflectionVisible(false);
      ctx.spatialEnvironment?.setWorldVisible(true);
      ctx.spatialEnvironment?.setFloorVisible(false);
      ctx.spatialEnvironment?.setObsidianTime(time);
      frame.dataset.worldVisible = "true";
    }
    if (floorFocusCapture) {
      if (ctx.scene.background?.isColor) ctx.scene.background.set(0x000000);
      ctx.modelPivot.visible = false;
      if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
      if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = false;
      ctx.spatialEnvironment?.setReflectionVisible(false);
      ctx.spatialEnvironment?.setWorldVisible(false);
      ctx.spatialEnvironment?.setFloorVisible(true);
      ctx.spatialEnvironment?.setFloorTime(time);
      frame.dataset.worldVisible = "false";
    }
  }

  return {
    update,
    get usesVolumetricAssembly() { return ["capture", "forced", "first-visit"].includes(sequenceMode); },
    disableSequence,
    presentFirstInteractiveFrame(timestamp = performance.now()) {
      if (disposed || frame.dataset.sceneState !== "loading") return;
      if (!ctx.homeCapture && sequenceMode !== "none" && document.visibilityState !== "visible") return;
      frame.dataset.sceneState = "live";
      heroScreen.classList.add("scene-live");
      if (sequenceMode === "microintro") {
        sequenceMode = "none";
        frame.dataset.openingState = "microintro";
        microintroTimer = window.setTimeout(() => {
          microintroTimer = 0;
          if (!disposed) revealCopy();
        }, 550);
      } else if (sequenceMode !== "none") {
        startSequence(timestamp);
      } else {
        if (ctx.volumetricMesh) setIntactFallback();
        revealCopy();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (waitTimer) clearInterval(waitTimer);
      if (microintroTimer) clearTimeout(microintroTimer);
      removeSkipButton();
      entryAnimations.forEach(({ animation }) => animation.cancel());
      entryAnimations = [];
      if (sequenceStarted && !sequenceFinished) releasePage();
      else {
        document.body.removeAttribute("data-home-opening-active");
        setInert(false);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("keydown", onKeyDown);
      ctx.mobileViewport.removeEventListener("change", onMobileChange);
      restoreFocusLayerCapture();
    },
  };
}
