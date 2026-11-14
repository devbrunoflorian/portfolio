const headings = [...document.querySelectorAll(".scroll-fill")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const documentRoot = document.documentElement;
const fillWords = new Map();
const introFills = new Map();
let frameRequested = false;
// About opening: edit these beats to tune the presentation in either language.
// `step` spaces syllables; `enter` controls their fade; `settle` closes the beat.
// Photo follows the person beat; `pause` adds time between beats.
const OPENING_SCRIPT = {
  en: {
    start: 160,
    lead: { step: 145, enter: 300, settle: 420, pause: 0 },
    bridge: { step: 145, enter: 300, settle: 420, pause: 0 },
    person: { step: 390, enter: 560, settle: 560, pause: 0 },
    bodyStep: 290,
    bodyFlowStep: 85,
  },
  'pt-br': {
    start: 160,
    lead: { step: 115, enter: 300, settle: 420, pause: 0 },
    bridge: { step: 115, enter: 300, settle: 420, pause: 0 },
    person: { step: 310, enter: 560, settle: 560, pause: 0 },
    bodyStep: 230,
    bodyFlowStep: 75,
  },
};

function openingTimeline(group, script) {
  const comma = group.findIndex(syllable => syllable.textContent.trim() === ',');
  const person = group.findIndex(syllable => syllable.closest('em'));
  const beats = [
    [group.slice(0, comma + 1), script.lead],
    [group.slice(comma + 1, person), script.bridge],
    [group.slice(person), script.person],
  ];
  const timing = new Map();
  let cursor = script.start;
  let appearanceEnd = 0;
  let textEnd = 0;
  for (const [syllables, beat] of beats) {
    if (!syllables.length) continue;
    syllables.forEach((syllable, index) => {
      const enterAt = cursor + index * beat.step;
      timing.set(syllable, { enterAt, enterDuration: beat.enter });
      appearanceEnd = Math.max(appearanceEnd, enterAt + beat.enter);
      textEnd = Math.max(textEnd, enterAt + beat.settle);
    });
    cursor += syllables.length * beat.step + beat.pause;
  }
  return { group, timing, appearanceEnd, textEnd, personStart: timing.get(group[person]).enterAt };
}

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
    const script = OPENING_SCRIPT[document.documentElement.lang.toLowerCase()] ?? OPENING_SCRIPT.en;
    const timelines = groups.map(group => openingTimeline(group, script));
    timelines.forEach(({ group, timing }) => group.forEach(syllable => {
      const emphasis = syllable.closest("em");
      const intendedInk = emphasis ? getComputedStyle(emphasis).color : getComputedStyle(heading).color;
      const cue = timing.get(syllable);
      syllable.classList.add("scroll-fill-syllable");
      syllable.style.setProperty("--word-ink", intendedInk);
      syllable.style.setProperty("--word-fill", "0%");
      syllable.style.setProperty("--syllable-delay", `${cue.enterAt}ms`);
      syllable.style.setProperty("--syllable-appear-duration", `${cue.enterDuration}ms`);
    }));
    heading.dataset.scrollFillReady = "true";
    heading.dataset.introStage = "waiting";
    const appearanceEnd = Math.max(0, ...timelines.map(timeline => timeline.appearanceEnd));
    const textEnd = Math.max(0, ...timelines.map(timeline => timeline.textEnd));
    const scene = heading.closest(".about-opening");
    const photoStart = Math.min(...timelines.map(timeline => timeline.personStart));
    const body = [];
    let bodyCursor = textEnd;
    scene?.querySelectorAll('[data-opening-sentence]').forEach((sentence, sentenceIndex) => {
      const words = wrapTextNodes(sentence);
      const step = sentenceIndex === 0 ? script.bodyStep : script.bodyFlowStep;
      sentence.dataset.openingReady = 'true';
      words.forEach((word, index) => {
        body.push({ word, start: bodyCursor + index * step });
        word.style.setProperty('--word-fill', '100%');
        word.dataset.filled = 'true';
      });
      bodyCursor += words.length * step;
    });
    const state = { heading, groups, timelines, scene, appearanceEnd, textEnd, photoStart,
      body, bodyDuration: script.lead.enter,
      totalDuration: Math.max(textEnd, bodyCursor + script.lead.enter), photoFade: textEnd - photoStart,
      elapsed: 0, lastTime: null, started: false, complete: false };
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
    word.dataset.filled = String(wordProgress >= 1);
  });
}

function finishIntro(state) {
  state.groups.forEach(group => group.forEach(syllable => {
    syllable.style.setProperty("--word-fill", "100%");
    syllable.dataset.filled = "true";
  }));
  state.heading.dataset.introStage = "complete";
  state.heading.dataset.scrollFillComplete = "true";
  state.scene?.style.setProperty("--opening-reveal", "1");
  state.scene?.style.setProperty("--opening-table-blur", "1.1px");
  state.body.forEach(({ word }) => { word.style.opacity = '1'; word.style.transform = 'none'; });
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

function updateFill(timestamp = performance.now()) {
  frameRequested = false;
  const paused = isMotionPaused() || document.hidden;
  if (paused) {
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
    state.heading.dataset.introStage = state.elapsed < state.appearanceEnd ? "appear" : "fill";
    if (state.elapsed >= state.textEnd) state.heading.dataset.scrollFillComplete = "true";
    state.body.forEach(({ word, start }) => {
      const progress = clamp((state.elapsed - start) / state.bodyDuration, 0, 1);
      word.style.opacity = String(progress);
      word.style.transform = `translateY(${(1 - progress) * .16}em)`;
    });
    if (state.scene && state.elapsed >= state.photoStart) {
      if (state.elapsed >= state.textEnd) state.heading.dataset.introStage = "portrait";
      const progress = clamp((state.elapsed - state.photoStart) / state.photoFade, 0, 1);
      state.scene.style.setProperty("--opening-reveal", String(progress * progress * (3 - 2 * progress)));
      state.scene.style.setProperty("--opening-table-blur", `${(1.1 * progress).toFixed(2)}px`);
    }
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
    if (isMotionPaused()) updateFill();
    else requestFillUpdate();
  });
  motionStateObserver.observe(documentRoot, { attributes: true, attributeFilter: ["data-motion-paused"] });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) introFills.forEach(state => { state.lastTime = null; });
    else requestFillUpdate();
  });
  document.fonts?.ready.then(requestFillUpdate);
}
