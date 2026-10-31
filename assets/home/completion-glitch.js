import * as THREE from "three";

const CASCADE = Object.freeze([
  { stage: "obsidian", start: 0, end: 390 },
  { stage: "target", start: 390, end: 650 },
  { stage: "floor", start: 650, end: 900 },
  { stage: "knight", start: 900, end: 1220 },
  { stage: "text", start: 1220, end: 1540 },
]);

const TEXT_GLITCH_PROPERTIES = [
  "--home-glitch-x", "--home-glitch-y", "--home-glitch-skew", "--home-glitch-cut-top", "--home-glitch-cut-bottom",
  "--home-glitch-red-x", "--home-glitch-red-y", "--home-glitch-white-x", "--home-glitch-white-y",
];
const STRUCTURE_GLITCH_PROPERTIES = [
  "--home-structure-x", "--home-structure-y", "--home-structure-rotate", "--home-structure-cut-top", "--home-structure-cut-bottom",
];

function pulseWindow(phase, start, peak, end) {
  if (phase <= start || phase >= end) return 0;
  if (phase < peak) return (phase - start) / (peak - start);
  return (end - phase) / (end - peak);
}

export function createCompletionGlitch({ ctx, homeEnvironment }) {
  const isPortuguese = document.documentElement.lang.toLowerCase().startsWith("pt");
  const reducedMotion = ctx.reducedMotion;
  const dialog = document.createElement("dialog");
  dialog.className = "home-glitch-dialog";
  dialog.tabIndex = -1;
  dialog.setAttribute("aria-labelledby", "home-glitch-title");
  dialog.innerHTML = `
    <div class="home-glitch-terminal" hidden>
      <p class="home-glitch-kicker">${isPortuguese ? "HOME // RECUPERAÇÃO" : "HOME // RECOVERY"}<span data-glitch-code="0"></span></p>
      <h2 id="home-glitch-title" class="home-glitch-copy">${isPortuguese ? "RECUPERAR SINAL" : "RESTORE SIGNAL"}</h2>
      <p class="home-glitch-error">${isPortuguese ? "FLUXO INTERROMPIDO" : "FLOW INTERRUPTED"}</p>
      <p class="home-glitch-copy">${isPortuguese ? "Digite qualquer senha para reconstruir a apresentação." : "Enter any password to rebuild the presentation."}</p>
      <p class="home-glitch-code-line" aria-hidden="true"><span data-glitch-code="1"></span><span data-glitch-code="2"></span><span data-glitch-code="3"></span></p>
      <form class="home-glitch-form">
        <label for="home-glitch-password">${isPortuguese ? "PASSWORD" : "PASSWORD"}</label>
        <div class="home-glitch-input-row">
          <input id="home-glitch-password" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button class="home-glitch-submit" type="submit"><span>${isPortuguese ? "REINICIAR" : "REBOOT"}</span></button>
        </div>
      </form>
      <p class="home-glitch-status" role="status" aria-live="polite"></p>
    </div>
    <span class="home-glitch-scanline" aria-hidden="true"></span>
  `;
  document.body.append(dialog);

  const terminal = dialog.querySelector(".home-glitch-terminal");
  const form = dialog.querySelector(".home-glitch-form");
  const input = dialog.querySelector("#home-glitch-password");
  const submit = dialog.querySelector(".home-glitch-submit");
  const status = dialog.querySelector(".home-glitch-status");
  const codeFields = Array.from(dialog.querySelectorAll("[data-glitch-code]"));
  const textTargets = Array.from(document.querySelectorAll([
    ".site-header .brand",
    ".site-header .desktop-nav a",
    ".site-header .locale-nav a",
    ".site-header .menu-toggle",
    ".site-header .mobile-nav a",
    ".site-header .mobile-github",
    ".hero-actions button",
    ".hero-copy > .eyebrow",
    ".hero-copy h1 .hero-word",
    ".hero-copy > .intro",
    ".hero-actions a",
    ".hero-side-note [data-scene-state]",
    "#scene-stage",
    ".scene-caption > span:last-child",
    ".temporary-note a",
    ".scroll-cue",
    ".home-opening-skip",
    ".environment-labels .system-node",
    ".environment-labels .chain-word",
    ".home-glitch-terminal .home-glitch-kicker",
    ".home-glitch-terminal h2",
    ".home-glitch-terminal .home-glitch-error",
    ".home-glitch-terminal .home-glitch-copy",
    ".home-glitch-terminal .home-glitch-code-line [data-glitch-code]",
    ".home-glitch-terminal .home-glitch-form label",
    ".home-glitch-submit",
  ]));
  const structureTargets = [
    [".site-header", 1220], [".hero-copy", 1220], [".hero-actions", 1220], [".hero-art", 0], [".hero-side-note", 1220],
    [".scene-caption", 1220], [".temporary-note", 1220], [".scroll-cue", 1220], [".environment-labels", 1220], [".site-footer", 1220],
    [".home-glitch-terminal", 1540], [".home-glitch-form", 1540],
  ].flatMap(([selector, start]) => Array.from(document.querySelectorAll(selector), (element) => ({ element, start })));

  let active = false;
  let disposed = false;
  let submitting = false;
  let startedAt = 0;
  let currentStage = null;
  let savedOverflow = null;
  let pausedNeonAnimations = [];
  let textAttributes = [];
  let structureAttributes = [];
  let runSeed = 0;
  let textFrame = -1;
  let knightBaseRotation = null;
  let knightBasePositionXZ = null;
  const knightOverlay = document.createElement("div");
  knightOverlay.className = "home-glitch-knight-overlay";
  knightOverlay.setAttribute("aria-hidden", "true");
  const knightSlices = Array.from({ length: 5 }, () => {
    const slice = document.createElement("span");
    knightOverlay.append(slice);
    return slice;
  });
  ctx.frame.append(knightOverlay);

  const hash = (value) => {
    let result = Math.imul((value ^ runSeed) >>> 0, 0x45d9f3b);
    result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
    return ((result ^ (result >>> 16)) >>> 0) / 0x100000000;
  };

  function makeCode(salt, frame = 0) {
    const value = Math.floor(hash(salt * 4099 + frame) * 0x1000000);
    return value.toString(16).padStart(6, "0").toUpperCase();
  }

  function prepareCorruptText(frame, elapsed) {
    if (!textAttributes.length) {
      textAttributes = textTargets.map((element) => ({
        element,
        hadClass: element.classList.contains("home-glitch-copy"),
        hadValue: element.hasAttribute("data-home-glitch-copy"),
        value: element.getAttribute("data-home-glitch-copy"),
        styles: [...TEXT_GLITCH_PROPERTIES, "--home-glitch-opacity"].map((property) => [property, element.style.getPropertyValue(property)]),
      }));
    }
    textTargets.forEach((element, index) => {
      element.classList.add("home-glitch-copy");
      element.setAttribute("data-home-glitch-copy", (element.innerText || element.textContent || "").trim());
      const seed = frame * 97 + index * 211;
      const strength = 0.45 + hash(seed + 7) * 0.55;
      const cycle = 380 + hash(index * 619 + runSeed) * 300;
      const phase = ((elapsed + hash(index * 313 + runSeed) * cycle) % cycle) / cycle;
      const pulse = currentStage === "terminal"
        ? 0.32 + 0.68 * Math.max(pulseWindow(phase, 0.04, 0.11, 0.22), pulseWindow(phase, 0.55, 0.62, 0.73))
        : 1;
      const amplitude = strength * pulse;
      element.style.setProperty("--home-glitch-opacity", (0.76 * amplitude).toFixed(3));
      element.style.setProperty("--home-glitch-x", `${((hash(seed + 11) - 0.5) * 10 * amplitude).toFixed(1)}px`);
      element.style.setProperty("--home-glitch-y", `${((hash(seed + 19) - 0.5) * 3 * amplitude).toFixed(1)}px`);
      element.style.setProperty("--home-glitch-skew", `${((hash(seed + 23) - 0.5) * 8 * amplitude).toFixed(1)}deg`);
      element.style.setProperty("--home-glitch-cut-top", `${(hash(seed + 29) * 30).toFixed(1)}%`);
      element.style.setProperty("--home-glitch-cut-bottom", `${(hash(seed + 31) * 30).toFixed(1)}%`);
      element.style.setProperty("--home-glitch-red-x", `${((hash(seed + 47) - 0.5) * 0.14 * amplitude).toFixed(3)}em`);
      element.style.setProperty("--home-glitch-red-y", `${((hash(seed + 53) - 0.5) * 0.07 * amplitude).toFixed(3)}em`);
      element.style.setProperty("--home-glitch-white-x", `${((hash(seed + 59) - 0.5) * 0.1 * amplitude).toFixed(3)}em`);
      element.style.setProperty("--home-glitch-white-y", `${((hash(seed + 61) - 0.5) * 0.06 * amplitude).toFixed(3)}em`);
    });
  }

  function updateStructureGlitch(elapsed) {
    if (!structureAttributes.length) {
      structureAttributes = structureTargets.map(({ element }) => ({
        element,
        hadClass: element.classList.contains("home-glitch-structure"),
        styles: STRUCTURE_GLITCH_PROPERTIES.map((property) => [property, element.style.getPropertyValue(property)]),
      }));
    }
    structureTargets.forEach(({ element, start }, index) => {
      element.classList.add("home-glitch-structure");
      const activation = Math.max(0, Math.min(1, (elapsed - start) / 220));
      if (!activation) {
        STRUCTURE_GLITCH_PROPERTIES.forEach((property) => element.style.setProperty(property, "0"));
        return;
      }
      const period = 360 + hash(index * 641 + runSeed) * 440;
      const phase = ((elapsed + hash(index * 313 + 719 + runSeed) * period) % period) / period;
      const pulse = Math.max(pulseWindow(phase, 0.08, 0.13, 0.20), pulseWindow(phase, 0.57, 0.61, 0.66));
      const intensity = activation * (currentStage === "terminal" ? 0.4 + pulse * 0.6 : 0.12 + pulse * 0.68);
      const tick = Math.floor(elapsed / 32);
      const sample = (salt) => hash(tick * 271 + index * 887 + salt);
      element.style.setProperty("--home-structure-x", `${((sample(11) - 0.5) * 16 * intensity).toFixed(1)}px`);
      element.style.setProperty("--home-structure-y", `${((sample(19) - 0.5) * 6 * intensity).toFixed(1)}px`);
      element.style.setProperty("--home-structure-rotate", `${((sample(23) - 0.5) * 0.8 * intensity).toFixed(3)}deg`);
      element.style.setProperty("--home-structure-cut-top", `${(sample(29) * 4.5 * intensity).toFixed(2)}%`);
      element.style.setProperty("--home-structure-cut-bottom", `${(sample(31) * 4.5 * intensity).toFixed(2)}%`);
    });
  }

  function restoreCorruptText() {
    for (const { element, hadClass, hadValue, value, styles } of textAttributes) {
      if (!hadClass) element.classList.remove("home-glitch-copy");
      if (hadValue) element.setAttribute("data-home-glitch-copy", value);
      else element.removeAttribute("data-home-glitch-copy");
      for (const [property, previousValue] of styles) {
        if (previousValue) element.style.setProperty(property, previousValue);
        else element.style.removeProperty(property);
      }
    }
    textAttributes = [];
    textFrame = -1;
    for (const { element, hadClass, styles } of structureAttributes) {
      if (!hadClass) element.classList.remove("home-glitch-structure");
      for (const [property, previousValue] of styles) {
        if (previousValue) element.style.setProperty(property, previousValue);
        else element.style.removeProperty(property);
      }
    }
    structureAttributes = [];
  }

  function pauseNeonAnimations() {
    const neon = homeEnvironment?.element?.querySelectorAll(".construction-neon") ?? [];
    pausedNeonAnimations = Array.from(new Set(Array.from(neon).flatMap((element) => element.getAnimations({ subtree: true }))));
    for (const animation of pausedNeonAnimations) {
      if (ctx.homeCapture?.freezeAnimation) ctx.homeCapture.freezeAnimation(animation);
      else animation.pause();
    }
  }

  function resumeNeonAnimations() {
    for (const animation of pausedNeonAnimations) {
      if (ctx.homeCapture?.resumeAnimation) ctx.homeCapture.resumeAnimation(animation);
      else if (animation.playState !== "finished") animation.play();
    }
    pausedNeonAnimations = [];
  }

  function setStage(stage) {
    if (currentStage === stage) return;
    currentStage = stage;
    if (stage) {
      document.body.dataset.homeGlitchStage = stage;
      ctx.frame.dataset.homeGlitchStage = stage;
      if (homeEnvironment?.element) homeEnvironment.element.dataset.completionGlitch = stage;
    } else {
      delete document.body.dataset.homeGlitchStage;
      delete ctx.frame.dataset.homeGlitchStage;
      if (homeEnvironment?.element) delete homeEnvironment.element.dataset.completionGlitch;
    }
  }

  function lockPage() {
    savedOverflow = {
      root: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.focus({ preventScroll: true });
  }

  function restorePage() {
    if (!savedOverflow) return;
    document.documentElement.style.overflow = savedOverflow.root;
    document.body.style.overflow = savedOverflow.body;
    savedOverflow = null;
  }

  function revealTerminal() {
    dialog.dataset.phase = "terminal";
    terminal.hidden = false;
    status.textContent = isPortuguese
      ? "Digite qualquer senha para reconstruir a apresentação."
      : "Enter any password to reconstruct the presentation.";
    input.focus({ preventScroll: true });
  }

  function showRetryState(message, reopen = false) {
    active = true;
    submitting = false;
    input.value = "";
    input.disabled = false;
    submit.disabled = false;
    terminal.hidden = false;
    dialog.dataset.phase = "terminal";
    status.textContent = message;
    if (reopen && !dialog.open) {
      const now = ctx.homeCapture ? ctx.homeCapture.snapshot().time * 1000 : performance.now();
      startedAt = now;
      ctx.spatialEnvironment?.setNeonRunnersPaused?.(true, now);
      pauseNeonAnimations();
      lockPage();
    }
    setStage("terminal");
    input.focus({ preventScroll: true });
  }

  function start() {
    if (disposed || active || ctx.mobileViewport.matches) return;
    active = true;
    submitting = false;
    input.value = "";
    input.disabled = false;
    submit.disabled = false;
    runSeed = ctx.homeCapture?.snapshot().seed ?? Math.floor(Math.random() * 0xffffffff);
    startedAt = ctx.homeCapture ? ctx.homeCapture.snapshot().time * 1000 : performance.now();
    dialog.dataset.phase = "cascade";
    terminal.hidden = true;
    status.textContent = "";
    codeFields.forEach((field, index) => { field.textContent = makeCode(index + 1); });
    ctx.spatialEnvironment?.setNeonRunnersPaused?.(true, startedAt);
    pauseNeonAnimations();
    lockPage();
    setStage(reducedMotion.matches ? "terminal" : "obsidian");
    if (reducedMotion.matches) revealTerminal();
    ctx.queueFrame?.();
  }

  function setKnightOverlay(state) {
    const amount = state?.stage === "knight" || state?.stage === "terminal" ? state.amount : 0;
    if (!amount || !ctx.knight || !ctx.camera || !ctx.canvas) {
      knightOverlay.hidden = true;
      if (knightBaseRotation && ctx.modelPivot) {
        ctx.modelPivot.rotation.copy(knightBaseRotation);
        knightBaseRotation = null;
      }
      if (knightBasePositionXZ && ctx.modelPivot) {
        ctx.modelPivot.position.x = knightBasePositionXZ.x;
        ctx.modelPivot.position.z = knightBasePositionXZ.z;
        knightBasePositionXZ = null;
      }
      return;
    }

    if (!knightBaseRotation) knightBaseRotation = ctx.modelPivot.rotation.clone();
    if (!knightBasePositionXZ) knightBasePositionXZ = { x: ctx.modelPivot.position.x, z: ctx.modelPivot.position.z };
    const tick = Math.floor(state.totalElapsed * 24);
    const phase = state.totalElapsed * Math.PI * 2;
    const burst = hash(tick * 307 + 29) > 0.62 ? 1 : 0.35;
    ctx.modelPivot.rotation.set(
      knightBaseRotation.x + Math.sin(phase * 1.7 + tick * 0.4) * 0.018 * amount * burst,
      knightBaseRotation.y + Math.sin(phase * 2.3 + 0.7 + tick * 0.7) * 0.024 * amount * burst,
      knightBaseRotation.z + Math.sin(phase * 1.3 + 1.4 + tick * 0.3) * 0.01 * amount * burst,
    );
    ctx.modelPivot.position.x = knightBasePositionXZ.x + (hash(tick * 127 + 43) - 0.5) * 0.05 * amount * burst;
    ctx.modelPivot.position.z = knightBasePositionXZ.z + (hash(tick * 139 + 47) - 0.5) * 0.03 * amount * burst;

    ctx.modelPivot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(ctx.knight);
    if (bounds.isEmpty()) {
      knightOverlay.hidden = true;
      return;
    }
    const projected = [];
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          projected.push(new THREE.Vector3(x, y, z).project(ctx.camera));
        }
      }
    }
    const canvasRect = ctx.canvas.getBoundingClientRect();
    const frameRect = ctx.frame.getBoundingClientRect();
    const xs = projected.map(({ x }) => (x + 1) * 0.5 * canvasRect.width + canvasRect.left - frameRect.left);
    const ys = projected.map(({ y }) => (1 - y) * 0.5 * canvasRect.height + canvasRect.top - frameRect.top);
    const left = Math.max(0, Math.min(...xs));
    const top = Math.max(0, Math.min(...ys));
    const right = Math.min(frameRect.width, Math.max(...xs));
    const bottom = Math.min(frameRect.height, Math.max(...ys));
    if (right <= left || bottom <= top) {
      knightOverlay.hidden = true;
      return;
    }

    knightOverlay.hidden = false;
    knightOverlay.style.left = `${left}px`;
    knightOverlay.style.top = `${top}px`;
    knightOverlay.style.width = `${right - left}px`;
    knightOverlay.style.height = `${bottom - top}px`;
    knightOverlay.style.setProperty("--glitch-strength", String(amount));
    knightSlices.forEach((slice, index) => {
      const activeSlice = hash(tick * 73 + index * 101) > 0.48;
      const offset = (hash(tick * 127 + index * 37) - 0.5) * 9 * amount;
      slice.hidden = !activeSlice;
      slice.classList.toggle("is-bright", hash(tick * 191 + index * 53) > 0.55);
      slice.style.top = `${(8 + hash(index * 311 + tick * 29) * 82).toFixed(1)}%`;
      slice.style.height = `${(1.5 + hash(index * 173 + tick * 43) * 3.5).toFixed(1)}%`;
      slice.style.setProperty("--glitch-shift", `${offset.toFixed(1)}px`);
    });
  }

  function update(timestamp) {
    if (!active || disposed) return null;
    const totalElapsed = Math.max(0, timestamp - startedAt);
    const elapsed = totalElapsed;
    if (reducedMotion.matches) {
      setStage("terminal");
      if (terminal.hidden) revealTerminal();
      setKnightOverlay(null);
      return { stage: "terminal", elapsed: elapsed / 1000, totalElapsed: elapsed / 1000, amount: 0 };
    }

    const phase = CASCADE.find(({ start, end }) => elapsed >= start && elapsed < end);
    if (phase) {
      setStage(phase.stage);
      updateStructureGlitch(elapsed);
      const progress = (elapsed - phase.start) / (phase.end - phase.start);
      const amount = 0.18 + Math.sin(Math.PI * progress) * 0.72;
      if (phase.stage === "text") {
        const nextTextFrame = Math.floor(elapsed / 24);
        if (nextTextFrame !== textFrame) {
          prepareCorruptText(nextTextFrame, elapsed);
          textFrame = nextTextFrame;
        }
      }
      codeFields.forEach((field, index) => { field.textContent = makeCode(index + 1, Math.floor(elapsed / 70)); });
      const state = {
        stage: phase.stage,
        elapsed: (elapsed - phase.start) / 1000,
        totalElapsed: totalElapsed / 1000,
        amount,
      };
      setKnightOverlay(state);
      return state;
    }

    setStage("terminal");
    updateStructureGlitch(elapsed);
    if (terminal.hidden) revealTerminal();
    const loopPhase = (totalElapsed / 1120) % 1;
    const loopBurst = Math.max(
      pulseWindow(loopPhase, 0.035, 0.065, 0.095),
      pulseWindow(loopPhase, 0.39, 0.41, 0.435),
      pulseWindow(loopPhase, 0.72, 0.745, 0.775),
    );
    const amount = 0.12 + loopBurst * 0.7;
    const textFrameNow = Math.floor(elapsed / 24);
    if (textFrameNow !== textFrame) {
      prepareCorruptText(textFrameNow, elapsed);
      textFrame = textFrameNow;
    }
    codeFields.forEach((field, index) => { field.textContent = makeCode(index + 1, Math.floor(elapsed / 72)); });
    const state = { stage: "terminal", elapsed: elapsed / 1000, totalElapsed: totalElapsed / 1000, amount };
    setKnightOverlay(state);
    return state;
  }

  function restorePresentation() {
    active = false;
    submitting = false;
    setStage(null);
    setKnightOverlay(null);
    if (dialog.open) dialog.close();
    delete dialog.dataset.phase;
    terminal.hidden = true;
    restoreCorruptText();
    resumeNeonAnimations();
    const resumeAt = ctx.homeCapture ? ctx.homeCapture.snapshot().time * 1000 : performance.now();
    ctx.spatialEnvironment?.setNeonRunnersPaused?.(false, resumeAt);
    restorePage();
    ctx.spatialEnvironment?.setCompletionGlitch(null);
  }

  function cancel() {
    if (!active) return;
    restorePresentation();
    homeEnvironment?.resetAfterCompletion?.();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!active || submitting) return;
    if (!input.value.length) {
      status.textContent = isPortuguese
        ? "Digite qualquer senha para reiniciar."
        : "Enter any password to restart.";
      input.focus({ preventScroll: true });
      return;
    }

    submitting = true;
    input.value = "";
    input.disabled = true;
    submit.disabled = true;
    dialog.dataset.phase = "reset-pulse";
    status.textContent = isPortuguese
      ? "PREPARANDO A RECONSTRUÇÃO..."
      : "PREPARING RECONSTRUCTION...";

    await new Promise((resolve) => window.setTimeout(resolve, 150));
    let prepared;
    try {
      ctx.frame.dataset.openingReplay = "preparing";
      prepared = await ctx.openingController.prepareReplay();
    } catch (error) {
      console.error("[Home completion] could not prepare the Entrance replay.", error);
      prepared = false;
    }

    if (!active || disposed) return;
    if (prepared === false) {
      ctx.frame.dataset.openingReplay = "prepare-failed";
      showRetryState(isPortuguese
        ? "A cena não ficou pronta. Tente novamente."
        : "The scene is not ready yet. Try again.");
      return;
    }

    restorePresentation();
    homeEnvironment?.resetAfterCompletion?.();
    if (prepared === "static") {
      ctx.status.textContent = isPortuguese
        ? "A apresentação foi reiniciada em modo estático."
        : "The presentation has restarted in static mode.";
      return;
    }
    if (!ctx.openingController.replay()) {
      console.warn("[Home completion] the Entrance replay could not start; keeping the Home at rest.");
      ctx.frame.dataset.openingReplay = "start-failed";
      showRetryState(isPortuguese
        ? "Não foi possível reiniciar a entrada. Tente novamente."
        : "The Entrance could not restart. Try again.", true);
    }
  }

  function onCancel(event) {
    event.preventDefault();
  }

  form.addEventListener("submit", onSubmit);
  dialog.addEventListener("cancel", onCancel);

  function dispose() {
    if (disposed) return;
    disposed = true;
    restorePresentation();
    form.removeEventListener("submit", onSubmit);
    dialog.removeEventListener("cancel", onCancel);
    dialog.remove();
    knightOverlay.remove();
  }

  return { start, update, cancel, dispose, get active() { return active; } };
}
