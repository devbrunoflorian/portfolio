const headings = [...document.querySelectorAll(".scroll-fill")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const documentRoot = document.documentElement;
const fillWords = new Map();
const introFills = new Map();
let frameRequested = false;
const INTRO_DELAY = 100;
const SYLLABLE_STAGGER = 58;
const SYLLABLE_APPEAR_DURATION = 190;
const FILL_GAP = 120;
const SYLLABLE_FILL_STAGGER = 62;
const SYLLABLE_FILL_DURATION = 190;

function wrapTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim()) textNodes.push(node);
  }

  const words = [];
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/u)) {
      if (!part) continue;
      if (/^\s+$/u.test(part)) {
        fragment.append(document.createTextNode(part));
        continue;
      }

      const word = document.createElement("span");
      word.className = "scroll-fill-word";
      word.textContent = part;
      const ink = getComputedStyle(node.parentElement).color;
      word.style.setProperty("--word-ink", ink);
      word.style.setProperty("--word-fill", "0%");
      fragment.append(word);
      words.push(word);
    }
    node.replaceWith(fragment);
  }

  return words;
}

function wrapWords(heading) {
  if (heading.dataset.scrollFillMode === "once") {
    const variants = [...heading.querySelectorAll("[data-fill-variant]")];
    const groups = variants.map(variant => [...variant.querySelectorAll("[data-fill-syllable]")]);
    const syllableCount = Math.max(0, ...groups.map(group => group.length));
    groups.forEach(group => group.forEach((syllable, index) => {
      const emphasis = syllable.closest("em");
      const intendedInk = emphasis ? getComputedStyle(emphasis).color : getComputedStyle(heading).color;
      syllable.classList.add("scroll-fill-syllable");
      syllable.style.setProperty("--word-ink", intendedInk);
      syllable.style.setProperty("--word-fill", "0%");
      syllable.style.setProperty("--syllable-index", String(index));
      syllable.style.setProperty("--syllable-delay", `${INTRO_DELAY + index * SYLLABLE_STAGGER}ms`);
    }));
    heading.dataset.scrollFillReady = "true";
    heading.dataset.introStage = "waiting";
    const appearanceEnd = INTRO_DELAY + Math.max(0, syllableCount - 1) * SYLLABLE_STAGGER + SYLLABLE_APPEAR_DURATION;
    const fillStart = appearanceEnd + FILL_GAP;
    const totalDuration = fillStart + Math.max(0, syllableCount - 1) * SYLLABLE_FILL_STAGGER + SYLLABLE_FILL_DURATION;
    const state = { heading, groups, syllableCount, appearanceEnd, fillStart, totalDuration, elapsed: 0, lastTime: null, started: false, complete: false };
    introFills.set(heading, state);
    if (motionPreference.matches) finishIntro(state);
    return;
  }

  const words = wrapTextNodes(heading);
  heading.dataset.scrollFillReady = "true";
  fillWords.set(heading, words);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isMotionPaused() {
  return documentRoot.dataset.motionPaused === "true" && !motionPreference.matches;
}

function writeFill(words, progress) {
  words.forEach((word, index) => {
    const wordProgress = clamp(progress * words.length - index, 0, 1);
    word.style.setProperty("--word-fill", `${(wordProgress * 100).toFixed(1)}%`);
  });
}

function finishIntro(state) {
  state.groups.forEach(group => group.forEach(syllable => syllable.style.setProperty("--word-fill", "100%")));
  state.heading.dataset.introStage = "complete";
  state.heading.dataset.scrollFillComplete = "true";
  state.complete = true;
  state.lastTime = null;
}

function startIntro(heading, state) {
  if (state.started || state.complete) return;
  if (motionPreference.matches) {
    finishIntro(state);
    return;
  }
  state.started = true;
  state.heading.dataset.introStage = "appear";
  state.lastTime = null;
  if (!document.hidden && !isMotionPaused()) requestFillUpdate();
}

function updateFill(force = false, timestamp = performance.now()) {
  frameRequested = false;
  const paused = isMotionPaused() || document.hidden;
  if (paused && !force) {
    introFills.forEach(state => { state.lastTime = null; });
    return;
  }

  const viewportHeight = window.innerHeight;
  const startLine = viewportHeight * 0.82;
  const finishLine = viewportHeight * 0.28;

  for (const [heading, words] of fillWords) {
    const bounds = heading.getBoundingClientRect();
    const progress = motionPreference.matches
      ? 1
      : clamp((startLine - bounds.top) / (startLine - finishLine), 0, 1);

    writeFill(words, progress);
  }

  let introRunning = false;
  for (const state of introFills.values()) {
    if (!state.started || state.complete) continue;
    if (motionPreference.matches) {
      finishIntro(state);
      continue;
    }
    if (paused) {
      state.lastTime = null;
      continue;
    }
    if (state.lastTime === null) state.lastTime = timestamp;
    else {
      state.elapsed += Math.max(0, timestamp - state.lastTime);
      state.lastTime = timestamp;
    }
    if (state.elapsed < state.fillStart) {
      state.heading.dataset.introStage = state.elapsed < state.appearanceEnd ? "appear" : "fill";
      state.groups.forEach(group => group.forEach(syllable => syllable.style.setProperty("--word-fill", "0%")));
      introRunning = true;
      continue;
    }

    state.heading.dataset.introStage = "fill";
    state.groups.forEach(group => group.forEach((syllable, index) => {
      const progress = clamp((state.elapsed - state.fillStart - index * SYLLABLE_FILL_STAGGER) / SYLLABLE_FILL_DURATION, 0, 1);
      syllable.style.setProperty("--word-fill", `${(progress * 100).toFixed(1)}%`);
    }));
    if (state.elapsed >= state.totalDuration) finishIntro(state);
    else introRunning = true;
  }

  if (introRunning) requestFillUpdate();
}

function requestFillUpdate() {
  if (isMotionPaused() || document.hidden) return;
  if (frameRequested) return;
  frameRequested = true;
  window.requestAnimationFrame(updateFill);
}

if (headings.length) {
  headings.forEach(wrapWords);
  const introHeadings = [...introFills.keys()];
  if (motionPreference.matches) introFills.forEach(finishIntro);
  else if ("IntersectionObserver" in window) {
    const introObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const state = introFills.get(entry.target);
        if (state) startIntro(entry.target, state);
        introObserver.unobserve(entry.target);
      }
    }, { threshold: 0.01 });
    introHeadings.forEach(heading => introObserver.observe(heading));
  } else {
    introHeadings.forEach(heading => {
      const bounds = heading.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) startIntro(heading, introFills.get(heading));
    });
  }
  requestFillUpdate();
  window.addEventListener("scroll", requestFillUpdate, { passive: true });
  window.addEventListener("resize", requestFillUpdate, { passive: true });
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) introFills.forEach(finishIntro);
    requestFillUpdate();
  });
  const motionStateObserver = new MutationObserver(() => {
    if (isMotionPaused()) updateFill(true);
    else requestFillUpdate();
  });
  motionStateObserver.observe(documentRoot, { attributes: true, attributeFilter: ["data-motion-paused"] });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) introFills.forEach(state => { state.lastTime = null; });
    else requestFillUpdate();
  });
  document.fonts?.ready.then(requestFillUpdate);
}
