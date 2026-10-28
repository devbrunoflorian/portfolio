const hero = document.querySelector(".hero-screen");
const frame = document.querySelector("#scene-frame");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobile = matchMedia("(max-width: 640px)");
const debug = new URLSearchParams(location.search).has("knight-debug");

const phases = {
  idea: { interval: 7000, signalRate: 1.0, coherence: 0.35 },
  structure: { interval: 9500, signalRate: 0.75, coherence: 0.75 },
  form: { interval: 14000, signalRate: 0.4, coherence: 1.0 },
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
      <!-- Secondary architectural guides -->
      <g class="construction-secondary">
        <path d="M35 108H582V602H96V176H538M0 350H640M320 24V676M94 70V620M546 62V644M30 530H609M158 96H603M46 594H568" />
        <circle cx="320" cy="350" r="246" />
        <path d="M98 501A270 270 0 0 1 496 135M122 542A270 270 0 0 0 576 292" />
      </g>

      <!-- Primary construction geometry: concentric circles, golden ratio spiral & rectangles -->
      <g class="construction-primary">
        <circle cx="320" cy="350" r="205" />
        <path d="M320 104V123M320 577V596M74 350H93M547 350H566M143 173l14 14M483 513l14 14M143 527l14-14M483 187l14-14" />
        <!-- Nested Fibonacci / Golden Ratio Rectangles -->
        <path d="M 408 62 H 568 V 161 H 408 Z M 507 62 V 161 M 507 123 H 568 M 545 123 V 161 M 545 147 H 568" />
        <!-- Fibonacci Golden Spiral -->
        <path class="spiral-path" d="${goldenSpiralPath()}" />
      </g>

      <!-- Measurement ticks -->
      <g class="construction-ticks">
        ${Array.from({ length: 17 }, (_, i) => `<path d="M${112 + i * 26} 608v${i % 4 ? 4 : 9}"/>`).join("")}
        <path d="M100 608H540M100 604v16M540 604v16" />
      </g>

      <!-- Crimson anchor points & intersection markers -->
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

    <!-- Section 6: Technical Text System (Interactive Kinetic Micro-Interface) -->
    <div class="environment-labels">
      <!-- ANALYZE group: binary decode cascade -->
      <div class="technical-label label-analyze" data-kinetic="analyze" tabindex="0" role="button" aria-label="Analyze technical node">
        <span class="technical-caption">ANALYZE</span>
        <div class="analyze-stack">
          <span class="bin-line bin-1">0100110</span>
          <span class="bin-line bin-2">0101011</span>
          <span class="bin-corrupt">ANA1YZE</span>
          <span class="bin-resolved">ANALYZE</span>
        </div>
      </div>

      <!-- DESIGN: handwriting script reveal with crosshair -->
      <div class="technical-label label-design" data-kinetic="design" tabindex="0" role="button" aria-label="Design technical node">
        <span class="technical-caption">DESIGN</span>
        <div class="design-row">
          <svg viewBox="0 0 155 52" fill="none">
            <path data-handwriting d="M12 40Q23 20 32 8M9 18Q31-2 48 10Q65 28 27 41Q9 46 12 38M48 32Q70 18 61 21Q47 24 49 34Q53 41 70 29M78 22Q64 24 74 30Q86 34 68 38M88 25l-7 12 12-7M91 18l1-2M107 25Q102 19 94 30Q91 40 103 31L110 24Q98 56 88 46Q84 40 110 32M114 25l-6 12Q126 15 124 28l-3 9 15-11M15 47Q68 39 143 39" />
          </svg>
          <span class="design-cross" aria-hidden="true">+</span>
        </div>
      </div>

      <!-- BUILD: sequential structural assemble -->
      <div class="technical-label label-build" data-kinetic="build" tabindex="0" role="button" aria-label="Build technical node">
        <span class="technical-caption">BUILD</span>
        <div class="build-assembly">
          <span class="build-step" data-step="0">B</span>
          <span class="build-step" data-step="1">BU</span>
          <span class="build-step" data-step="2">BUI</span>
          <span class="build-step" data-step="3">BUIL</span>
          <span class="build-resolved" data-step="4">BUILD</span>
        </div>
      </div>

      <!-- ITERATE: track bar and coordinate metadata -->
      <div class="technical-label label-iterate" data-kinetic="iterate" tabindex="0" role="button" aria-label="Iterate technical node">
        <span class="iterate-title">ITERATE</span>
        <div class="iterate-bar">
          <span class="iterate-track"></span>
          <small class="iterate-coord">↳ 02.04 / 02.05</small>
        </div>
      </div>

      <!-- Right side supporting words column -->
      <div class="technical-label label-side-group">
        <span class="side-item" data-kinetic="system" tabindex="0" role="button" aria-label="System technical node">SYSTEM</span>
        <span class="side-item" data-kinetic="execution" tabindex="0" role="button" aria-label="Execution technical node">EXECUTION</span>
      </div>
      
      <!-- IMPACT: decisive appearance with coordinate marker -->
      <div class="technical-label label-impact" data-kinetic="impact" tabindex="0" role="button" aria-label="Impact technical node">
        <span class="impact-guide"></span>
        <span class="impact-word">IMPACT</span>
      </div>

      <!-- Lower supporting group: THINK, SYSTEM, EXECUTION, IMPROVE -->
      <div class="environment-lower">
        <div class="lower-item" data-kinetic="think" tabindex="0" role="button" aria-label="Think technical node">
          <span class="lower-marker"></span>
          <span class="lower-word">THINK</span>
        </div>
        <div class="lower-item" data-kinetic="system" tabindex="0" role="button" aria-label="System technical node">
          <span class="lower-marker"></span>
          <span class="lower-word">SYSTEM</span>
        </div>
        <div class="lower-item" data-kinetic="execution" tabindex="0" role="button" aria-label="Execution technical node">
          <span class="lower-marker"></span>
          <span class="lower-word">EXECUTION</span>
        </div>
        <div class="lower-item" data-kinetic="improve" tabindex="0" role="button" aria-label="Improve technical node">
          <span class="lower-marker"></span>
          <span class="lower-word">IMPROVE</span>
        </div>
      </div>
    </div>`;

  hero.prepend(element);
  hero.classList.add("has-environment");

  // DOM node references
  const handwriting = element.querySelector("[data-handwriting]");
  const designCross = element.querySelector(".design-cross");
  const analyzeLabel = element.querySelector(".label-analyze");
  const binResolved = element.querySelector(".bin-resolved");
  const binLines = element.querySelectorAll(".bin-line");
  const binCorrupt = element.querySelector(".bin-corrupt");
  const buildSteps = element.querySelectorAll(".build-step, .build-resolved");
  const iterateLabel = element.querySelector(".label-iterate");
  const iterateTrack = element.querySelector(".iterate-track");
  const iterateCoord = element.querySelector(".iterate-coord");
  const impactLabel = element.querySelector(".label-impact");
  const impactWord = element.querySelector(".impact-word");
  const impactGuide = element.querySelector(".impact-guide");

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let phase = "structure";
  let active = false;
  let startedAt = null;
  let lastTextAt = 0;
  let nextAmbientAt = 7500;
  let ambientIndex = 0;
  let slowFrames = 0;
  let limited = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  element.dataset.quality = limited ? "reduced" : "full";

  // Initialize handwriting stroke
  if (handwriting) {
    handwriting.style.strokeDasharray = "420";
    handwriting.style.strokeDashoffset = "0";
  }

  // Cooldown tracker for hover interactions (prevent frantic retriggering)
  const lastTriggered = new Map();
  function canTrigger(id, cooldown = 450) {
    const now = performance.now();
    const last = lastTriggered.get(id) || 0;
    if (now - last < cooldown) return false;
    lastTriggered.set(id, now);
    return true;
  }

  /* -------------------------------------------------------------
     KINETIC LABEL ENGINES
  ------------------------------------------------------------- */

  // 1. ANALYZE: Binary / Corrupted Computational Decode
  let analyzeTimer = null;
  function triggerAnalyze(isHover = false) {
    if (reducedMotion.matches) return;
    if (isHover && !canTrigger("analyze", 500)) return;
    if (analyzeTimer) clearInterval(analyzeTimer);

    analyzeLabel?.classList.add("is-active");
    const decodeFrames = [
      { res: "0101101", c: "0100110", b1: "0110101", b2: "1010011" },
      { res: "A10L01E", c: "0101011", b1: "1101010", b2: "0101101" },
      { res: "A10LY1E", c: "ANA1011", b1: "0100110", b2: "0101011" },
      { res: "ANA1YZE", c: "ANA1YZE", b1: "0100110", b2: "0101011" },
      { res: "ANALYZE", c: "ANA1YZE", b1: "0100110", b2: "0101011" },
    ];

    let step = 0;
    analyzeTimer = setInterval(() => {
      const f = decodeFrames[step];
      if (!f) {
        clearInterval(analyzeTimer);
        analyzeTimer = null;
        if (binResolved) binResolved.textContent = "ANALYZE";
        analyzeLabel?.classList.remove("is-active");
        return;
      }
      if (binResolved) binResolved.textContent = f.res;
      if (binCorrupt) binCorrupt.textContent = f.c;
      if (binLines[0]) binLines[0].textContent = f.b1;
      if (binLines[1]) binLines[1].textContent = f.b2;
      step++;
    }, 130);
  }

  // 2. DESIGN: Handwritten Cursive Script with Drawing Animation
  let designAnim = null;
  function triggerDesign(isHover = false) {
    if (reducedMotion.matches || !handwriting) return;
    if (isHover && !canTrigger("design", 600)) return;

    if (designAnim) designAnim.cancel();
    element.querySelector(".label-design")?.classList.add("is-active");

    const startOffset = isHover ? "260" : "420";
    designAnim = handwriting.animate(
      [
        { strokeDashoffset: startOffset, opacity: 0.5 },
        { strokeDashoffset: "0", opacity: 1 },
      ],
      { duration: isHover ? 700 : 950, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)" }
    );

    designAnim.onfinish = () => {
      element.querySelector(".label-design")?.classList.remove("is-active");
      if (designCross) {
        designCross.animate(
          [
            { transform: "scale(1.8)", color: "#ffffff" },
            { transform: "scale(1.0)", color: "#e52b3d" },
          ],
          { duration: 240, easing: "ease-out" }
        );
      }
    };
  }

  // 3. BUILD: Structural Assembly with Alignment Snaps
  let buildTimeouts = [];
  function triggerBuild(isHover = false) {
    if (reducedMotion.matches || !buildSteps.length) return;
    if (isHover && !canTrigger("build", 550)) return;

    buildTimeouts.forEach(clearTimeout);
    buildTimeouts = [];

    const label = element.querySelector(".label-build");
    label?.classList.add("is-active");

    // Hide steps initially during rebuild
    buildSteps.forEach((s) => {
      s.classList.remove("is-assembled", "is-focused");
      s.style.opacity = "0.15";
      s.style.transform = "translateY(3px)";
    });

    const stepDelay = isHover ? 90 : 120;
    buildSteps.forEach((stepEl, idx) => {
      const t = setTimeout(() => {
        buildSteps.forEach((prev, pIdx) => {
          if (pIdx < idx) {
            prev.classList.remove("is-focused");
            prev.style.opacity = "0.32";
          }
        });
        stepEl.classList.add("is-assembled", "is-focused");
        stepEl.style.opacity = "1";
        stepEl.style.transform = "translateY(0)";

        if (idx === buildSteps.length - 1) {
          stepEl.animate(
            [
              { transform: "scale(1.08)", color: "#ffffff" },
              { transform: "scale(1.0)", color: "#e52b3d" },
            ],
            { duration: 220, easing: "ease-out" }
          );
          setTimeout(() => label?.classList.remove("is-active"), 300);
        }
      }, idx * stepDelay);
      buildTimeouts.push(t);
    });
  }

  // 4. ITERATE: Process Continuation & Progress Tick
  function triggerIterate(isHover = false) {
    if (reducedMotion.matches) return;
    if (isHover && !canTrigger("iterate", 400)) return;

    iterateLabel?.classList.add("is-active");
    const trackAnim = iterateTrack?.animate(
      [
        { width: "12px", background: "#e52b3d" },
        { width: "54px", background: "#ffffff", offset: 0.5 },
        { width: "44px", background: "linear-gradient(90deg, #e52b3d 0% 30%, rgba(120, 120, 120, 0.26) 30%)" },
      ],
      { duration: 380, easing: "ease-out" }
    );

    iterateLabel?.animate(
      [
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)", offset: 0.4 },
        { transform: "none" },
      ],
      { duration: 260, easing: "ease-out" }
    );

    if (iterateCoord) {
      const patch = (Math.random() > 0.5 ? "06" : "07");
      iterateCoord.textContent = `↳ 02.05 / 02.${patch}`;
    }

    trackAnim?.addEventListener("finish", () => {
      iterateLabel?.classList.remove("is-active");
    });
  }

  // 5. IMPACT: Abrupt, Decisive Appearance
  function triggerImpact(isHover = false) {
    if (reducedMotion.matches) return;
    if (isHover && !canTrigger("impact", 350)) return;

    impactLabel?.classList.add("is-active");
    impactWord?.animate(
      [
        { opacity: 0.2, transform: "translateX(-4px)", clipPath: "inset(0 60% 0 0)" },
        { opacity: 1, transform: "none", clipPath: "inset(0 0% 0 0)" },
      ],
      { duration: 120, easing: "steps(2, end)" }
    );

    impactGuide?.animate(
      [
        { background: "#ffffff", width: "42px" },
        { background: "linear-gradient(90deg, rgba(229, 43, 61, 0.95), rgba(180, 180, 180, 0.2))", width: "32px" },
      ],
      { duration: 220, easing: "ease-out" }
    );

    setTimeout(() => impactLabel?.classList.remove("is-active"), 220);
  }

  // 6. THINK: Emerging from Uncertainty into Clarity
  function triggerThink(targetEl, isHover = false) {
    if (reducedMotion.matches || !targetEl) return;
    if (isHover && !canTrigger("think", 450)) return;

    const wordEl = targetEl.querySelector(".lower-word") || targetEl;
    targetEl.classList.add("is-active");

    wordEl.animate(
      [
        { opacity: 0.18, letterSpacing: "0.48em", filter: "blur(2px)", transform: "translateY(2px)" },
        { opacity: 0.70, letterSpacing: "0.30em", filter: "blur(0.8px)", offset: 0.6 },
        { opacity: 1.0, letterSpacing: "0.22em", filter: "blur(0)", transform: "translateY(0)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    ).onfinish = () => targetEl.classList.remove("is-active");
  }

  // 7. SYSTEM: Structural Grid Alignment
  function triggerSystem(targetEl, isHover = false) {
    if (reducedMotion.matches || !targetEl) return;
    if (isHover && !canTrigger("system", 450)) return;

    const wordEl = targetEl.querySelector(".lower-word") || targetEl;
    targetEl.classList.add("is-active");

    wordEl.animate(
      [
        { letterSpacing: "0.55em", transform: "scaleX(0.92)", opacity: 0.55 },
        { letterSpacing: "0.18em", transform: "scaleX(1.03)", opacity: 0.95, offset: 0.75 },
        { letterSpacing: "0.22em", transform: "scaleX(1.0)", opacity: 1.0 },
      ],
      { duration: 380, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
    ).onfinish = () => targetEl.classList.remove("is-active");
  }

  // 8. EXECUTION: Mechanical Segmented Reveal
  function triggerExecution(targetEl, isHover = false) {
    if (reducedMotion.matches || !targetEl) return;
    if (isHover && !canTrigger("execution", 450)) return;

    const wordEl = targetEl.querySelector(".lower-word") || targetEl;
    targetEl.classList.add("is-active");

    wordEl.animate(
      [
        { clipPath: "inset(0 100% 0 0)", transform: "translateX(5px)", opacity: 0.4 },
        { clipPath: "inset(0 50% 0 0)", transform: "translateX(2px)", opacity: 0.8, offset: 0.45 },
        { clipPath: "inset(0 0% 0 0)", transform: "none", opacity: 1.0 },
      ],
      { duration: 320, easing: "steps(3, jump-none)" }
    ).onfinish = () => targetEl.classList.remove("is-active");
  }

  // 9. IMPROVE: Progressive Refinement & Clarification
  function triggerImprove(targetEl, isHover = false) {
    if (reducedMotion.matches || !targetEl) return;
    if (isHover && !canTrigger("improve", 450)) return;

    const wordEl = targetEl.querySelector(".lower-word") || targetEl;
    targetEl.classList.add("is-active");

    wordEl.animate(
      [
        { opacity: 0.25, filter: "blur(1.4px)", letterSpacing: "0.28em" },
        { opacity: 0.65, filter: "blur(0.5px)", offset: 0.5 },
        { opacity: 1.0, filter: "blur(0)", letterSpacing: "0.22em" },
      ],
      { duration: 520, easing: "ease-out" }
    ).onfinish = () => targetEl.classList.remove("is-active");
  }

  // Unified dispatcher for kinetic events
  function dispatchKinetic(name, targetEl, isHover = false) {
    switch (name) {
      case "analyze": triggerAnalyze(isHover); break;
      case "design": triggerDesign(isHover); break;
      case "build": triggerBuild(isHover); break;
      case "iterate": triggerIterate(isHover); break;
      case "impact": triggerImpact(isHover); break;
      case "think": triggerThink(targetEl, isHover); break;
      case "system": triggerSystem(targetEl, isHover); break;
      case "execution": triggerExecution(targetEl, isHover); break;
      case "improve": triggerImprove(targetEl, isHover); break;
    }
  }

  /* -------------------------------------------------------------
     POINTER HOVER & PROXIMITY INTERACTION
  ------------------------------------------------------------- */
  const interactiveNodes = element.querySelectorAll("[data-kinetic]");

  interactiveNodes.forEach((node) => {
    const kind = node.dataset.kinetic;

    // Direct pointerenter trigger with instantaneous response
    node.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" || e.pointerType === "pen") {
        dispatchKinetic(kind, node, true);
      }
    }, { passive: true });

    // Keyboard accessibility trigger
    node.addEventListener("focus", () => {
      dispatchKinetic(kind, node, true);
    });
  });

  // Mouse tracking for parallax and distance proximity
  hero.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || mobile.matches || event.pointerType !== "mouse") return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = (event.clientX - bounds.left) / bounds.width - 0.5;
    target.y = (event.clientY - bounds.top) / bounds.height - 0.5;

    // Optional proximity effect: detect approaching pointer within ~65px
    const mx = event.clientX;
    const my = event.clientY;
    interactiveNodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < 65 && dist > 15) {
        node.classList.add("is-proximate");
      } else {
        node.classList.remove("is-proximate");
      }
    });
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    target.x = 0;
    target.y = 0;
    interactiveNodes.forEach((node) => node.classList.remove("is-proximate"));
  });

  function settle() {
    for (const anim of element.getAnimations({ subtree: true })) anim.cancel();
    pointer.x = pointer.y = target.x = target.y = 0;
    element.style.setProperty("--environment-x", "0px");
    element.style.setProperty("--environment-y", "0px");
    if (binResolved) binResolved.textContent = "ANALYZE";
    if (handwriting) handwriting.style.strokeDashoffset = "0";
    buildSteps.forEach((s) => {
      s.style.opacity = "";
      s.style.transform = "";
    });
  }

  reducedMotion.addEventListener("change", settle);
  mobile.addEventListener("change", settle);

  // Initial reveal sequence on first load (staggered from right to left, top to bottom)
  setTimeout(() => {
    triggerAnalyze(false);
    triggerDesign(false);
    triggerBuild(false);
  }, 350);

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
      const time = timestamp - startedAt;

      // Handle sustained slow frames
      slowFrames = elapsed > 45 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 90 && !limited) {
        limited = true;
        element.dataset.quality = "reduced";
      }

      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;

      if (timestamp - lastTextAt < 60) return;
      lastTextAt = timestamp;

      // Parallax offsets in CSS variables
      element.style.setProperty("--environment-x", `${(pointer.x * (this.limited ? 0 : 14)).toFixed(2)}px`);
      element.style.setProperty("--environment-y", `${(pointer.y * (this.limited ? 0 : 10)).toFixed(2)}px`);

      // GLOBAL AMBIENT IDLE RECONSTRUCTION CYCLE
      // Triggers one or two labels at calm, irregular intervals (7 to 11s)
      if (time >= nextAmbientAt) {
        const scheduleOrder = [
          { name: "iterate", el: iterateLabel },
          { name: "system", el: element.querySelector(".side-item[data-kinetic='system']") },
          { name: "analyze", el: analyzeLabel },
          { name: "execution", el: element.querySelector(".side-item[data-kinetic='execution']") },
          { name: "design", el: element.querySelector(".label-design") },
          { name: "impact", el: impactLabel },
          { name: "build", el: element.querySelector(".label-build") },
          { name: "think", el: element.querySelector(".lower-item[data-kinetic='think']") },
          { name: "improve", el: element.querySelector(".lower-item[data-kinetic='improve']") },
        ];

        const candidate = scheduleOrder[ambientIndex % scheduleOrder.length];
        ambientIndex++;
        if (candidate?.el) {
          dispatchKinetic(candidate.name, candidate.el, false);
        }

        const interval = phases[phase].interval;
        const jitter = (Math.sin(time) * 0.2 + 0.9);
        nextAmbientAt = time + interval * jitter;
      }
    },
  };
}

export const homeEnvironment = createEnvironment();
