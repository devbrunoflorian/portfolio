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
        <circle cx="94" cy="176" r="2.2" />
        <circle cx="507" cy="161" r="1.8" />
        <circle cx="568" cy="123" r="1.8" />
        <circle cx="507" cy="62" r="1.8" />
        <circle cx="320" cy="596" r="2" />
      </g>
    </svg>

    <!-- Technical Text Systems: Loose Spatial Typography (NO GLASS PANELS) -->
    <div class="environment-labels">
      
      <!-- GROUP A: ANALYZE / DESIGN / COMPOSE / ITERATE (Left Module) -->
      <section class="computational-system system-group-a" data-module="a" aria-label="System A: Synthesis">
        <div class="system-bracket" aria-hidden="true">
          <span class="bracket-tag">SYS.01 // SYNTHESIS</span>
          <span class="system-status-indicator"></span>
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

        <!-- 2. DESIGN (Continuous cursive handwriting SVG path) -->
        <div class="system-node node-design" data-kinetic="design" tabindex="0" role="button" aria-label="Design computational node">
          <span class="node-caption">DESIGN</span>
          <div class="design-script-wrap">
            <svg class="design-script-svg" viewBox="0 0 140 48" fill="none">
              <!-- Ordered, continuous cursive pen stroke tracing 'Design' from left to right -->
              <path class="design-script-path" d="M 14,10 C 12,20 11,30 11,35 C 11,37 13,38 16,36 C 22,32 32,19 32,11 C 32,5 24,4 16,6 C 12,7 10,9 10,12 C 10,20 20,35 25,35 C 28,35 31,29 34,23 C 37,17 42,19 41,23 C 40,27 36,35 43,35 C 47,35 50,31 52,25 C 54,19 59,21 59,25 C 59,30 56,35 63,35 C 66,35 69,29 71,23 C 72,18 75,23 74,28 C 73,33 76,35 80,35 C 84,35 87,30 89,24 C 86,20 81,20 81,25 C 81,31 87,32 89,27 C 91,22 91,15 91,25 C 91,35 88,45 83,45 C 79,45 80,40 87,35 C 92,31 96,35 100,35 C 103,35 105,29 106,23 C 107,18 111,23 111,28 C 111,33 115,35 120,35 C 125,35 129,29 133,25" />
              <circle class="design-dot" cx="74" cy="16" r="1.4" fill="currentColor" opacity="0" />
            </svg>
            <span class="design-marker" aria-hidden="true">+</span>
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
  const designPath = element.querySelector(".design-script-path");
  const designDot = element.querySelector(".design-dot");
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
  const impactFlashLine = element.querySelector(".impact-flash-line");

  // DOM node references - Group C
  const groupC = element.querySelector(".system-group-c");
  const chainSteps = Array.from(element.querySelectorAll(".chain-flow .chain-step"));

  // Track persistent activation states (Rule 3 & 23: ACTIVATED STATES REMAIN ACTIVE UNTIL GLOBAL RESET)
  const systemState = {
    analyze: false,
    design: false,
    compose: false,
    iterate: false,
    concept: false,
    system: false,
    execution: false,
    impact: false,
  };

  // Group C independent activation flags (Rule 12 & 13)
  const cadenceState = {
    think: false,
    ship: false,
    build: false,
    improve: false,
  };

  let isCadenceResetting = false;
  let iterateInterval = null;
  let iterateCoordIndex = 4;

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let phase = "structure";
  let active = false;
  let startedAt = null;
  let lastTextAt = 0;
  let limited = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  element.dataset.quality = limited ? "reduced" : "full";

  // Initialize handwriting stroke
  let designPathLength = 380;
  if (designPath) {
    try {
      designPathLength = Math.ceil(designPath.getTotalLength()) || 380;
    } catch {
      designPathLength = 380;
    }
    designPath.style.strokeDasharray = `${designPathLength}`;
    designPath.style.strokeDashoffset = `${designPathLength}`;
  }
  if (iterateLoopPath) {
    iterateLoopPath.style.strokeDasharray = "64";
    iterateLoopPath.style.strokeDashoffset = "64";
  }

  /* -------------------------------------------------------------
     GROUP A KINETIC ENGINES (PERSISTENT ACTIVATION)
  ------------------------------------------------------------- */

  // 1. ANALYZE: Single line slot-by-slot binary search -> locks in crimson
  let analyzeInterval = null;
  const analyzeWord = "ANALYZE";

  function triggerAnalyze() {
    if (reducedMotion.matches || systemState.analyze) return;

    nodeAnalyze?.classList.add("is-active");
    groupA?.classList.add("has-active");

    let resolvedCount = 0;
    const slotCycleInterval = setInterval(() => {
      // Rapid cycling for unresolved slots
      for (let i = resolvedCount; i < analyzeSlots.length; i++) {
        analyzeSlots[i].textContent = Math.random() > 0.5 ? "1" : "0";
      }
    }, 45);

    analyzeInterval = setInterval(() => {
      if (resolvedCount < analyzeSlots.length) {
        const slot = analyzeSlots[resolvedCount];
        slot.textContent = analyzeWord[resolvedCount];
        slot.classList.add("is-resolved");
        resolvedCount++;
      } else {
        clearInterval(slotCycleInterval);
        clearInterval(analyzeInterval);
        analyzeInterval = null;
        systemState.analyze = true;
        nodeAnalyze?.classList.add("is-resolved");
        nodeAnalyze?.classList.remove("is-active");
        // PERSISTENT: stays resolved in crimson until global reset
      }
    }, 140);
  }

  // 2. DESIGN: Genuine continuous cursive SVG handwriting stroke left-to-right
  let designAnim = null;

  function triggerDesign() {
    if (reducedMotion.matches || systemState.design || !designPath) return;

    nodeDesign?.classList.add("is-active");
    groupA?.classList.add("has-active");
    designPath.style.opacity = "1";

    if (designAnim) designAnim.cancel();
    designAnim = designPath.animate(
      [
        { strokeDashoffset: `${designPathLength}` },
        { strokeDashoffset: "0" },
      ],
      { duration: 1150, easing: "cubic-bezier(0.35, 0, 0.25, 1)", fill: "forwards" }
    );

    designAnim.onfinish = () => {
      systemState.design = true;
      nodeDesign?.classList.add("is-drawn");
      nodeDesign?.classList.remove("is-active");
      if (designDot) designDot.style.opacity = "1";
      if (designMarker) {
        designMarker.classList.add("is-flashing");
        designMarker.animate(
          [
            { transform: "scale(1.8)", color: "#ffffff", opacity: 1 },
            { transform: "scale(1.0)", color: "#ff1230", opacity: 0.9 },
          ],
          { duration: 240, easing: "ease-out" }
        );
      }
      // PERSISTENT: stays drawn until global reset
    };
  }

  // 3. COMPOSE: Weighted architectural drop assembling letters -> turns crimson on landing
  function triggerCompose() {
    if (reducedMotion.matches || systemState.compose || !composeLetters.length) return;

    nodeCompose?.classList.add("is-active");
    groupA?.classList.add("has-active");

    composeLetters.forEach((letter) => {
      letter.style.transform = "translateY(-12px)";
      letter.style.opacity = "0.25";
    });

    const stepDelay = 75;
    composeLetters.forEach((letter, index) => {
      setTimeout(() => {
        letter.style.transform = "translateY(0)";
        letter.style.opacity = "1";

        if (index === composeLetters.length - 1) {
          systemState.compose = true;
          nodeCompose?.classList.add("is-resolved");
          nodeCompose?.classList.remove("is-active");

          // When COMPOSE lands, displace ITERATE downward and start its process!
          triggerIterateDisplaced();
          // PERSISTENT: stays dropped in crimson until global reset
        }
      }, index * stepDelay);
    });
  }

  // 4. ITERATE: Physically connected to COMPOSE, continuous subtle cyclic loop
  function triggerIterateDisplaced() {
    nodeIterate?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(5px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
    );
    startIterateLoop();
  }

  function startIterateLoop() {
    if (systemState.iterate) return;
    systemState.iterate = true;
    groupA?.classList.add("has-active");
    nodeIterate?.classList.add("is-looping", "is-resolved");
    if (iterateCrimsonDot) iterateCrimsonDot.classList.add("is-active");

    function runCycle() {
      if (!systemState.iterate || isCadenceResetting) return;

      // Coordinate increments subtly
      iterateCoordIndex++;
      if (iterateCoordIndex > 12) iterateCoordIndex = 4;
      if (iterateCoord) {
        iterateCoord.textContent = `↳ 02.${String(iterateCoordIndex).padStart(2, "0")}`;
      }

      // Loop trace draws
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
    // PERSISTENT: continues looping subtly until global reset
  }

  /* -------------------------------------------------------------
     GROUP B KINETIC ENGINES (PERSISTENT ACTIVATION)
  ------------------------------------------------------------- */

  // 5. CONCEPT: Neon circuit power-up letter by letter
  function triggerConcept() {
    if (reducedMotion.matches || systemState.concept || !conceptChars.length) return;

    nodeConcept?.classList.add("is-active");
    groupB?.classList.add("has-active");

    const stepDelay = 90;
    conceptChars.forEach((charEl, idx) => {
      setTimeout(() => {
        charEl.classList.add("is-powered", "is-glowing");
        setTimeout(() => charEl.classList.remove("is-glowing"), 180);

        if (idx === conceptChars.length - 1) {
          systemState.concept = true;
          nodeConcept?.classList.add("is-resolved");
          nodeConcept?.classList.remove("is-active");
          // PERSISTENT: stays powered on until global reset
        }
      }, idx * stepDelay);
    });
  }

  // 6. SYSTEM: Ordered binary grid resolution -> locks in crimson
  let systemInterval = null;
  const systemWord = "SYSTEM";

  function triggerSystem() {
    if (reducedMotion.matches || systemState.system) return;

    nodeSystem?.classList.add("is-active");
    groupB?.classList.add("has-active");

    let resolvedCount = 0;
    const cycleInterval = setInterval(() => {
      for (let i = resolvedCount; i < systemSlots.length; i++) {
        systemSlots[i].textContent = Math.random() > 0.5 ? "1" : "0";
      }
    }, 50);

    systemInterval = setInterval(() => {
      if (resolvedCount < systemSlots.length) {
        const slot = systemSlots[resolvedCount];
        slot.textContent = systemWord[resolvedCount];
        slot.classList.add("is-resolved");
        resolvedCount++;
      } else {
        clearInterval(cycleInterval);
        clearInterval(systemInterval);
        systemInterval = null;
        systemState.system = true;
        nodeSystem?.classList.add("is-resolved");
        nodeSystem?.classList.remove("is-active");
        // PERSISTENT: stays resolved in crimson until global reset
      }
    }, 130);
  }

  // 7. EXECUTION: Mechanical scan line unmasking segments + checkmark confirmation
  function triggerExecution() {
    if (reducedMotion.matches || systemState.execution) return;

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

    execSegments.forEach((seg, idx) => {
      setTimeout(() => seg.classList.add("is-unmasked"), idx * 95);
    });

    setTimeout(() => {
      if (execMarker) execMarker.classList.add("is-confirmed");
      systemState.execution = true;
      nodeExecution?.classList.add("is-resolved");
      nodeExecution?.classList.remove("is-active");
      // PERSISTENT: stays completed with silver text and crimson 01 ✓ until global reset
    }, 320);
  }

  // 8. IMPACT: Punch scale 0.82 -> 1.12 -> 1.0 (210ms) + crimson impulse
  function triggerImpact() {
    if (reducedMotion.matches || systemState.impact) return;

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
      systemState.impact = true;
      nodeImpact?.classList.add("is-resolved");
      nodeImpact?.classList.remove("is-active");
      // PERSISTENT: stays active and slightly larger until global reset
    }, 210);
  }

  /* -------------------------------------------------------------
     GROUP C: INDIVIDUAL ACTIVATION & FINAL GLOBAL CONDITION
  ------------------------------------------------------------- */
  function activateCadenceStep(stepName) {
    if (reducedMotion.matches || isCadenceResetting || cadenceState[stepName]) return;

    cadenceState[stepName] = true;
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

    // FINAL CONDITION (Rules 13 & 14): Triggers ONLY when all four equal true!
    if (cadenceState.think && cadenceState.ship && cadenceState.build && cadenceState.improve) {
      setTimeout(triggerGlobalCompletionEffect, 320);
    }
  }

  // 14 & 15. GLOBAL COMPLETION: H1 Specular Sweep + Coordinated Hack Reset
  function triggerGlobalCompletionEffect() {
    if (isCadenceResetting) return;
    isCadenceResetting = true;

    // 1. Narrow specular light sweep constrained strictly inside the glyph shapes (Rule 14)
    if (heroTitle) {
      heroTitle.classList.remove("h1-specular-sweep");
      void heroTitle.offsetWidth; // trigger reflow
      heroTitle.classList.add("h1-specular-sweep");
      setTimeout(() => heroTitle.classList.remove("h1-specular-sweep"), 700);
    }

    // 2. Coordinated hack glitch across technical systems (Rule 15, ~350ms)
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

      // 3. Clear all persistent states and return all systems to dormant gray
      setTimeout(() => {
        element.classList.remove("is-glitching-reconstruction");
        resetAllSystems();
        isCadenceResetting = false;
      }, 350);
    }, 480);
  }

  function resetAllSystems() {
    // Clear persistent flags
    Object.keys(systemState).forEach((key) => { systemState[key] = false; });
    Object.keys(cadenceState).forEach((key) => { cadenceState[key] = false; });

    if (iterateInterval) clearInterval(iterateInterval);
    iterateInterval = null;

    groupA?.classList.remove("has-active");
    groupB?.classList.remove("has-active");
    groupC?.classList.remove("has-active");

    // Reset ANALYZE
    nodeAnalyze?.classList.remove("is-resolved", "is-active");
    analyzeSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = (i % 2 === 0 ? "0" : "1");
    });

    // Reset DESIGN
    if (designAnim) designAnim.cancel();
    nodeDesign?.classList.remove("is-drawn", "is-active");
    if (designPath) {
      designPath.style.strokeDashoffset = `${designPathLength}`;
      designPath.style.opacity = "0";
    }
    if (designDot) designDot.style.opacity = "0";
    if (designMarker) designMarker.classList.remove("is-flashing");

    // Reset COMPOSE
    nodeCompose?.classList.remove("is-resolved", "is-active");
    composeLetters.forEach((letter) => {
      letter.style.transform = "";
      letter.style.opacity = "";
    });

    // Reset ITERATE
    nodeIterate?.classList.remove("is-looping", "is-resolved", "is-active");
    if (iterateCrimsonDot) iterateCrimsonDot.classList.remove("is-active");
    if (iterateLoopPath) iterateLoopPath.style.strokeDashoffset = "64";
    if (iterateCoord) iterateCoord.textContent = "↳ 02.04";

    // Reset CONCEPT
    nodeConcept?.classList.remove("is-resolved", "is-active");
    const conceptWord = "CONCEPT";
    conceptChars.forEach((c, idx) => {
      c.classList.remove("is-powered", "is-glowing");
      c.textContent = conceptWord[idx];
    });

    // Reset SYSTEM
    nodeSystem?.classList.remove("is-resolved", "is-active");
    systemSlots.forEach((slot, i) => {
      slot.classList.remove("is-resolved");
      slot.textContent = (i % 2 === 0 ? "1" : "0");
    });

    // Reset EXECUTION
    nodeExecution?.classList.remove("is-resolved", "is-active");
    execSegments.forEach((seg) => seg.classList.remove("is-unmasked"));
    if (execMarker) execMarker.classList.remove("is-confirmed");
    if (execScanline) execScanline.style.transform = "translateX(-100%)";

    // Reset IMPACT
    nodeImpact?.classList.remove("is-resolved", "is-active");
    if (impactFlashLine) impactFlashLine.style.transform = "scaleX(0)";

    // Reset GROUP C
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
      case "iterate": startIterateLoop(); break;
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
