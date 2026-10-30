import { homeCapture } from "./home-capture.js";

const hero = document.querySelector(".hero-screen");
const frame = document.querySelector("#scene-frame");
const heroTitle = document.querySelector("#hero-title");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
export const mobileViewport = matchMedia("(max-width: 640px), (max-width: 900px) and (orientation: landscape) and (max-height: 520px)");
const mobile = mobileViewport;
const debug = new URLSearchParams(location.search).has("knight-debug");

const phases = {
  idea: { interval: 8000, signalRate: 1.0, coherence: 0.35 },
  structure: { interval: 11000, signalRate: 0.75, coherence: 0.75 },
  form: { interval: 15000, signalRate: 0.4, coherence: 1.0 },
};

function goldenSpiralPath() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const cx = 502, cy = 136;
  const pts = [];
  for (let i = 0; i <= 150; i++) {
    const theta = (i / 150) * (Math.PI * 2.95);
    const r = 9 * Math.pow(phi, (2 * theta) / Math.PI);
    const angle = -theta - 1.25;
    const x = (cx + Math.cos(angle) * r).toFixed(1);
    const y = (cy + Math.sin(angle) * r).toFixed(1);
    pts.push(`${i ? "L" : "M"} ${x} ${y}`);
  }
  return pts.join(" ");
}

function createEnvironment() {
  const setTimeout = homeCapture?.setTimeout ?? window.setTimeout.bind(window);
  const setInterval = homeCapture?.setInterval ?? window.setInterval.bind(window);
  const clearTimeout = homeCapture?.clearTimer ?? window.clearTimeout.bind(window);
  const clearInterval = homeCapture?.clearTimer ?? window.clearInterval.bind(window);
  const random = homeCapture?.random ?? Math.random;
  if (!hero || debug) return null;
  let existing = hero.querySelector(".hero-environment");
  if (existing) existing.remove();

  const element = document.createElement("div");
  element.className = "hero-environment";
  element.setAttribute("aria-hidden", "true");
  element.dataset.phase = "structure";
  element.dataset.spatial = "false";

  element.innerHTML = `
    <!-- Layer A: Distant Horizon with atmospheric gradient and subtle noise texture -->
    <div class="environment-horizon">
      <svg class="environment-grain" width="100%" height="100%">
        <filter id="env-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" seed="23" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#env-grain-filter)" opacity="0.12" />
      </svg>
    </div>

    <!-- Fallback 2D spatial grid shown before WebGL initializes or when WebGL is inactive -->
    <svg class="environment-fallback" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <g fill="#121418" stroke="#5d6067" stroke-opacity="0.24">
        <path d="M520 650V340l42-20v330Zm42-330 25 25v305h-25M1120 680V410l52-23v293Zm52-293 32 27v266h-32M620 670V490l38-16v196Zm38-196 24 19v177h-24M1260 690V280l46-18v428Zm46-428 29 24v404h-29M1030 680V550l38-14v144Zm38-144 25 21v123h-25M720 680V590h45v90Z"/>
      </g>
      <g fill="none" stroke="#bab9b3" stroke-opacity="0.10">
        <path d="M360 690H1440M200 760H1440M0 870H1440M800 650 580 900M920 650 1000 900M1050 650 1440 880M650 650 0 900"/>
      </g>
    </svg>

    <!-- Layer B: Golden Ratio and Construction Geometry (SVG) -->
    <svg class="construction-map" viewBox="0 0 640 700" fill="none">
      <g class="construction-secondary">
        <path d="M35 108H582V602H96V176H538M0 350H640M320 24V676M94 70V620M546 62V644M30 530H609M158 96H603M46 594H568" />
        <circle cx="320" cy="350" r="246" />
        <path d="M98 501A270 270 0 0 1 496 135M122 542A270 270 0 0 0 576 292" />
      </g>
      <g class="construction-primary">
        <circle cx="320" cy="350" r="205" />
        <path d="M320 104V123M320 577V596M74 350H93M547 350H566M143 173l14 14M483 513l14 14M143 527l14-14M483 187l14-14" />
        <path d="M 408 62 H 568 V 161 H 408 Z M 507 62 V 161 M 507 123 H 568 M 545 123 V 161 M 545 147 H 568" />
        <path class="spiral-path" d="${goldenSpiralPath()}" />
      </g>
      <g class="construction-ticks">
        ${Array.from({ length: 17 }, (_, i) => `<path d="M${112 + i * 26} 608v${i % 4 ? 4 : 9}"/>`).join("")}
        <path d="M100 608H540M100 604v16M540 604v16" />
      </g>
      <g class="construction-anchors" fill="currentColor" stroke="none">
        <circle cx="320" cy="104" r="2.2" />
        <circle cx="546" cy="350" r="2.2" />
        <circle cx="94" cy="350" r="2.2" />
        <circle cx="320" cy="596" r="2" />
      </g>
      <g class="construction-neon" style="--signal-path: path('M408 62H568V161H408Z'); --signal-duration: 11s; --signal-delay: -3s;">
        <path class="neon-rail" d="M408 62H568V161H408Z" pathLength="1" />
        <circle class="neon-runner" cx="0" cy="0" r="2" />
      </g>
      <g class="construction-neon" style="--signal-path: path('M507 62V161H568V123H507'); --signal-duration: 8.7s; --signal-delay: -5.4s;">
        <path class="neon-rail" d="M507 62V161H568V123H507" pathLength="1" />
        <circle class="neon-runner" cx="0" cy="0" r="1.8" />
      </g>
      <g class="construction-neon" style="--signal-path: path('M94 176V530H320'); --signal-duration: 13s; --signal-delay: -8s;">
        <path class="neon-rail" d="M94 176V530H320" pathLength="1" />
        <circle class="neon-runner" cx="0" cy="0" r="1.8" />
      </g>
    </svg>

    <div class="mobile-technical-labels">
      <span data-phase-label="idea">ANALYZE<br />DESIGN</span>
      <span data-phase-label="structure">COMPOSE<br />ITERATE<br />SYSTEM</span>
      <span data-phase-label="form">EXECUTION<br />IMPACT</span>
    </div>

    <!-- Technical Text Systems: Loose Spatial Typography (NO GLASS PANELS) -->
    <div class="environment-labels">

      <!-- GROUP A: ANALYZE / DESIGN / COMPOSE / ITERATE (Left Module) -->
      <section class="computational-system system-group-a" data-module="a" aria-label="System A: Synthesis">
        <div class="system-bracket" aria-hidden="true">
          <span class="bracket-tag">SYS.01 // SYNTHESIS</span>
        </div>

        <!-- 1. ANALYZE (Single line binary slots resolving to crimson letters) -->
        <div class="system-node node-analyze" data-kinetic="analyze" tabindex="0" role="button" aria-label="Analyze computational node">
          <span class="node-caption">ANALYZE</span>
          <div class="analyze-slot-line" aria-live="polite">
            <span class="slot" data-index="0" data-char="A">0</span>
            <span class="slot" data-index="1" data-char="N">1</span>
            <span class="slot" data-index="2" data-char="A">0</span>
            <span class="slot" data-index="3" data-char="L">1</span>
            <span class="slot" data-index="4" data-char="Y">0</span>
            <span class="slot" data-index="5" data-char="Z">1</span>
            <span class="slot" data-index="6" data-char="E">1</span>
          </div>
        </div>

        <!-- 2. DESIGN (Refined script typeface giving the expressive 'design...' vibe) -->
        <div class="system-node node-design" data-kinetic="design" tabindex="0" role="button" aria-label="Design computational node">
          <span class="node-caption">DESIGN</span>
          <div class="design-tech-row">
            <span class="tech-word design-word">Design</span>
            <span class="design-marker" aria-hidden="true">+</span>
          </div>
          <div class="design-tech-line" aria-hidden="true">
            <span class="design-rule"></span>
            <span class="design-coord">01.02</span>
          </div>
        </div>

        <!-- 3. COMPOSE (Architectural weighted drop assembling letters) -->
        <div class="system-node node-compose" data-kinetic="compose" tabindex="0" role="button" aria-label="Compose computational node">
          <span class="node-caption">COMPOSE</span>
          <div class="compose-drop-stage">
            <span class="drop-letter" data-index="0" data-char="C">C</span>
            <span class="drop-letter" data-index="1" data-char="O">O</span>
            <span class="drop-letter" data-index="2" data-char="M">M</span>
            <span class="drop-letter" data-index="3" data-char="P">P</span>
            <span class="drop-letter" data-index="4" data-char="O">O</span>
            <span class="drop-letter" data-index="5" data-char="S">S</span>
            <span class="drop-letter" data-index="6" data-char="E">E</span>
          </div>
        </div>

        <!-- 4. ITERATE (Physically connected to COMPOSE, displaced down, cyclic loop) -->
        <div class="system-node node-iterate" data-kinetic="iterate" tabindex="0" role="button" aria-label="Iterate computational node">
          <div class="iterate-row">
            <span class="node-caption">ITERATE</span>
            <span class="iterate-cycle-indicator" aria-hidden="true">↻</span>
          </div>
          <div class="iterate-loop-wrap">
            <svg class="iterate-loop-svg" viewBox="0 0 54 12" fill="none">
              <path class="iterate-loop-path" d="M2 6h36a4 4 0 0 1 0 5H18" />
            </svg>
            <span class="iterate-coord">↳ 02.04</span>
            <span class="iterate-crimson-dot" aria-hidden="true"></span>
          </div>
        </div>
      </section>

      <!-- GROUP B: CONCEPT / SYSTEM / EXECUTION / IMPACT (Right Module) -->
      <section class="computational-system system-group-b" data-module="b" aria-label="System B: Realization">
        <div class="system-bracket" aria-hidden="true">
          <span class="bracket-tag">SYS.02 // REALIZATION</span>
          <span class="system-status-indicator"></span>
        </div>

        <!-- 1. CONCEPT (Neon circuit power-up) -->
        <div class="system-node node-concept" data-kinetic="concept" tabindex="0" role="button" aria-label="Concept computational node">
          <span class="node-caption">CONCEPT</span>
          <div class="concept-circuit-line">
            <span class="circuit-char" data-index="0" data-char="C">C</span>
            <span class="circuit-char" data-index="1" data-char="O">O</span>
            <span class="circuit-char" data-index="2" data-char="N">N</span>
            <span class="circuit-char" data-index="3" data-char="C">C</span>
            <span class="circuit-char" data-index="4" data-char="E">E</span>
            <span class="circuit-char" data-index="5" data-char="P">P</span>
            <span class="circuit-char" data-index="6" data-char="T">T</span>
          </div>
        </div>

        <!-- 2. SYSTEM (Ordered grid binary resolution) -->
        <div class="system-node node-system" data-kinetic="system" tabindex="0" role="button" aria-label="System computational node">
          <span class="node-caption">SYSTEM</span>
          <div class="system-grid-line">
            <span class="sys-slot" data-index="0" data-char="S">1</span>
            <span class="sys-slot" data-index="1" data-char="Y">0</span>
            <span class="sys-slot" data-index="2" data-char="S">1</span>
            <span class="sys-slot" data-index="3" data-char="T">0</span>
            <span class="sys-slot" data-index="4" data-char="E">1</span>
            <span class="sys-slot" data-index="5" data-char="M">1</span>
          </div>
        </div>

        <!-- 3. EXECUTION (Mechanical segmented mask scanline + confirmation) -->
        <div class="system-node node-execution" data-kinetic="execution" tabindex="0" role="button" aria-label="Execution computational node">
          <span class="node-caption">EXECUTION</span>
          <div class="execution-scan-wrap">
            <div class="execution-scanline" aria-hidden="true"></div>
            <div class="execution-word">
              <span class="exec-seg">EXEC</span><span class="exec-seg">UTI</span><span class="exec-seg">ON</span>
            </div>
            <span class="execution-marker" aria-hidden="true">01 ✓</span>
          </div>
        </div>

        <!-- 4. IMPACT (Visual punch scale 0.82 -> 1.12 -> 1.0 + flash line) -->
        <div class="system-node node-impact" data-kinetic="impact" tabindex="0" role="button" aria-label="Impact computational node">
          <div class="impact-flash-line" aria-hidden="true"></div>
          <div class="impact-content">
            <span class="impact-word">IMPACT</span>
            <span class="impact-point" aria-hidden="true">●</span>
          </div>
        </div>
      </section>

      <!-- GROUP C: THINK / SHIP / BUILD / IMPROVE (Lower Supporting Module) -->
      <section class="computational-system system-group-c" data-module="c" aria-label="System C: Cadence">
        <div class="system-bracket" aria-hidden="true">
          <span class="bracket-tag">SYS.03 // CADENCE</span>
          <span class="system-status-indicator"></span>
        </div>
        <div class="chain-flow" role="group" aria-label="Cadence milestone chain">
          <div class="chain-step step-think" data-step="think" tabindex="0" role="button" aria-label="Think milestone">
            <span class="chain-num">01</span>
            <span class="chain-word">THINK</span>
          </div>
          <span class="chain-connector" aria-hidden="true">·</span>
          <div class="chain-step step-ship" data-step="ship" tabindex="0" role="button" aria-label="Ship milestone">
            <span class="chain-num">02</span>
            <span class="chain-word">SHIP</span>
          </div>
          <span class="chain-connector" aria-hidden="true">·</span>
          <div class="chain-step step-build" data-step="build" tabindex="0" role="button" aria-label="Build milestone">
            <span class="chain-num">03</span>
            <span class="chain-word">BUILD</span>
          </div>
          <span class="chain-connector" aria-hidden="true">·</span>
          <div class="chain-step step-improve" data-step="improve" tabindex="0" role="button" aria-label="Improve milestone">
            <span class="chain-num">04</span>
            <span class="chain-word">IMPROVE</span>
          </div>
        </div>
      </section>
    </div>`;

  hero.prepend(element);
  hero.classList.add("has-environment");

  // DOM node references - Group A
  const groupA = element.querySelector(".system-group-a");
  const nodeAnalyze = element.querySelector(".node-analyze");
  const analyzeSlots = Array.from(element.querySelectorAll(".analyze-slot-line .slot"));
  const nodeDesign = element.querySelector(".node-design");
  const nodeCompose = element.querySelector(".node-compose");
  const composeLetters = Array.from(element.querySelectorAll(".compose-drop-stage .drop-letter"));
  const nodeIterate = element.querySelector(".node-iterate");
  const iterateLoopPath = element.querySelector(".iterate-loop-path");
  const iterateCoord = element.querySelector(".iterate-coord");
  const iterateCrimsonDot = element.querySelector(".iterate-crimson-dot");

  // DOM node references - Group B
  const groupB = element.querySelector(".system-group-b");
  const nodeConcept = element.querySelector(".node-concept");
  const conceptChars = Array.from(element.querySelectorAll(".concept-circuit-line .circuit-char"));
  const nodeSystem = element.querySelector(".node-system");
  const systemSlots = Array.from(element.querySelectorAll(".system-grid-line .sys-slot"));
  const nodeExecution = element.querySelector(".node-execution");
  const execScanline = element.querySelector(".execution-scanline");
  const execSegments = Array.from(element.querySelectorAll(".execution-word .exec-seg"));
  const execMarker = element.querySelector(".execution-marker");
  const nodeImpact = element.querySelector(".node-impact");
  const impactFlashLine = element.querySelector(".impact-flash-line");

  // DOM node references - Group C
  const groupC = element.querySelector(".system-group-c");
  const chainSteps = Array.from(element.querySelectorAll(".chain-flow .chain-step"));

  // Track persistent activation states for all 12 elements across all 3 families (Rules 3, 4, 5)
  const interactionState = {
    synthesis: {
      analyze: false,
      design: false,
      compose: false,
      iterate: false,
    },
    realization: {
      concept: false,
      system: false,
      execution: false,
      impact: false,
    },
    cadence: {
      think: false,
      ship: false,
      build: false,
      improve: false,
    },
  };

  let isGlobalResetting = false;
  let analyzeCycleTimer = null;
  let analyzeResolveTimer = null;
  let systemCycleTimer = null;
  let systemResolveTimer = null;
  let conceptTimers = [];
  let composeTimers = [];
  let execTimers = [];
  let iterateInterval = null;
  let iterateCoordIndex = 4;

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let phase = "structure";
  let mobileProgress = 0;
  let active = false;
  let startedAt = null;
  let lastTextAt = 0;
  let limited = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  element.dataset.quality = limited ? "reduced" : "full";

  if (iterateLoopPath) {
    iterateLoopPath.style.strokeDasharray = "64";
    iterateLoopPath.style.strokeDashoffset = "64";
  }

  // Check if ALL 12 required interactions have been activated (Rule 3 & 9)
  function checkAllFamiliesCompleted() {
    const s = interactionState.synthesis;
    const r = interactionState.realization;
    const c = interactionState.cadence;
    return Boolean(
      s.analyze && s.design && s.compose && s.iterate &&
      r.concept && r.system && r.execution && r.impact &&
      c.think && c.ship && c.build && c.improve
    );
  }

  function onInteractionComplete() {
    if (isGlobalResetting) return;
    if (checkAllFamiliesCompleted()) {
      setTimeout(triggerGlobalCompletionSequence, 320);
    }
  }

  /* -------------------------------------------------------------
     GROUP A KINETIC ENGINES (PERSISTENT ACTIVATION)
  ------------------------------------------------------------- */

  // 1. ANALYZE: Single line slot-by-slot binary search -> locks in crimson
  const analyzeWord = "ANALYZE";
  const initialAnalyzeBinary = ["0", "1", "0", "1", "0", "1", "1"];

  function triggerAnalyze() {
    if (reducedMotion.matches || interactionState.synthesis.analyze || isGlobalResetting) return;

    nodeAnalyze?.classList.add("is-active");
    groupA?.classList.add("has-active");

    if (analyzeCycleTimer) clearInterval(analyzeCycleTimer);
    if (analyzeResolveTimer) clearInterval(analyzeResolveTimer);

    let resolvedCount = 0;
    analyzeCycleTimer = setInterval(() => {
      // Rapid cycling for unresolved slots
      for (let i = resolvedCount; i < analyzeSlots.length; i++) {
        analyzeSlots[i].textContent = random() > 0.5 ? "1" : "0";
      }
    }, 45);

    analyzeResolveTimer = setInterval(() => {
      if (resolvedCount < analyzeSlots.length) {
        const slot = analyzeSlots[resolvedCount];
        slot.textContent = analyzeWord[resolvedCount];
        slot.classList.add("is-resolved");
        resolvedCount++;
      } else {
        clearInterval(analyzeCycleTimer);
        clearInterval(analyzeResolveTimer);
        analyzeCycleTimer = null;
        analyzeResolveTimer = null;

        interactionState.synthesis.analyze = true;
        nodeAnalyze?.classList.add("is-resolved");
        nodeAnalyze?.classList.remove("is-active");

        onInteractionComplete();
      }
    }, 140);
  }

  // 2. DESIGN: Clean technical presentation (restrained construction rule & marker flash)
  function triggerDesign() {
    if (reducedMotion.matches || interactionState.synthesis.design || isGlobalResetting) return;

    nodeDesign?.classList.add("is-active");
    groupA?.classList.add("has-active");

    const marker = nodeDesign?.querySelector(".design-marker");
    if (marker) {
      marker.animate(
        [
          { transform: "scale(1.6)", color: "#ffffff", opacity: 1 },
          { transform: "scale(1.0)", color: "#ff1230", opacity: 0.9 },
        ],
        { duration: 240, easing: "ease-out" }
      );
    }

    setTimeout(() => {
      interactionState.synthesis.design = true;
      nodeDesign?.classList.add("is-resolved");
      nodeDesign?.classList.remove("is-active");
      onInteractionComplete();
    }, 280);
  }

  // 3. COMPOSE: Weighted architectural drop assembling letters -> turns crimson on landing
  function triggerCompose() {
    if (reducedMotion.matches || interactionState.synthesis.compose || isGlobalResetting || !composeLetters.length) return;

    nodeCompose?.classList.add("is-active");
    groupA?.classList.add("has-active");

    composeLetters.forEach((letter) => {
      letter.style.transform = "translateY(-12px)";
      letter.style.opacity = "0.25";
    });

    composeTimers.forEach(clearTimeout);
    composeTimers = [];

    const stepDelay = 75;
    composeLetters.forEach((letter, index) => {
      const t = setTimeout(() => {
        letter.style.transform = "translateY(0)";
        letter.style.opacity = "1";

        if (index === composeLetters.length - 1) {
          interactionState.synthesis.compose = true;
          nodeCompose?.classList.add("is-resolved");
          nodeCompose?.classList.remove("is-active");

          // Displace ITERATE vertically, but DO NOT auto-complete it (Rule 4)!
          nodeIterate?.animate(
            [
              { transform: "translateY(0)" },
              { transform: "translateY(4px)" },
              { transform: "translateY(0)" },
            ],
            { duration: 250, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
          );

          onInteractionComplete();
        }
      }, index * stepDelay);
      composeTimers.push(t);
    });
  }

  // 4. ITERATE: Requires its own interaction to complete (Rule 4), then loops subtly
  function triggerIterate() {
    if (reducedMotion.matches || interactionState.synthesis.iterate || isGlobalResetting) return;

    interactionState.synthesis.iterate = true;
    groupA?.classList.add("has-active");
    nodeIterate?.classList.add("is-looping", "is-resolved");
    if (iterateCrimsonDot) iterateCrimsonDot.classList.add("is-active");

    function runCycle() {
      if (!interactionState.synthesis.iterate || isGlobalResetting) return;

      iterateCoordIndex++;
      if (iterateCoordIndex > 12) iterateCoordIndex = 4;
      if (iterateCoord) {
        iterateCoord.textContent = `↳ 02.${String(iterateCoordIndex).padStart(2, "0")}`;
      }

      if (iterateLoopPath) {
        iterateLoopPath.animate(
          [
            { strokeDashoffset: "64", opacity: 0.3 },
            { strokeDashoffset: "0", opacity: 0.8 },
          ],
          { duration: 480, easing: "ease-out" }
        );
      }
    }

    runCycle();
    if (iterateInterval) clearInterval(iterateInterval);
    iterateInterval = setInterval(runCycle, 2200);

    onInteractionComplete();
  }

  /* -------------------------------------------------------------
     GROUP B KINETIC ENGINES (PERSISTENT ACTIVATION)
  ------------------------------------------------------------- */

  // 5. CONCEPT: Neon circuit power-up letter by letter
  function triggerConcept() {
    if (reducedMotion.matches || interactionState.realization.concept || isGlobalResetting || !conceptChars.length) return;

    nodeConcept?.classList.add("is-active");
    groupB?.classList.add("has-active");

    conceptTimers.forEach(clearTimeout);
    conceptTimers = [];

    const stepDelay = 90;
    conceptChars.forEach((charEl, idx) => {
      const t1 = setTimeout(() => {
        charEl.classList.add("is-powered", "is-glowing");
        const t2 = setTimeout(() => charEl.classList.remove("is-glowing"), 180);
        conceptTimers.push(t2);

        if (idx === conceptChars.length - 1) {
          interactionState.realization.concept = true;
          nodeConcept?.classList.add("is-resolved");
          nodeConcept?.classList.remove("is-active");
          onInteractionComplete();
        }
      }, idx * stepDelay);
      conceptTimers.push(t1);
    });
  }

  // 6. SYSTEM: Ordered binary grid resolution -> locks in crimson
  const systemWord = "SYSTEM";
  const initialSystemBinary = ["1", "0", "1", "0", "1", "1"];

  function triggerSystem() {
    if (reducedMotion.matches || interactionState.realization.system || isGlobalResetting) return;

    nodeSystem?.classList.add("is-active");
    groupB?.classList.add("has-active");

    if (systemCycleTimer) clearInterval(systemCycleTimer);
    if (systemResolveTimer) clearInterval(systemResolveTimer);

    let resolvedCount = 0;
    systemCycleTimer = setInterval(() => {
      for (let i = resolvedCount; i < systemSlots.length; i++) {
        systemSlots[i].textContent = random() > 0.5 ? "1" : "0";
      }
    }, 45);

    systemResolveTimer = setInterval(() => {
      if (resolvedCount < systemSlots.length) {
        const slot = systemSlots[resolvedCount];
        slot.textContent = systemWord[resolvedCount];
        slot.classList.add("is-resolved");
        resolvedCount++;
      } else {
        clearInterval(systemCycleTimer);
        clearInterval(systemResolveTimer);
        systemCycleTimer = null;
        systemResolveTimer = null;

        interactionState.realization.system = true;
        nodeSystem?.classList.add("is-resolved");
        nodeSystem?.classList.remove("is-active");

        onInteractionComplete();
      }
    }, 130);
  }

  // 7. EXECUTION: Mechanical scan line unmasking segments + checkmark confirmation
  function triggerExecution() {
    if (reducedMotion.matches || interactionState.realization.execution || isGlobalResetting) return;

    nodeExecution?.classList.add("is-active");
    groupB?.classList.add("has-active");

    if (execScanline) {
      execScanline.animate(
        [
          { transform: "translateX(-100%)", opacity: 0.3 },
          { transform: "translateX(100%)", opacity: 1 },
        ],
        { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)" }
      );
    }

    execTimers.forEach(clearTimeout);
    execTimers = [];

    execSegments.forEach((seg, idx) => {
      const t = setTimeout(() => seg.classList.add("is-unmasked"), idx * 95);
      execTimers.push(t);
    });

    const tFinal = setTimeout(() => {
      if (execMarker) execMarker.classList.add("is-confirmed");
      interactionState.realization.execution = true;
      nodeExecution?.classList.add("is-resolved");
      nodeExecution?.classList.remove("is-active");
      onInteractionComplete();
    }, 320);
    execTimers.push(tFinal);
  }

  // 8. IMPACT: Punch scale 0.82 -> 1.12 -> 1.0 (210ms) + crimson impulse
  function triggerImpact() {
    if (reducedMotion.matches || interactionState.realization.impact || isGlobalResetting) return;

    nodeImpact?.classList.add("is-active");
    groupB?.classList.add("has-active");

    nodeImpact?.animate(
      [
        { transform: "scale(0.82)", opacity: 0.6 },
        { transform: "scale(1.12)", opacity: 1, offset: 0.45 },
        { transform: "scale(1.0)", opacity: 1 },
      ],
      { duration: 210, easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)" }
    );

    if (impactFlashLine) {
      impactFlashLine.animate(
        [
          { transform: "scaleX(0)", opacity: 1, background: "#ffffff" },
          { transform: "scaleX(1.3)", opacity: 1, background: "#ff1230", offset: 0.5 },
          { transform: "scaleX(1.0)", opacity: 0.8, background: "#ff1230" },
        ],
        { duration: 230, easing: "ease-out" }
      );
    }

    setTimeout(() => {
      interactionState.realization.impact = true;
      nodeImpact?.classList.add("is-resolved");
      nodeImpact?.classList.remove("is-active");
      onInteractionComplete();
    }, 210);
  }

  /* -------------------------------------------------------------
     GROUP C: INDIVIDUAL ACTIVATION
  ------------------------------------------------------------- */
  function activateCadenceStep(stepName) {
    if (reducedMotion.matches || isGlobalResetting || interactionState.cadence[stepName]) return;

    interactionState.cadence[stepName] = true;
    groupC?.classList.add("has-active");

    const stepEl = element.querySelector(`.chain-step[data-step="${stepName}"]`);
    if (stepEl) {
      stepEl.classList.add("is-active");
      stepEl.animate(
        [
          { transform: "scale(1.0)" },
          { transform: "scale(1.12)", offset: 0.4 },
          { transform: "scale(1.0)" },
        ],
        { duration: 240, easing: "ease-out" }
      );
    }

    onInteractionComplete();
  }

  /* -------------------------------------------------------------
     GLOBAL COMPLETION SEQUENCE & COUCH HACK RESET (Rules 9, 10, 11)
  ------------------------------------------------------------- */
  function triggerGlobalCompletionSequence() {
    if (isGlobalResetting) return;
    isGlobalResetting = true;

    // 1. Restrained H1 glyph specular sweep (~650ms, strictly inside typography)
    if (heroTitle) {
      heroTitle.classList.remove("h1-specular-sweep");
      void heroTitle.offsetWidth; // force reflow
      heroTitle.classList.add("h1-specular-sweep");
      setTimeout(() => heroTitle.classList.remove("h1-specular-sweep"), 650);
    }

    // 2. Coordinated hack glitch across technical systems (~350ms)
    setTimeout(() => {
      element.classList.add("is-glitching-reconstruction");

      const glitchChars = ["0", "1", "/", "_", "%", "□", "X", "7", "!"];
      const slots = element.querySelectorAll(".slot, .circuit-char, .sys-slot, .chain-word");
      slots.forEach((s, i) => {
        s.textContent = glitchChars[i % glitchChars.length];
      });

      // Quick secondary corruption wave
      setTimeout(() => {
        slots.forEach((s, i) => {
          s.textContent = glitchChars[(i + 3) % glitchChars.length];
        });
      }, 120);

      // 3. Complete programmatic reset: return all systems to fresh dormant states
      setTimeout(() => {
        element.classList.remove("is-glitching-reconstruction");
        resetAllSystems();
        isGlobalResetting = false;
      }, 350);
    }, 450);
  }

  function resetAllSystems() {
    // 1. Clear all active timers
    if (analyzeCycleTimer) { clearInterval(analyzeCycleTimer); analyzeCycleTimer = null; }
    if (analyzeResolveTimer) { clearInterval(analyzeResolveTimer); analyzeResolveTimer = null; }
    if (systemCycleTimer) { clearInterval(systemCycleTimer); systemCycleTimer = null; }
    if (systemResolveTimer) { clearInterval(systemResolveTimer); systemResolveTimer = null; }
    if (iterateInterval) { clearInterval(iterateInterval); iterateInterval = null; }
    conceptTimers.forEach(clearTimeout); conceptTimers = [];
    composeTimers.forEach(clearTimeout); composeTimers = [];
    execTimers.forEach(clearTimeout); execTimers = [];

    // 2. Clear all 12 persistent flags across all 3 families
    Object.keys(interactionState.synthesis).forEach((k) => { interactionState.synthesis[k] = false; });
    Object.keys(interactionState.realization).forEach((k) => { interactionState.realization[k] = false; });
    Object.keys(interactionState.cadence).forEach((k) => { interactionState.cadence[k] = false; });

    // 3. Remove active group highlight states
    groupA?.classList.remove("has-active");
    groupB?.classList.remove("has-active");
    groupC?.classList.remove("has-active");

    // 4. Reset ANALYZE: full return to dormant unresolved binary
    nodeAnalyze?.classList.remove("is-resolved", "is-active");
    analyzeSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = initialAnalyzeBinary[i];
    });

    // 5. Reset DESIGN
    nodeDesign?.classList.remove("is-resolved", "is-active");

    // 6. Reset COMPOSE
    nodeCompose?.classList.remove("is-resolved", "is-active");
    composeLetters.forEach((letter) => {
      letter.style.transform = "";
      letter.style.opacity = "";
    });

    // 7. Reset ITERATE
    nodeIterate?.classList.remove("is-looping", "is-resolved", "is-active");
    if (iterateCrimsonDot) iterateCrimsonDot.classList.remove("is-active");
    if (iterateLoopPath) iterateLoopPath.style.strokeDashoffset = "64";
    if (iterateCoord) iterateCoord.textContent = "↳ 02.04";
    iterateCoordIndex = 4;

    // 8. Reset CONCEPT
    nodeConcept?.classList.remove("is-resolved", "is-active");
    const conceptWord = "CONCEPT";
    conceptChars.forEach((c, idx) => {
      c.classList.remove("is-powered", "is-glowing");
      c.textContent = conceptWord[idx];
    });

    // 9. Reset SYSTEM: full return to dormant unresolved binary
    nodeSystem?.classList.remove("is-resolved", "is-active");
    systemSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = initialSystemBinary[i];
    });

    // 10. Reset EXECUTION
    nodeExecution?.classList.remove("is-resolved", "is-active");
    execSegments.forEach((seg) => seg.classList.remove("is-unmasked"));
    if (execMarker) execMarker.classList.remove("is-confirmed");
    if (execScanline) execScanline.style.transform = "translateX(-100%)";

    // 11. Reset IMPACT
    nodeImpact?.classList.remove("is-resolved", "is-active");
    if (impactFlashLine) impactFlashLine.style.transform = "scaleX(0)";

    // 12. Reset CADENCE
    const chainWords = ["THINK", "SHIP", "BUILD", "IMPROVE"];
    chainSteps.forEach((s, idx) => {
      s.classList.remove("is-active");
      const wordEl = s.querySelector(".chain-word");
      if (wordEl) wordEl.textContent = chainWords[idx];
    });
  }

  /* -------------------------------------------------------------
     EVENT BINDINGS (MOUSE, POINTER, KEYBOARD ACCESSIBILITY)
  ------------------------------------------------------------- */
  function dispatchKinetic(kind) {
    switch (kind) {
      case "analyze": triggerAnalyze(); break;
      case "design": triggerDesign(); break;
      case "compose": triggerCompose(); break;
      case "iterate": triggerIterate(); break;
      case "concept": triggerConcept(); break;
      case "system": triggerSystem(); break;
      case "execution": triggerExecution(); break;
      case "impact": triggerImpact(); break;
    }
  }

  const nodes = element.querySelectorAll("[data-kinetic]");
  homeCapture?.bindSystems({
    trigger(name) {
      if (["analyze", "design", "compose", "iterate", "concept", "system", "execution", "impact"].includes(name)) {
        dispatchKinetic(name);
      } else if (["think", "ship", "build", "improve"].includes(name)) {
        activateCadenceStep(name);
      } else {
        throw new TypeError("Unknown Home capture interaction.");
      }
    },
    snapshot: () => ({ families: structuredClone(interactionState), resetting: isGlobalResetting }),
  });
  nodes.forEach((node) => {
    const kind = node.dataset.kinetic;
    const onTrigger = (e) => {
      if (e?.pointerType === "touch") return;
      dispatchKinetic(kind);
    };

    node.addEventListener("pointerenter", onTrigger, { passive: true });
    node.addEventListener("mouseenter", onTrigger, { passive: true });
    node.addEventListener("click", onTrigger);
    node.addEventListener("focus", onTrigger);
  });

  // Group C: Each word activated independently on hover (Rule 12)
  chainSteps.forEach((step) => {
    const stepName = step.dataset.step;
    const onStepTrigger = (e) => {
      if (e?.pointerType === "touch") return;
      activateCadenceStep(stepName);
    };

    step.addEventListener("pointerenter", onStepTrigger, { passive: true });
    step.addEventListener("mouseenter", onStepTrigger, { passive: true });
    step.addEventListener("click", onStepTrigger);
    step.addEventListener("focus", onStepTrigger);
  });

  // Mouse tracking: knight tracking continues uninterrupted!
  hero.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || mobile.matches || event.pointerType === "touch") return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = (event.clientX - bounds.left) / bounds.width - 0.5;
    target.y = (event.clientY - bounds.top) / bounds.height - 0.5;

    // Proximity pre-activation cues (~55px zone)
    const mx = event.clientX;
    const my = event.clientY;
    nodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < 55 && dist > 10) {
        node.classList.add("is-proximate");
      } else {
        node.classList.remove("is-proximate");
      }
    });
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    target.x = 0;
    target.y = 0;
    nodes.forEach((node) => node.classList.remove("is-proximate"));
  });

  function settle() {
    for (const anim of element.querySelector(".environment-labels").getAnimations({ subtree: true })) anim.cancel();
    pointer.x = pointer.y = target.x = target.y = 0;
    element.style.setProperty("--environment-x", "0px");
    element.style.setProperty("--environment-y", "0px");
    resetAllSystems();
  }

  reducedMotion.addEventListener("change", settle);
  mobile.addEventListener("change", settle);

  return {
    element,
    pointer,
    get phase() { return phases[phase]; },
    get mobile() { return mobile.matches; },
    get progress() { return mobileProgress; },
    get limited() { return limited || mobile.matches; },
    get animating() { return active && !reducedMotion.matches && !document.hidden; },

    setPhase(next) {
      if (!phases[next]) return;
      phase = next;
      element.dataset.phase = next;
    },

    setProgress(value) {
      mobileProgress = value;
    },

    setActive(value) {
      active = value;
      element.dataset.spatial = String(value && !reducedMotion.matches);
      if (!value) settle();
    },

    setAnchor(center, bounds) {
      if (!center || !bounds?.width) return;
      const heroBounds = mobile.matches ? bounds : hero.getBoundingClientRect();
      element.style.setProperty("--knight-axis-x", `${(center.x - heroBounds.left).toFixed(1)}px`);
      element.style.setProperty("--knight-axis-y", `${(center.y - heroBounds.top).toFixed(1)}px`);
    },

    update(timestamp, elapsed) {
      if (!this.animating) return;
      if (startedAt === null) startedAt = timestamp;

      if (mobile.matches) {
        pointer.x = (mobileProgress - 0.5) * 0.12 + Math.sin((timestamp - startedAt) / 12000) * 0.025;
        pointer.y = (mobileProgress - 0.5) * 0.45;
      } else {
        pointer.x += (target.x - pointer.x) * 0.05;
        pointer.y += (target.y - pointer.y) * 0.05;
      }

      if (timestamp - lastTextAt < 60) return;
      lastTextAt = timestamp;

      // Parallax offsets in CSS variables
      element.style.setProperty("--environment-x", `${(pointer.x * (mobile.matches ? 18 : this.limited ? 0 : 14)).toFixed(2)}px`);
      element.style.setProperty("--environment-y", `${(pointer.y * (mobile.matches ? 30 : this.limited ? 0 : 10)).toFixed(2)}px`);
    },
  };
}

export const homeEnvironment = createEnvironment();
