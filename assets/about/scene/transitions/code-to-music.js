const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const smoothstep = value => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};
const mix = (from, to, progress) => from + (to - from) * progress;

function documentTop(element) {
  return element.getBoundingClientRect().top + window.scrollY;
}

function emptyTransition() {
  return { update() {}, dispose() {} };
}

/**
 * Owns only the scroll-driven Code → Music score entrance. Music → Art stays
 * with the separate Art dissolve in journey.ts / art-dissolve.js.
 */
export function mountCodeToMusicTransition(root) {
  const code = root.querySelector(".about-code");
  const journey = root.querySelector("[data-about-journey]");
  const scoreWindow = root.querySelector(".about-music .score-frame .score-window");
  const scoreFrame = scoreWindow?.closest(".score-frame");
  if (!code || !journey || !scoreWindow || !scoreFrame) return emptyTransition();

  const canvas = document.createElement("canvas");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./code-to-music.css", import.meta.url);
  stylesheet.dataset.codeToMusicStyle = "";
  document.head.append(stylesheet);
  canvas.className = "code-to-music-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.hidden = true;
  document.body.append(canvas);

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const abort = new AbortController();
  let disposed = false;
  let cssWidth = 0;
  let cssHeight = 0;
  let backingWidth = 0;
  let backingHeight = 0;
  let lastDrawKey = "";
  let renderer = null;
  let rendererPromise = null;
  let pendingFrame = null;
  let heldProgress = null;
  let previousProgress = null;
  let journeyTopCache = null;
  let lastMotionEnabled = true;
  let presentationActive = false;
  let userReturnedToCode = false;
  let skipForHash = ["#music", "#art", "#games"].includes(location.hash.toLowerCase());
  const originalScoreOpacity = scoreWindow.style.opacity;
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

  function resetPresentation() {
    if (!presentationActive && canvas.hidden && scoreWindow.style.opacity === originalScoreOpacity && pendingFrame === null) return;
    presentationActive = false;
    canvas.hidden = true;
    scoreWindow.style.opacity = originalScoreOpacity;
    pendingFrame = null;
    heldProgress = null;
    previousProgress = null;
    lastDrawKey = "";
  }

  function targetRange() {
    journeyTopCache ??= documentTop(journey);
    const distance = window.innerHeight;
    return {
      start: journeyTopCache - distance * .78,
      end: journeyTopCache + distance * .22,
    };
  }

  function invalidateGeometry() {
    journeyTopCache = null;
  }

  function setCanvasRect(rect) {
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    const ratio = pixelRatio();
    canvas.style.left = `${rect.left}px`;
    canvas.style.top = `${rect.top}px`;
    canvas.style.width = `${nextWidth}px`;
    canvas.style.height = `${nextHeight}px`;
    cssWidth = nextWidth;
    cssHeight = nextHeight;
    // Quantized backing-store sizes avoid reallocating a full-resolution bitmap
    // on every scroll frame while the canvas narrows into the score window.
    const nextBackingWidth = Math.max(32, Math.ceil(cssWidth * ratio / 32) * 32);
    const nextBackingHeight = Math.max(32, Math.ceil(cssHeight * ratio / 32) * 32);
    if (nextBackingWidth === backingWidth && nextBackingHeight === backingHeight) return false;
    backingWidth = nextBackingWidth;
    backingHeight = nextBackingHeight;
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    return true;
  }

  function entranceRect() {
    const maxHeight = window.innerHeight * .65;
    const width = Math.min(window.innerWidth, maxHeight * 1.8);
    const height = width / 1.8;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  }

  function loadRenderer() {
    if (!rendererPromise) {
      rendererPromise = import("./score-fold-entry-renderer.js")
        .then(module => {
          renderer = module.drawScoreFoldEntry;
          if (!disposed && pendingFrame) {
            const frame = pendingFrame;
            pendingFrame = null;
            renderFrame(frame.progress, frame.rect);
          }
        })
        .catch(() => {
          pendingFrame = null;
          resetPresentation();
        });
    }
    return rendererPromise;
  }

  function renderFrame(progress, rect) {
    if (!renderer) {
      pendingFrame = { progress, rect };
      canvas.hidden = true;
      scoreWindow.style.opacity = originalScoreOpacity;
      void loadRenderer();
      return;
    }

    if (setCanvasRect(rect)) lastDrawKey = "";
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      resetPresentation();
      return;
    }

    const foldProgress = smoothstep(progress);
    const theme = document.documentElement.dataset.theme;
    const drawKey = [cssWidth, cssHeight, pixelRatio(), foldProgress.toFixed(4), theme].join(":");
    const entranceOpacity = clamp(progress / .055);
    const exitOpacity = 1 - smoothstep((progress - .90) / .10);
    canvas.style.opacity = String(entranceOpacity * exitOpacity);
    scoreWindow.style.opacity = String(smoothstep((progress - .90) / .10));
    canvas.hidden = false;
    if (drawKey === lastDrawKey) {
      previousProgress = progress;
      return;
    }

    context.setTransform(canvas.width / cssWidth, 0, 0, canvas.height / cssHeight, 0, 0);
    try {
      renderer(context, cssWidth, cssHeight, foldProgress, theme);
    } catch {
      resetPresentation();
      return;
    }
    canvas.dataset.foldProgress = foldProgress.toFixed(4);
    lastDrawKey = drawKey;
    previousProgress = progress;
  }

  function update({ motionEnabled = true } = {}) {
    if (disposed) return;
    lastMotionEnabled = motionEnabled;
    const range = targetRange();
    if (skipForHash && userReturnedToCode && window.scrollY < range.start) skipForHash = false;
    if (reducedMotion.matches || skipForHash) {
      resetPresentation();
      return;
    }

    const rawProgress = (window.scrollY - range.start) / Math.max(1, range.end - range.start);
    if (rawProgress <= 0 || rawProgress >= 1) {
      resetPresentation();
      return;
    }

    let progress = clamp(rawProgress);
    presentationActive = true;
    if (!motionEnabled) {
      heldProgress ??= progress;
      progress = heldProgress;
    } else {
      heldProgress = null;
    }

    const landingProgress = smoothstep((progress - .62) / .38);
    const scoreBounds = scoreWindow.getBoundingClientRect();
    const frameBounds = scoreFrame.getBoundingClientRect();
    const target = {
      left: Math.max(scoreBounds.left, frameBounds.left),
      top: scoreBounds.top,
      width: Math.max(1, Math.min(scoreBounds.right, frameBounds.right) - Math.max(scoreBounds.left, frameBounds.left)),
      height: scoreBounds.height,
    };
    const entrance = entranceRect();
    const rect = {
      left: mix(entrance.left, target.left, landingProgress),
      top: mix(entrance.top, target.top, landingProgress),
      width: mix(entrance.width, target.width, landingProgress),
      height: mix(entrance.height, target.height, landingProgress),
    };

    renderFrame(progress, rect);
  }

  function onScroll() {
    if (skipForHash) userReturnedToCode = true;
  }
  function onThemeChange() {
    lastDrawKey = "";
    if (previousProgress !== null) update({ motionEnabled: lastMotionEnabled });
  }

  const preload = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      preload.disconnect();
      void loadRenderer();
    }, { rootMargin: "400px 0px" })
    : null;
  if (preload) preload.observe(journey);
  else void loadRenderer();
  window.addEventListener("scroll", onScroll, { passive: true, signal: abort.signal });
  window.addEventListener("resize", invalidateGeometry, { passive: true, signal: abort.signal });
  const geometryObserver = new ResizeObserver(invalidateGeometry);
  geometryObserver.observe(root);
  geometryObserver.observe(code);
  geometryObserver.observe(journey);
  const themeObserver = new MutationObserver(onThemeChange);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  reducedMotion.addEventListener?.("change", () => update({ motionEnabled: lastMotionEnabled }), { signal: abort.signal });

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      preload?.disconnect();
      geometryObserver.disconnect();
      themeObserver.disconnect();
      canvas.remove();
      stylesheet.remove();
      scoreWindow.style.opacity = originalScoreOpacity;
    },
  };
}
