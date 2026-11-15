import { MOTION, clamp01, easeOutCubic, scrollFillProgress, smoothstep } from "./shared/motion.js";

const headings = [...document.querySelectorAll(".scroll-fill")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const documentRoot = document.documentElement;
const fillTiming = MOTION.scrollFill;
const fillWords = new Map();
const introFills = new Map();
let frameRequested = false;
// About opening: edit these beats to tune the presentation in either language.
// `step` spaces syllables; `enter` controls their fade; `settle` closes the beat.
// The final emphasized word follows the bridge cadence and reveals left to right.
const OPENING_SCRIPT = {
  en: {
    start: 160,
    lead: { step: 145, enter: 300, settle: 420, pause: 0 },
    bridge: { step: 145, enter: 300, settle: 420, pause: 0 },
    person: { step: 145, enter: 300, settle: 420, opacityCurve: "easeOutCubic" },
    bodyStep: 290,
    bodyFlowStep: 85,
  },
  'pt-br': {
    start: 160,
    lead: { step: 115, enter: 300, settle: 420, pause: 0 },
    bridge: { step: 115, enter: 300, settle: 420, pause: 0 },
    person: { step: 115, enter: 300, settle: 420, opacityCurve: "easeOutCubic" },
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
  let previousBeatEnd = script.start;
  let appearanceEnd = 0;
  let textEnd = 0;
  let personStart = Infinity;
  let personEnd = 0;
  for (const [syllables, beat] of beats) {
    if (!syllables.length) continue;
    if (beat.pauseBefore) cursor = Math.max(cursor, previousBeatEnd) + beat.pauseBefore;
    syllables.forEach((syllable, index) => {
      const enterAt = cursor + (beat.simultaneous ? 0 : index * beat.step);
      timing.set(syllable, { enterAt, enterDuration: beat.enter, opacityCurve: beat.opacityCurve });
      appearanceEnd = Math.max(appearanceEnd, enterAt + beat.enter);
      textEnd = Math.max(textEnd, enterAt + beat.settle);
      if (syllable.closest('em')) {
        personStart = Math.min(personStart, enterAt);
        personEnd = Math.max(personEnd, enterAt + beat.enter);
      }
    });
    previousBeatEnd = Math.max(previousBeatEnd, ...syllables.map(syllable => {
      const cue = timing.get(syllable);
      return cue.enterAt + cue.enterDuration;
    }));
    cursor += beat.simultaneous ? (beat.pause ?? 0) : syllables.length * beat.step + beat.pause;
  }
  return { group, timing, appearanceEnd, textEnd, personStart, personEnd };
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
    timelines.forEach(({ group }) => group.forEach(syllable => {
      const emphasis = syllable.closest("em");
      const intendedInk = emphasis ? getComputedStyle(emphasis).color : getComputedStyle(heading).color;
      syllable.classList.add("scroll-fill-syllable");
      syllable.style.setProperty("--word-ink", intendedInk);
      syllable.style.setProperty("--word-fill", "0%");
    }));
    heading.dataset.scrollFillReady = "true";
    heading.dataset.introStage = "waiting";
    const appearanceEnd = Math.max(0, ...timelines.map(timeline => timeline.appearanceEnd));
    const textEnd = Math.max(0, ...timelines.map(timeline => timeline.textEnd));
    const scene = heading.closest(".about-opening");
    const photoStart = Math.min(...timelines.map(timeline => timeline.personStart));
    const photoEnd = Math.max(...timelines.map(timeline => timeline.personEnd));
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
      totalDuration: Math.max(textEnd, bodyCursor + script.lead.enter), photoFade: Math.max(1, photoEnd - photoStart),
      elapsed: 0, lastTime: null, started: false, complete: false };
    introFills.set(heading, state);
    if (motionPreference.matches) finishIntro(state);
    return;
  }

  const words = wrapTextNodes(heading);
  heading.dataset.scrollFillReady = "true";
  if (heading.dataset.scrollFillMode === "static" || heading.closest("[data-journey-panel]")) {
    writeFill(words, 1);
    return;
  }
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
    syllable.style.removeProperty("opacity");
    syllable.style.removeProperty("transform");
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
  for (const [heading, words] of fillWords) {
    const bounds = heading.getBoundingClientRect();
    const progress = motionPreference.matches
      ? 1
      : scrollFillProgress(bounds.top, viewportHeight, fillTiming);

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
    state.timelines.forEach(({ group, timing }) => {
      group.forEach(syllable => {
        const cue = timing.get(syllable);
        const progress = clamp01((state.elapsed - cue.enterAt) / cue.enterDuration);
        const opacity = cue.opacityCurve === "easeOutCubic" ? easeOutCubic(progress) : smoothstep(progress);
        syllable.style.opacity = String(opacity);
        syllable.style.transform = `translateY(${((1 - easeOutCubic(progress)) * MOTION.opening.syllableRiseEm).toFixed(3)}em)`;
      });
    });
    state.body.forEach(({ word, start }) => {
      const progress = clamp((state.elapsed - start) / state.bodyDuration, 0, 1);
      word.style.opacity = String(smoothstep(progress));
      word.style.transform = `translateY(${((1 - easeOutCubic(progress)) * MOTION.opening.bodyRiseEm).toFixed(3)}em)`;
    });
    if (state.scene && state.elapsed >= state.photoStart) {
      if (state.elapsed >= state.textEnd) state.heading.dataset.introStage = "portrait";
      const progress = smoothstep((state.elapsed - state.photoStart) / state.photoFade);
      state.scene.style.setProperty("--opening-reveal", String(progress));
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
