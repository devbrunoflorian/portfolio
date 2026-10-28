const hero = document.querySelector(".hero-screen");
const frame = document.querySelector("#scene-frame");
const heroTitle = document.querySelector("#hero-title");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobile = matchMedia("(max-width: 640px)");
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
        <rect width="100%" height="100%" filter="url(#env-grain-filter)" opacity="0.14" />
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
        <circle cx="94" cy="176" r="2.2" />
        <circle cx="507" cy="161" r="1.8" />
        <circle cx="568" cy="123" r="1.8" />
        <circle cx="507" cy="62" r="1.8" />
        <circle cx="320" cy="596" r="2" />
      </g>
    </svg>

    <!-- Section 6: Technical Text System (Three Compact Computational Systems) -->
    <div class="environment-labels">
      
      <!-- GROUP A: ANALYZE / DESIGN / COMPOSE / ITERATE (Left Module) -->
      <section class="computational-system system-group-a" data-module="a" aria-label="System A: Synthesis">
        <div class="system-bracket" aria-hidden="true">
          <span class="bracket-tag">SYS.01 // SYNTHESIS</span>
          <span class="system-status-indicator"></span>
        </div>

        <!-- 1. ANALYZE (Single line binary slot resolver) -->
        <div class="system-node node-analyze" data-kinetic="analyze" tabindex="0" role="button" aria-label="Analyze computational node">
          <span class="node-caption">ANALYZE</span>
          <div class="analyze-slot-line" aria-live="polite">
            <span class="slot" data-index="0" data-char="A">0</span>
            <span class="slot" data-index="1" data-char="N">1</span>
            <span class="slot" data-index="2" data-char="A">0</span>
            <span class="slot" data-index="3" data-char="L">1</span>
            <span class="slot" data-index="4" data-char="Y">1</span>
            <span class="slot" data-index="5" data-char="Z">0</span>
            <span class="slot" data-index="6" data-char="E">1</span>
          </div>
        </div>

        <!-- 2. DESIGN (Cursive handwriting SVG path draw + crosshair) -->
        <div class="system-node node-design" data-kinetic="design" tabindex="0" role="button" aria-label="Design computational node">
          <span class="node-caption">DESIGN</span>
          <div class="design-script-wrap">
            <svg class="design-script-svg" viewBox="0 0 155 52" fill="none">
              <path class="design-script-path" d="M12 40Q23 20 32 8M9 18Q31-2 48 10Q65 28 27 41Q9 46 12 38M48 32Q70 18 61 21Q47 24 49 34Q53 41 70 29M78 22Q64 24 74 30Q86 34 68 38M88 25l-7 12 12-7M91 18l1-2M107 25Q102 19 94 30Q91 40 103 31L110 24Q98 56 88 46Q84 40 110 32M114 25l-6 12Q126 15 124 28l-3 9 15-11M15 47Q68 39 143 39" />
            </svg>
            <span class="design-marker" aria-hidden="true">+</span>
          </div>
        </div>

        <!-- 3. COMPOSE (Vertical drop assembling letters) -->
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

        <!-- 4. ITERATE (Physically connected to COMPOSE, pulled down on drop, cyclic loop) -->
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

        <!-- 1. CONCEPT (Letter-by-letter neon circuit power-up) -->
        <div class="system-node node-concept" data-kinetic="concept" tabindex="0" role="button" aria-label="Concept computational node">
          <span class="node-caption">CONCEPT</span>
          <div class="concept-circuit-line">
            <span class="circuit-char" data-index="0">C</span>
            <span class="circuit-char" data-index="1">O</span>
            <span class="circuit-char" data-index="2">N</span>
            <span class="circuit-char" data-index="3">C</span>
            <span class="circuit-char" data-index="4">E</span>
            <span class="circuit-char" data-index="5">P</span>
            <span class="circuit-char" data-index="6">T</span>
          </div>
        </div>

        <!-- 2. SYSTEM (Ordered binary grid alignment) -->
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
            <span class="execution-marker" aria-hidden="true">✓</span>
          </div>
        </div>

        <!-- 4. IMPACT (Visual punch scale 0.8 -> 1.12 -> 1.0 + flash line) -->
        <div class="system-node node-impact" data-kinetic="impact" tabindex="0" role="button" aria-label="Impact computational node">
          <div class="impact-flash-line" aria-hidden="true"></div>
          <div class="impact-content">
            <span class="impact-word">IMPACT</span>
            <span class="impact-point" aria-hidden="true">●</span>
          </div>
        </div>
      </section>

      <!-- GROUP C: THINK / SHIP / BUILD / IMPROVE (Lower Supporting Sequential Module) -->
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
          <span class="chain-connector" aria-hidden="true">→</span>
          <div class="chain-step step-ship" data-step="ship" tabindex="0" role="button" aria-label="Ship milestone">
            <span class="chain-num">02</span>
            <span class="chain-word">SHIP</span>
          </div>
          <span class="chain-connector" aria-hidden="true">→</span>
          <div class="chain-step step-build" data-step="build" tabindex="0" role="button" aria-label="Build milestone">
            <span class="chain-num">03</span>
            <span class="chain-word">BUILD</span>
          </div>
          <span class="chain-connector" aria-hidden="true">→</span>
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
  const designPath = element.querySelector(".design-script-path");
  const designMarker = element.querySelector(".design-marker");
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
  const impactWord = element.querySelector(".impact-word");
  const impactFlashLine = element.querySelector(".impact-flash-line");
  const impactPoint = element.querySelector(".impact-point");

  // DOM node references - Group C
  const groupC = element.querySelector(".system-group-c");
  const chainSteps = Array.from(element.querySelectorAll(".chain-flow .chain-step"));

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let phase = "structure";
  let active = false;
  let startedAt = null;
  let lastTextAt = 0;
  let limited = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  element.dataset.quality = limited ? "reduced" : "full";

  // Initialize handwriting stroke
  if (designPath) {
    designPath.style.strokeDasharray = "420";
    designPath.style.strokeDashoffset = "420";
    designPath.style.opacity = "0";
  }
  if (iterateLoopPath) {
    iterateLoopPath.style.strokeDasharray = "64";
    iterateLoopPath.style.strokeDashoffset = "64";
  }

  // Trigger cooldowns to prevent spamming
  const lastTriggered = new Map();
  function canTrigger(id, cooldown = 500) {
    const now = performance.now();
    const last = lastTriggered.get(id) || 0;
    if (now - last < cooldown) return false;
    lastTriggered.set(id, now);
    return true;
  }

  /* -------------------------------------------------------------
     GROUP A KINETIC ENGINES
  ------------------------------------------------------------- */

  // 1. ANALYZE: Single line binary slot resolver -> locks into crimson letters
  let analyzeInterval = null;
  let analyzeStep = 0;
  let analyzeResetTimer = null;
  const analyzeWord = "ANALYZE";

  function resetAnalyze() {
    if (analyzeInterval) clearInterval(analyzeInterval);
    if (analyzeResetTimer) clearTimeout(analyzeResetTimer);
    analyzeInterval = null;
    analyzeStep = 0;
    nodeAnalyze?.classList.remove("is-resolved", "is-active");
    analyzeSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = (i % 2 === 0 ? "0" : "1");
    });
  }

  function triggerAnalyze() {
    if (reducedMotion.matches) return;
    if (!canTrigger("analyze", 600)) return;
    if (analyzeInterval) clearInterval(analyzeInterval);
    if (analyzeResetTimer) clearTimeout(analyzeResetTimer);

    nodeAnalyze?.classList.add("is-active");
    analyzeStep = 0;

    analyzeInterval = setInterval(() => {
      // Cycle unresolved slots rapidly between 0 and 1
      for (let i = analyzeStep; i < analyzeSlots.length; i++) {
        analyzeSlots[i].textContent = Math.random() > 0.5 ? "1" : "0";
      }

      // Lock current slot into correct letter with crimson activation
      if (analyzeStep < analyzeSlots.length) {
        const slot = analyzeSlots[analyzeStep];
        slot.textContent = analyzeWord[analyzeStep];
        slot.classList.add("is-resolved");
        analyzeStep++;
      } else {
        // All resolved: complete word is now crimson
        clearInterval(analyzeInterval);
        analyzeInterval = null;
        nodeAnalyze?.classList.add("is-resolved");
        nodeAnalyze?.classList.remove("is-active");

        // Short stable state then return to dormant
        analyzeResetTimer = setTimeout(resetAnalyze, 4500);
      }
    }, 110);
  }

  // 2. DESIGN: SVG handwriting path draws left-to-right, crimson glow + crosshair flash
  let designAnim = null;
  let designResetTimer = null;

  function resetDesign() {
    if (designAnim) designAnim.cancel();
    if (designResetTimer) clearTimeout(designResetTimer);
    nodeDesign?.classList.remove("is-drawn", "is-active");
    if (designPath) {
      designPath.style.strokeDashoffset = "420";
      designPath.style.opacity = "0";
    }
    if (designMarker) {
      designMarker.classList.remove("is-flashing");
    }
  }

  function triggerDesign() {
    if (reducedMotion.matches || !designPath) return;
    if (!canTrigger("design", 700)) return;
    if (designAnim) designAnim.cancel();
    if (designResetTimer) clearTimeout(designResetTimer);

    nodeDesign?.classList.add("is-active");
    designPath.style.opacity = "1";

    designAnim = designPath.animate(
      [
        { strokeDashoffset: "420", opacity: 0.4 },
        { strokeDashoffset: "0", opacity: 1 },
      ],
      { duration: 750, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)", fill: "forwards" }
    );

    designAnim.onfinish = () => {
      nodeDesign?.classList.add("is-drawn");
      nodeDesign?.classList.remove("is-active");
      if (designMarker) {
        designMarker.classList.add("is-flashing");
        designMarker.animate(
          [
            { transform: "scale(1.8)", color: "#ffffff", opacity: 1 },
            { transform: "scale(1.0)", color: "#ff1230", opacity: 1 },
          ],
          { duration: 240, easing: "ease-out" }
        );
      }
      designResetTimer = setTimeout(resetDesign, 4500);
    };
  }

  // 3. COMPOSE: Architectural vertical drop assembling letters -> turns crimson at end
  let composeTimeouts = [];
  let composeResetTimer = null;

  function resetCompose() {
    composeTimeouts.forEach(clearTimeout);
    composeTimeouts = [];
    if (composeResetTimer) clearTimeout(composeResetTimer);
    nodeCompose?.classList.remove("is-resolved", "is-active");
    composeLetters.forEach((letter) => {
      letter.classList.remove("is-dropped");
      letter.style.transform = "";
      letter.style.opacity = "";
    });
  }

  function triggerCompose() {
    if (reducedMotion.matches || !composeLetters.length) return;
    if (!canTrigger("compose", 700)) return;
    composeTimeouts.forEach(clearTimeout);
    composeTimeouts = [];
    if (composeResetTimer) clearTimeout(composeResetTimer);

    nodeCompose?.classList.add("is-active");
    nodeCompose?.classList.remove("is-resolved");

    // Letters begin separated / slightly raised
    composeLetters.forEach((letter) => {
      letter.classList.remove("is-dropped");
      letter.style.transform = "translateY(-14px)";
      letter.style.opacity = "0.2";
    });

    // Sequential heavy architectural drop
    const stepDuration = 80;
    composeLetters.forEach((letter, index) => {
      const t = setTimeout(() => {
        letter.classList.add("is-dropped");
        letter.style.transform = "translateY(0)";
        letter.style.opacity = "1";

        // As the final letter lands with subtle weight
        if (index === composeLetters.length - 1) {
          nodeCompose?.classList.add("is-resolved");
          nodeCompose?.classList.remove("is-active");

          // When COMPOSE lands, pull and displace ITERATE with it!
          triggerIterateDisplaced();

          composeResetTimer = setTimeout(resetCompose, 4500);
        }
      }, index * stepDuration);
      composeTimeouts.push(t);
    });
  }

  // 4. ITERATE: Physically connected to COMPOSE, pulled down on drop, cyclic loop
  let iterateResetTimer = null;
  let iterateCoordIndex = 4;

  function resetIterate() {
    if (iterateResetTimer) clearTimeout(iterateResetTimer);
    nodeIterate?.classList.remove("is-active", "is-resolved");
    if (iterateCrimsonDot) iterateCrimsonDot.classList.remove("is-active");
    if (iterateLoopPath) iterateLoopPath.style.strokeDashoffset = "64";
  }

  function triggerIterateDisplaced() {
    // When COMPOSE drops, ITERATE is physically pulled / displaced downward
    nodeIterate?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(6px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)" }
    );
    // Follow with iterate loop process
    setTimeout(() => triggerIterate(true), 120);
  }

  function triggerIterate(fromCompose = false) {
    if (reducedMotion.matches) return;
    if (!fromCompose && !canTrigger("iterate", 600)) return;
    if (iterateResetTimer) clearTimeout(iterateResetTimer);

    nodeIterate?.classList.add("is-active");

    // Circular/loop progress trace
    if (iterateLoopPath) {
      iterateLoopPath.animate(
        [
          { strokeDashoffset: "64", opacity: 0.3 },
          { strokeDashoffset: "0", opacity: 1 },
        ],
        { duration: 420, easing: "ease-out" }
      );
    }

    // Letters shift one position and snap back
    nodeIterate?.querySelector(".node-caption")?.animate(
      [
        { transform: "translateX(3px)" },
        { transform: "translateX(-1px)", offset: 0.6 },
        { transform: "translateX(0)" },
      ],
      { duration: 280, easing: "ease-out" }
    );

    // Coordinate counter increments once
    iterateCoordIndex++;
    if (iterateCoord) {
      iterateCoord.textContent = `↳ 02.${String(iterateCoordIndex).padStart(2, "0")}`;
    }

    // At completion: small crimson indicator dot activates
    setTimeout(() => {
      if (iterateCrimsonDot) iterateCrimsonDot.classList.add("is-active");
      nodeIterate?.classList.add("is-resolved");
      nodeIterate?.classList.remove("is-active");
      iterateResetTimer = setTimeout(resetIterate, 4500);
    }, 420);
  }

  /* -------------------------------------------------------------
     GROUP B KINETIC ENGINES
  ------------------------------------------------------------- */

  // 5. CONCEPT: Neon circuit powering up letter by letter -> short crimson neon glow
  let conceptTimeouts = [];
  let conceptResetTimer = null;

  const conceptWord = "CONCEPT";
  function resetConcept() {
    conceptTimeouts.forEach(clearTimeout);
    conceptTimeouts = [];
    if (conceptResetTimer) clearTimeout(conceptResetTimer);
    nodeConcept?.classList.remove("is-active", "is-resolved");
    conceptChars.forEach((c, idx) => {
      c.classList.remove("is-powered", "is-glowing");
      c.textContent = conceptWord[idx] || c.dataset.char;
    });
  }

  function triggerConcept() {
    if (reducedMotion.matches || !conceptChars.length) return;
    if (!canTrigger("concept", 600)) return;
    conceptTimeouts.forEach(clearTimeout);
    conceptTimeouts = [];
    if (conceptResetTimer) clearTimeout(conceptResetTimer);

    nodeConcept?.classList.add("is-active");
    nodeConcept?.classList.remove("is-resolved");

    const stepDelay = 85;
    conceptChars.forEach((charEl, idx) => {
      const t = setTimeout(() => {
        charEl.classList.add("is-powered", "is-glowing");
        setTimeout(() => charEl.classList.remove("is-glowing"), 200);

        if (idx === conceptChars.length - 1) {
          nodeConcept?.classList.add("is-resolved");
          nodeConcept?.classList.remove("is-active");
          conceptResetTimer = setTimeout(resetConcept, 4500);
        }
      }, idx * stepDelay);
      conceptTimeouts.push(t);
    });
  }

  // 6. SYSTEM: Ordered binary grid alignment -> locks character by character into crimson
  let systemInterval = null;
  let systemStep = 0;
  let systemResetTimer = null;
  const systemWord = "SYSTEM";

  function resetSystem() {
    if (systemInterval) clearInterval(systemInterval);
    if (systemResetTimer) clearTimeout(systemResetTimer);
    systemInterval = null;
    systemStep = 0;
    nodeSystem?.classList.remove("is-resolved", "is-active");
    systemSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = (i % 2 === 0 ? "1" : "0");
    });
  }

  function triggerSystem() {
    if (reducedMotion.matches) return;
    if (!canTrigger("system", 600)) return;
    if (systemInterval) clearInterval(systemInterval);
    if (systemResetTimer) clearTimeout(systemResetTimer);

    nodeSystem?.classList.add("is-active");
    systemStep = 0;

    systemInterval = setInterval(() => {
      // Ordered cycle for remaining slots
      for (let i = systemStep; i < systemSlots.length; i++) {
        systemSlots[i].textContent = Math.random() > 0.5 ? "1" : "0";
      }

      // Lock current slot
      if (systemStep < systemSlots.length) {
        const slot = systemSlots[systemStep];
        slot.textContent = systemWord[systemStep];
        slot.classList.add("is-resolved");
        systemStep++;
      } else {
        clearInterval(systemInterval);
        systemInterval = null;
        nodeSystem?.classList.add("is-resolved");
        nodeSystem?.classList.remove("is-active");
        systemResetTimer = setTimeout(resetSystem, 4500);
      }
    }, 100);
  }

  // 7. EXECUTION: Mechanical scan line unmasking segments + checkmark confirmation
  let execResetTimer = null;

  function resetExecution() {
    if (execResetTimer) clearTimeout(execResetTimer);
    nodeExecution?.classList.remove("is-active", "is-resolved");
    execSegments.forEach((seg) => seg.classList.remove("is-unmasked"));
    if (execMarker) execMarker.classList.remove("is-confirmed");
    if (execScanline) execScanline.style.transform = "translateX(-100%)";
  }

  function triggerExecution() {
    if (reducedMotion.matches) return;
    if (!canTrigger("execution", 600)) return;
    if (execResetTimer) clearTimeout(execResetTimer);

    nodeExecution?.classList.add("is-active");
    nodeExecution?.classList.remove("is-resolved");

    // Scan line travels left to right
    if (execScanline) {
      execScanline.animate(
        [
          { transform: "translateX(-100%)", opacity: 0.3 },
          { transform: "translateX(100%)", opacity: 1 },
        ],
        { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)" }
      );
    }

    // Segment reveals
    execSegments.forEach((seg, idx) => {
      setTimeout(() => {
        seg.classList.add("is-unmasked");
      }, idx * 95);
    });

    // Tiny mechanical confirmation at the end
    setTimeout(() => {
      if (execMarker) execMarker.classList.add("is-confirmed");
      nodeExecution?.classList.add("is-resolved");
      nodeExecution?.classList.remove("is-active");
      execResetTimer = setTimeout(resetExecution, 4500);
    }, 320);
  }

  // 8. IMPACT: Visual punch scale 0.8 -> 1.12 -> 1.0 (180-260ms) + crimson flash line
  let impactResetTimer = null;

  function resetImpact() {
    if (impactResetTimer) clearTimeout(impactResetTimer);
    nodeImpact?.classList.remove("is-active", "is-resolved");
    if (impactFlashLine) impactFlashLine.style.transform = "scaleX(0)";
  }

  function triggerImpact() {
    if (reducedMotion.matches) return;
    if (!canTrigger("impact", 450)) return;
    if (impactResetTimer) clearTimeout(impactResetTimer);

    nodeImpact?.classList.add("is-active");

    // Visual punch scale
    nodeImpact?.animate(
      [
        { transform: "scale(0.8)", opacity: 0.5 },
        { transform: "scale(1.14)", opacity: 1, offset: 0.45 },
        { transform: "scale(1.0)", opacity: 1 },
      ],
      { duration: 230, easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)" }
    );

    // Crimson line flash
    if (impactFlashLine) {
      impactFlashLine.animate(
        [
          { transform: "scaleX(0)", opacity: 1, background: "#ffffff" },
          { transform: "scaleX(1.3)", opacity: 1, background: "#ff1230", offset: 0.5 },
          { transform: "scaleX(1.0)", opacity: 0.8, background: "#ff1230" },
        ],
        { duration: 240, easing: "ease-out" }
      );
    }

    setTimeout(() => {
      nodeImpact?.classList.add("is-resolved");
      nodeImpact?.classList.remove("is-active");
      impactResetTimer = setTimeout(resetImpact, 4500);
    }, 240);
  }

  /* -------------------------------------------------------------
     GROUP C: SEQUENTIAL CADENCE & FINAL CHAIN REACTION
  ------------------------------------------------------------- */
  let chainTimeouts = [];
  let isChainRunning = false;

  const chainWords = ["THINK", "SHIP", "BUILD", "IMPROVE"];
  function resetChain() {
    chainTimeouts.forEach(clearTimeout);
    chainTimeouts = [];
    isChainRunning = false;
    chainSteps.forEach((s, idx) => {
      s.classList.remove("is-active", "is-passed");
      const wordEl = s.querySelector(".chain-word");
      if (wordEl) wordEl.textContent = chainWords[idx];
    });
    groupC?.classList.remove("is-active");
  }

  function triggerChainSequence() {
    if (reducedMotion.matches || isChainRunning) return;
    if (!canTrigger("chain-c", 1500)) return;

    isChainRunning = true;
    groupC?.classList.add("is-active");
    chainSteps.forEach((s) => s.classList.remove("is-active", "is-passed"));

    // Step sequence: THINK -> SHIP -> BUILD -> IMPROVE
    const delays = [0, 320, 640, 960];
    chainSteps.forEach((stepEl, idx) => {
      const t = setTimeout(() => {
        // Mark previous steps as passed (retaining slightly higher brightness)
        chainSteps.forEach((prev, pIdx) => {
          if (pIdx < idx) {
            prev.classList.remove("is-active");
            prev.classList.add("is-passed");
          }
        });
        stepEl.classList.add("is-active");

        // When IMPROVE completes: trigger FINAL CHAIN REACTION
        if (idx === chainSteps.length - 1) {
          setTimeout(() => {
            stepEl.classList.remove("is-active");
            stepEl.classList.add("is-passed");
            triggerFinalChainReaction();
          }, 360);
        }
      }, delays[idx]);
      chainTimeouts.push(t);
    });
  }

  // FINAL CHAIN REACTION:
  // 1. Controlled light sweep passes across H1 ("FROM THOUGHT TO FORM")
  // 2. Coordinated "hack reconstruction" terminal glitch across all 3 systems
  // 3. Complete reset of all 3 systems back to dormant gray
  function triggerFinalChainReaction() {
    if (reducedMotion.matches) {
      resetAllSystems();
      return;
    }

    // 1. Subtle illumination sweep travels across H1 letters
    if (heroTitle) {
      heroTitle.classList.remove("h1-light-sweep");
      void heroTitle.offsetWidth; // trigger reflow
      heroTitle.classList.add("h1-light-sweep");
      setTimeout(() => heroTitle.classList.remove("h1-light-sweep"), 700);
    }

    // 2. Coordinated "hack reconstruction" glitch across all 3 systems (~380ms)
    setTimeout(() => {
      element.classList.add("is-glitching-reconstruction");

      // Corrupt characters momentarily into terminal noise
      const glitchChars = ["0", "1", "/", "_", "□", "%", "&", "!", "X", "7"];
      const allTextSlots = element.querySelectorAll(".slot, .circuit-char, .sys-slot, .chain-word");
      const originalTexts = new Map();
      allTextSlots.forEach((slot, i) => {
        originalTexts.set(slot, slot.textContent);
        slot.textContent = glitchChars[i % glitchChars.length];
      });

      // Quick second corruption wave
      setTimeout(() => {
        allTextSlots.forEach((slot, i) => {
          slot.textContent = glitchChars[(i + 4) % glitchChars.length];
        });
      }, 140);

      // 3. Reset everything back to dormant gray state
      setTimeout(() => {
        element.classList.remove("is-glitching-reconstruction");
        resetAllSystems();
      }, 380);
    }, 450);
  }

  function resetAllSystems() {
    resetAnalyze();
    resetDesign();
    resetCompose();
    resetIterate();
    resetConcept();
    resetSystem();
    resetExecution();
    resetImpact();
    resetChain();
  }

  /* -------------------------------------------------------------
     INTERACTION EVENT BINDINGS
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

  const onChainTrigger = (e) => {
    if (e?.pointerType === "touch") return;
    triggerChainSequence();
  };
  groupC?.addEventListener("pointerenter", onChainTrigger, { passive: true });
  groupC?.addEventListener("mouseenter", onChainTrigger, { passive: true });
  groupC?.addEventListener("click", onChainTrigger);

  chainSteps.forEach((step) => {
    step.addEventListener("focus", onChainTrigger);
    step.addEventListener("click", onChainTrigger);
  });

  // Mouse tracking: knight tracking continues uninterrupted!
  // We do NOT stopPropagation, so pointermove bubbles to heroScreen listener.
  hero.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || mobile.matches || event.pointerType === "touch") return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = (event.clientX - bounds.left) / bounds.width - 0.5;
    target.y = (event.clientY - bounds.top) / bounds.height - 0.5;

    // Proximity pre-activation cues (~60px zone)
    const mx = event.clientX;
    const my = event.clientY;
    nodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < 60 && dist > 10) {
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
    for (const anim of element.getAnimations({ subtree: true })) anim.cancel();
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
    get limited() { return limited || mobile.matches; },
    get animating() { return active && !reducedMotion.matches && !document.hidden; },

    setPhase(next) {
      if (!phases[next]) return;
      phase = next;
      element.dataset.phase = next;
    },

    setActive(value) {
      active = value;
      element.dataset.spatial = String(value && !reducedMotion.matches);
      if (!value) settle();
    },

    setAnchor(center, bounds) {
      if (!center || !bounds?.width) return;
      const heroBounds = hero.getBoundingClientRect();
      element.style.setProperty("--knight-axis-x", `${(center.x - heroBounds.left).toFixed(1)}px`);
      element.style.setProperty("--knight-axis-y", `${(center.y - heroBounds.top).toFixed(1)}px`);
    },

    update(timestamp, elapsed) {
      if (!this.animating) return;
      if (startedAt === null) startedAt = timestamp;

      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;

      if (timestamp - lastTextAt < 60) return;
      lastTextAt = timestamp;

      // Parallax offsets in CSS variables
      element.style.setProperty("--environment-x", `${(pointer.x * (this.limited ? 0 : 14)).toFixed(2)}px`);
      element.style.setProperty("--environment-y", `${(pointer.y * (this.limited ? 0 : 10)).toFixed(2)}px`);
    },
  };
}

export const homeEnvironment = createEnvironment();
