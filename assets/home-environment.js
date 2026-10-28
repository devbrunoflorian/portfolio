const hero = document.querySelector(".hero-screen");
const frame = document.querySelector("#scene-frame");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobile = matchMedia("(max-width: 640px)");
const debug = new URLSearchParams(location.search).has("knight-debug");

const phases = {
  idea: { interval: 11500, signalRate: 1.0, coherence: 0.35 },
  structure: { interval: 17500, signalRate: 0.75, coherence: 0.75 },
  form: { interval: 29000, signalRate: 0.4, coherence: 1.0 },
};

function goldenSpiralPath() {
  // Smooth, mathematically authentic logarithmic spiral expanding through golden rectangles
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

    <!-- Section 6: Technical Text System -->
    <div class="environment-labels">
      <!-- ANALYZE group: binary decode cascade -->
      <div class="technical-label label-analyze">
        <span class="technical-caption">ANALYZE</span>
        <div class="analyze-stack">
          <span class="bin-line">0100110</span>
          <span class="bin-line">0101011</span>
          <span class="bin-corrupt">ANA1YZE</span>
          <span class="bin-resolved" data-word="ANALYZE" data-effect="binary">ANALYZE</span>
        </div>
      </div>

      <!-- DESIGN: handwriting script reveal with crosshair -->
      <div class="technical-label label-design">
        <span class="technical-caption">DESIGN</span>
        <div class="design-row">
          <svg viewBox="0 0 155 52" fill="none">
            <path data-handwriting d="M12 40Q23 20 32 8M9 18Q31-2 48 10Q65 28 27 41Q9 46 12 38M48 32Q70 18 61 21Q47 24 49 34Q53 41 70 29M78 22Q64 24 74 30Q86 34 68 38M88 25l-7 12 12-7M91 18l1-2M107 25Q102 19 94 30Q91 40 103 31L110 24Q98 56 88 46Q84 40 110 32M114 25l-6 12Q126 15 124 28l-3 9 15-11M15 47Q68 39 143 39" />
          </svg>
          <span class="design-cross" aria-hidden="true">+</span>
        </div>
      </div>

      <!-- BUILD: sequential structural assemble -->
      <div class="technical-label label-build">
        <span class="technical-caption">BUILD</span>
        <div class="build-assembly">
          <span class="build-step">B</span>
          <span class="build-step">BU</span>
          <span class="build-step">BUI</span>
          <span class="build-step">BUIL</span>
          <span class="build-resolved" data-word="BUILD" data-effect="build">BUILD</span>
        </div>
      </div>

      <!-- ITERATE: track bar and coordinate metadata -->
      <div class="technical-label label-iterate">
        <span class="iterate-title" data-word="ITERATE" data-effect="glitch">ITERATE</span>
        <div class="iterate-bar">
          <span class="iterate-track"></span>
          <small class="iterate-coord">↳ 02.04 / 02.05</small>
        </div>
      </div>

      <!-- Right side supporting words column -->
      <div class="technical-label label-side-group">
        <span class="side-item" data-word="SYSTEM" data-effect="mask">SYSTEM</span>
        <span class="side-item" data-word="EXECUTION" data-effect="slide">EXECUTION</span>
      </div>
      
      <!-- IMPACT: decisive appearance with coordinate marker -->
      <div class="technical-label label-impact">
        <span class="impact-guide"></span>
        <span data-word="IMPACT" data-effect="impact">IMPACT</span>
      </div>

      <!-- Lower supporting group: THINK, SYSTEM, EXECUTION, IMPROVE -->
      <div class="environment-lower">
        <div class="lower-item"><span class="lower-marker"></span><span data-word="THINK" data-effect="mask">THINK</span></div>
        <div class="lower-item"><span class="lower-marker"></span><span data-word="SYSTEM" data-effect="mask">SYSTEM</span></div>
        <div class="lower-item"><span class="lower-marker"></span><span data-word="EXECUTION" data-effect="slide">EXECUTION</span></div>
        <div class="lower-item"><span class="lower-marker"></span><span data-word="IMPROVE" data-effect="refine">IMPROVE</span></div>
      </div>
    </div>`;

  hero.prepend(element);
  hero.classList.add("has-environment");

  const words = [...element.querySelectorAll("[data-word]")];
  const handwriting = element.querySelector("[data-handwriting]");
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let phase = "structure";
  let active = false;
  let startedAt = null;
  let lastTextAt = 0;
  let cycle = -1;
  let slowFrames = 0;
  let limited = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  element.dataset.quality = limited ? "reduced" : "full";

  // Initialize handwriting stroke
  if (handwriting) {
    handwriting.style.strokeDasharray = "420";
    handwriting.style.strokeDashoffset = "0";
  }

  // Mouse tracking for parallax
  hero.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || mobile.matches || event.pointerType !== "mouse") return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = (event.clientX - bounds.left) / bounds.width - 0.5;
    target.y = (event.clientY - bounds.top) / bounds.height - 0.5;
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    target.x = 0;
    target.y = 0;
  });

  function settle() {
    for (const anim of element.getAnimations({ subtree: true })) anim.cancel();
    words.forEach((word) => { word.textContent = word.dataset.word; });
    pointer.x = pointer.y = target.x = target.y = 0;
    element.style.setProperty("--environment-x", "0px");
    element.style.setProperty("--environment-y", "0px");
  }

  reducedMotion.addEventListener("change", settle);
  mobile.addEventListener("change", settle);

  function animateWord(word) {
    const effect = word.dataset.effect;
    const duration = effect === "refine" ? 2200 : effect === "impact" ? 1 : 360;
    const frames = effect === "glitch"
      ? [
          { opacity: 0.25, transform: "translateX(3px)" },
          { opacity: 0.80, transform: "translateX(-2px)", offset: 0.3 },
          { opacity: 1, transform: "none" },
        ]
      : [
          {
            opacity: effect === "refine" ? 0.15 : 0,
            clipPath: effect === "mask" ? "inset(0 100% 0 0)" : "inset(0)",
            transform: effect === "slide" ? "translateY(4px)" : "none",
          },
          { opacity: 1, clipPath: "inset(0)", transform: "none" },
        ];
    word.animate(frames, { duration, easing: "ease-out" });
  }

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

      // Reconstruction Cycle (Section 7)
      const currentInterval = phases[phase].interval;
      const nextCycle = Math.floor(time / currentInterval);
      if (nextCycle !== cycle) {
        cycle = nextCycle;
        // Cycle 0: all words build in sequence.
        // Later cycles: controlled, right-to-left order; only 1-2 words reconstruct at a time
        const order = cycle === 0
          ? words
          : [words[(cycle * 3 + 3) % words.length], words[(cycle * 3 + 1) % words.length]];

        order.forEach((word, index) => {
          word.dataset.rebuildAt = String(time + index * 160);
          word.dataset.animated = "false";
        });

        // Trigger handwriting animation on cycle 0 or every 3rd cycle
        if (handwriting && (cycle === 0 || cycle % 3 === 0)) {
          handwriting.animate(
            [
              { strokeDasharray: "420", strokeDashoffset: "420" },
              { strokeDasharray: "420", strokeDashoffset: "0" },
            ],
            { duration: 1500, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
          );
        }
      }

      // Word animation state updates
      for (const word of words) {
        const age = time - Number(word.dataset.rebuildAt ?? -10000);
        if (age < 0 || age > 1100) continue;

        if (word.dataset.animated === "false") {
          animateWord(word);
          word.dataset.animated = "true";
        }

        let text = word.dataset.word;
        if (word.dataset.effect === "binary" && age < 700) {
          text = ["0101101", "A10L01E", "ANA1YZ1", "ANALYZE"][Math.min(3, Math.floor(age / 175))];
        }
        if (word.dataset.effect === "build") {
          text = text.slice(0, Math.min(text.length, 1 + Math.floor(age / 110)));
        }
        if (word.textContent !== text) {
          word.textContent = text;
        }
      }
    },
  };
}

export const homeEnvironment = createEnvironment();
