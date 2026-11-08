import { score } from "./score.js?v=a1c14c40";
import { createJourneyAudio, playbackPositionForDisplay } from "./audio.js";
import { mountExperiments } from "./experiments.js";
import { createScoreVisual, scoreStageOffsets } from "./score-visual.js";
import { createGpuEditorialFrame } from "./score-gpu-frame.js";
import {
  SCORE_CAMERA_POSE_STOPS,
  createScoreCurve,
  createScoreJourneyCurve,
} from "./score-camera-journey.js";

const root = document.querySelector(".about-main");
const query = new URLSearchParams(window.location.search);
if (['2a','2b','3a','3b'].includes(query.get('score-gate'))) import('./score-fold-gate.js?v=gpu-study-4');
const scoreGridStudyMode = query.get("score-grid") === "study";
const scoreRibbonStudyMode = query.get("score-ribbon") === "study";
const scoreRibbonStoryboardMode = query.get("score-ribbon") === "storyboard";
const scoreRibbonTransitionMode = query.get("score-ribbon") === "transition";
const scoreGpuScrollMode = query.get("score-gpu") === "scroll";
if (scoreRibbonTransitionMode) document.body.dataset.scoreRibbonTransition = "true";
const chapters = [...root.querySelectorAll("[data-movement]")];
const scoreThread = root.querySelector("[data-score-thread]");
const scoreLeads = root.querySelector("[data-score-leads-global]");
let updateRibbonTransition = null;
let disposeRibbonTransition = null;
let updateGpuScroll = null;
let disposeGpuScroll = null;
const scoreCameraStops = [
  { x: -.012, y: -.012, scale: .68, opacity: .56, lead: .82, rotate: 0 },
  { x: .004, y: .018, scale: .66, opacity: .46, lead: .62, rotate: 0 },
  { x: 0, y: .008, scale: .96, opacity: .78, lead: .98, rotate: 0 },
  { x: -.040, y: .080, scale: .72, opacity: .56, lead: .56, rotate: 0 },
  { x: -.035, y: -.030, scale: .60, opacity: .44, lead: .50, rotate: 0 },
  { x: 0, y: .04, scale: .68, opacity: .28, lead: .28, rotate: 0 },
];
const scoreGpuCameraStops = [
  { x: -.11, y: .02, scale: 1.28, opacity: .58, lead: .82, rotate: 0 },
  { x: -.02, y: .03, scale: .68, opacity: .50, lead: .62, rotate: 0 },
  { x: 0, y: .05, scale: .96, opacity: .78, lead: .98, rotate: 0 },
  { x: -.01, y: .08, scale: .76, opacity: .58, lead: .56, rotate: 0 },
  { x: 0, y: .15, scale: .50, opacity: .48, lead: .50, rotate: 0 },
  { x: 0, y: .19, scale: .54, opacity: .38, lead: .28, rotate: 0 },
];
const scoreCameraAnchors = {
  opening: ".hero-field",
  code: ".code-score-anchor",
  music: ".score-stage-spacer",
  art: ".art-score-anchor",
  games: ".games-experiment",
  closing: ".closing-links",
};
const scoreGpuMusicIndex = chapters.findIndex(chapter => chapter.dataset.movement === "music");
const mobileScoreScale = { opening: 1.12, code: .68, music: .95, art: .76, games: .58, closing: .66 };
let scoreGpuPose = 0;
let scoreGpuZoom = 1;
let scoreChapterBounds = [];
let scoreChapterCenters = [];
let scoreGpuOffsetStops = [];
let scoreGpuCurves = null;
let scoreGpuOffsetsNeedMeasure = true;
let scoreThreadNeedsMeasure = true;
let scoreThreadLastScrollY = Number.NaN;
let scoreThreadLastStyle = "";
let scoreTransitionProgress = 0;
let scoreTransitionTarget = 0;
let scoreCameraCurrent = null;
let scoreCameraLastTime = 0;
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function scoreAnchorFor(chapter) {
  const selector = scoreCameraAnchors[chapter?.dataset.movement];
  return selector ? chapter.querySelector(selector) : null;
}
const revealSelectors = {
  opening: ".hero-copy .section-kicker, .hero-copy .hero-intro, .hero-copy .hero-actions",
  code: ".code-chapter .chapter-copy .section-kicker, .code-chapter .chapter-copy > p:last-child, .code-stack > .experiment-label, .code-stack > .stack-intro, .code-stack > .stack-groups, .code-stack > .stack-more",
  music: ".music-heading .section-kicker, .music-intro, .score-figure, .music-tools, .music-explore",
  art: ".art-chapter .art-experiment, .art-chapter .chapter-copy .section-kicker, .art-chapter .chapter-copy > p:last-child",
  games: ".games-chapter .chapter-copy .section-kicker, .games-chapter .chapter-copy > p:last-child, .games-experiment",
  closing: ".about-closing .closing-links, .about-closing .back-to-top",
};
const revealTargets = new Set();
for (const [movement, selector] of Object.entries(revealSelectors)) {
  [...root.querySelectorAll(selector)].forEach((element, index) => {
    element.dataset.aboutReveal = movement;
    element.dataset.aboutRevealOrder = String(index + 1);
    revealTargets.add(element);
  });
}
const supportsViewTimeline = CSS.supports("(animation-timeline: view()) and (animation-range: entry)");
const revealObserver = supportsViewTimeline ? null : new IntersectionObserver(entries => {
  entries.forEach(entry => { entry.target.dataset.aboutRevealed = String(entry.isIntersecting); });
}, { rootMargin: "-12% 0px -18% 0px", threshold: 0 });
if (revealObserver) revealTargets.forEach(element => revealObserver.observe(element));
function cameraValue(key, index, progress) {
  const stops = scoreCameraStops;
  const before = stops[Math.max(0, index - 1)][key];
  const start = stops[index][key];
  const end = stops[index + 1][key];
  const after = stops[Math.min(stops.length - 1, index + 2)][key];
  const squared = progress * progress;
  const cubed = squared * progress;
  const value = .5 * (2 * start + (-before + end) * progress + (2 * before - 5 * start + 4 * end - after) * squared + (-before + 3 * start - 3 * end + after) * cubed);
  return clamp(value, Math.min(start, end), Math.max(start, end));
}
function updateScoreThread(force = false) {
  if (!scoreThread || (motionPaused && !reduceMotion.matches)) return;
  const scrollY = window.scrollY;
  if (force || scoreThreadNeedsMeasure || scoreChapterBounds.length !== chapters.length) {
    scoreChapterBounds = chapters.map(chapter => {
      const bounds = chapter.getBoundingClientRect();
      return { top: bounds.top + scrollY, bottom: bounds.bottom + scrollY, height: bounds.height };
    });
    scoreChapterCenters = scoreChapterBounds.map(bounds => bounds.top + bounds.height / 2);
    scoreThreadNeedsMeasure = false;
    if (scoreGpuScrollMode) scoreGpuOffsetsNeedMeasure = true;
  }
  scoreThreadLastScrollY = scrollY;
  const storyPoint = scrollY + window.innerHeight * .52;
  let chapterIndex = scoreChapterBounds.findIndex(bounds => storyPoint >= bounds.top && storyPoint < bounds.bottom);
  if (chapterIndex < 0) {
    chapterIndex = scoreChapterBounds.findIndex(bounds => storyPoint < bounds.top);
    chapterIndex = chapterIndex < 0 ? scoreChapterBounds.length - 1 : Math.max(0, chapterIndex - 1);
  }
  const chapterCenters = scoreChapterCenters;
  if (scoreGpuScrollMode && scoreGpuOffsetsNeedMeasure) {
    const mobile = window.innerWidth <= 700;
    scoreGpuOffsetStops = chapters.map((chapter, index) => {
      const movement = chapter.dataset.movement;
      const scale = mobile ? mobileScoreScale[movement] : scoreGpuCameraStops[index].scale;
      const centerScrollY = chapterCenters[index] - window.innerHeight * .52;
      return scoreStageOffsets(scoreAnchorFor(chapter), scale, centerScrollY, { ignoreRevealTransforms: true });
    });
    const valuesFor = key => scoreGpuCameraStops.map(stop => stop[key]);
    scoreGpuCurves = {
      journey: createScoreJourneyCurve(chapterCenters),
      pose: createScoreCurve(chapterCenters, mobile ? SCORE_CAMERA_POSE_STOPS.mobile : SCORE_CAMERA_POSE_STOPS.desktop),
      frame: Object.fromEntries(["x", "y", "scale", "opacity", "lead", "rotate"].map(key => [
        key,
        createScoreCurve(chapterCenters, valuesFor(key)),
      ])),
      mobileScale: createScoreCurve(
        chapterCenters,
        chapters.map(chapter => mobileScoreScale[chapter.dataset.movement]),
      ),
      mobileZoom: createScoreCurve(chapterCenters, [1, 1, 2.5, 1, 1, 1], .74),
      offsetX: createScoreCurve(chapterCenters, scoreGpuOffsetStops.map(stop => stop.x)),
      offsetY: createScoreCurve(chapterCenters, scoreGpuOffsetStops.map(stop => stop.y)),
    };
    scoreGpuOffsetsNeedMeasure = false;
  }
  let index = 0;
  let progress = 0;
  let cameraReadingLine = storyPoint;
  if (scoreGpuScrollMode) {
    const journey = scoreGpuCurves.journey(storyPoint);
    const poseStops = window.innerWidth <= 700 ? SCORE_CAMERA_POSE_STOPS.mobile : SCORE_CAMERA_POSE_STOPS.desktop;
    scoreGpuPose = scoreGpuCurves.pose(storyPoint).value;
    index = journey.index;
    progress = journey.progress;
    scoreTransitionTarget = journey.normalizedProgress;
    if (reduceMotion.matches) {
      const settledIndex = clamp(chapterIndex, 0, chapters.length - 1);
      scoreGpuPose = poseStops[settledIndex];
      scoreTransitionTarget = settledIndex / Math.max(1, chapters.length - 1);
      cameraReadingLine = chapterCenters[settledIndex];
    }
  } else {
    const chapterBounds = scoreChapterBounds[chapterIndex];
    const chapterProgress = clamp((storyPoint - chapterBounds.top) / Math.max(1, chapterBounds.height), 0, 1);
    const cameraTransitionPortion = scoreRibbonTransitionMode ? .42 : .18;
    scoreTransitionTarget = reduceMotion.matches
      ? chapterIndex / Math.max(1, chapters.length - 1)
      : clamp((chapterIndex + chapterProgress) / Math.max(1, chapters.length), 0, 1);
    index = chapterIndex;
    if (chapterIndex > 0 && chapterProgress < cameraTransitionPortion) {
      index = chapterIndex - 1;
      progress = chapterProgress / cameraTransitionPortion;
    } else if (chapterIndex === scoreCameraStops.length - 1) {
      index = chapterIndex - 1;
      progress = 1;
    }
    progress = progress * progress * (3 - 2 * progress);
  }
  const mainBounds = root.getBoundingClientRect();
  const enter = clamp((window.innerHeight - mainBounds.top) / (window.innerHeight * .42), 0, 1);
  const leave = clamp(mainBounds.bottom / (window.innerHeight * .42), 0, 1);
  const visibility = Math.min(enter, leave);
  const gpuValue = key => scoreGpuCurves.frame[key](cameraReadingLine).value;
  const values = {
    x: scoreGpuScrollMode ? gpuValue("x") : cameraValue("x", index, progress),
    y: scoreGpuScrollMode ? gpuValue("y") : cameraValue("y", index, progress),
    scale: scoreGpuScrollMode ? gpuValue("scale") : cameraValue("scale", index, progress),
    opacity: (scoreGpuScrollMode ? gpuValue("opacity") : cameraValue("opacity", index, progress)) * visibility,
    lead: (scoreGpuScrollMode ? gpuValue("lead") : cameraValue("lead", index, progress)) * visibility,
    rotate: scoreGpuScrollMode ? gpuValue("rotate") : cameraValue("rotate", index, progress),
  };
  if (scoreGpuScrollMode && window.innerWidth <= 700) {
    values.scale = scoreGpuCurves.mobileScale(cameraReadingLine).value;
  } else if (!scoreGpuScrollMode && window.innerWidth <= 700) {
    const startScale = mobileScoreScale[chapters[index].dataset.movement];
    const endScale = mobileScoreScale[chapters[Math.min(chapters.length - 1, index + 1)].dataset.movement];
    values.scale = startScale + (endScale - startScale) * progress;
  }
  scoreGpuZoom = scoreGpuScrollMode && window.innerWidth <= 700
    ? scoreGpuCurves.mobileZoom(cameraReadingLine).value
    : 1;
  let x;
  let y;
  if (scoreGpuScrollMode) {
    const offsetX = scoreGpuCurves.offsetX(cameraReadingLine).value;
    const offsetY = scoreGpuCurves.offsetY(cameraReadingLine).value;
    x = values.x * window.innerWidth + offsetX;
    y = values.y * window.innerHeight + offsetY;
  } else {
    const startOffset = scoreStageOffsets(scoreAnchorFor(chapters[index]), values.scale);
    const endOffset = scoreStageOffsets(scoreAnchorFor(chapters[index + 1]), values.scale);
    x = values.x * window.innerWidth + startOffset.x + (endOffset.x - startOffset.x) * progress;
    // Route the visual below Music's copy during the handoff, then let it settle on the real score stage.
    const verticalArc = scoreRibbonTransitionMode
      && chapters[index]?.dataset.movement === "code"
      && chapters[index + 1]?.dataset.movement === "music"
      ? Math.sin(Math.PI * progress) * Math.min(window.innerHeight * .16, window.innerWidth <= 700 ? 80 : 132)
      : 0;
    y = values.y * window.innerHeight + startOffset.y + (endOffset.y - startOffset.y) * progress + verticalArc;
  }
  const target = { x, y, scale: values.scale, opacity: values.opacity, lead: values.lead, rotate: values.rotate };
  let gpuEditorialFrame = { offset: { x: 0, y: 0 }, zoom: scoreGpuZoom };
  if (scoreGpuScrollMode && scoreGpuMusicIndex >= 0 && scoreGpuCurves) {
    const musicReadingLine = chapterCenters[scoreGpuMusicIndex];
    const musicScale = window.innerWidth <= 700
      ? mobileScoreScale.music
      : scoreGpuCameraStops[scoreGpuMusicIndex].scale;
    const musicFrame = {
      x: scoreGpuCurves.frame.x(musicReadingLine).value * window.innerWidth
        + scoreGpuCurves.offsetX(musicReadingLine).value,
      y: scoreGpuCurves.frame.y(musicReadingLine).value * window.innerHeight
        + scoreGpuCurves.offsetY(musicReadingLine).value,
      scale: musicScale,
    };
    gpuEditorialFrame = createGpuEditorialFrame({ x, y, scale: values.scale }, musicFrame, scoreGpuZoom);
  }
  const now = performance.now();
  const elapsed = scoreCameraLastTime ? Math.min(64, now - scoreCameraLastTime) : 16;
  scoreCameraLastTime = now;
  if (!scoreCameraCurrent || force || reduceMotion.matches || scoreGpuScrollMode) {
    scoreCameraCurrent = { ...target };
    scoreTransitionProgress = scoreTransitionTarget;
  } else {
    // A short exponential settle removes stepped wheel/hash transitions without
    // making the score feel detached from the reader's hand.
    const amount = 1 - Math.exp(-elapsed / 86);
    Object.keys(target).forEach(key => {
      scoreCameraCurrent[key] += (target[key] - scoreCameraCurrent[key]) * amount;
    });
    scoreTransitionProgress += (scoreTransitionTarget - scoreTransitionProgress) * amount;
  }
  const remaining = Math.max(
    Math.abs(scoreTransitionTarget - scoreTransitionProgress),
    Object.keys(target).reduce((largest, key) => Math.max(largest, Math.abs(target[key] - scoreCameraCurrent[key])), 0),
  );
  if (reduceMotion.matches || remaining < .0005) {
    scoreCameraCurrent = { ...target };
    scoreTransitionProgress = scoreTransitionTarget;
  }
  else requestScene();
  const camera = scoreCameraCurrent;
  const signature = `${camera.x.toFixed(2)}|${camera.y.toFixed(2)}|${camera.scale.toFixed(4)}|${camera.opacity.toFixed(4)}|${camera.lead.toFixed(4)}|${camera.rotate.toFixed(3)}`;
  if (signature === scoreThreadLastStyle) return;
  scoreThreadLastStyle = signature;
  scoreThread.style.setProperty("--thread-x", `${camera.x.toFixed(2)}px`);
  scoreThread.style.setProperty("--thread-y", `${camera.y.toFixed(2)}px`);
  scoreThread.style.setProperty("--thread-scale", camera.scale.toFixed(4));
  scoreThread.style.setProperty("--thread-opacity", camera.opacity.toFixed(4));
  scoreThread.style.setProperty("--thread-rotate", `${camera.rotate.toFixed(3)}deg`);
  scoreLeads.style.setProperty("--thread-x", `${camera.x.toFixed(2)}px`);
  scoreLeads.style.setProperty("--thread-y", `${camera.y.toFixed(2)}px`);
  scoreLeads.style.setProperty("--thread-scale", camera.scale.toFixed(4));
  scoreLeads.style.setProperty("--thread-rotate", `${camera.rotate.toFixed(3)}deg`);
  scoreLeads.style.setProperty("--lead-opacity", camera.lead.toFixed(4));
}
const isPortuguese = document.documentElement.lang === "pt-BR";
const labels = isPortuguese ? {
  listen: "Ouvir", heroListen: "Ouvir Dissonância", resume: "Continuar", replay: "Ouvir de novo", pause: "Pausar", loading: "Iniciando…", off: "Som desligado",
  paused: "Som pausado · retome quando quiser", error: "Não foi possível ativar o som. Tente ouvir novamente.",
  unavailable: "Som indisponível neste navegador. A página continua em silêncio.",
  playing: "Tocando", finished: "Música concluída", next: "próximo compasso", muted: "Volume em zero", motion: "Pausar movimento", resumeMotion: "Retomar movimento", preview: "Prévia", bars: "Compassos", bar: "Compasso",
} : {
  listen: "Listen", heroListen: "Listen to Dissonância", resume: "Continue", replay: "Play again", pause: "Pause", loading: "Starting…", off: "Sound is off",
  paused: "Sound paused · resume when you like", error: "Sound could not start. Try listening again.",
  unavailable: "Sound is unavailable in this browser. Explore in silence.",
  playing: "Playing", finished: "Piece finished", next: "next bar", muted: "Volume at zero", motion: "Pause motion", resumeMotion: "Resume motion", preview: "Preview", bars: "Bars", bar: "Bar",
};
const sectionNames = isPortuguese ? {} : {
  "Verso I": "Verse I", "Ponte I": "Bridge I", "Refrão I": "Chorus I",
  "Verso II": "Verse II", "Ponte II": "Bridge II", "Refrão II": "Chorus II", "Pós Refrão": "Post-Chorus",
};
const sectionName = name => sectionNames[name] ?? name;
const soundButtons = [...root.querySelectorAll("[data-sound-toggle]")];
let displayTimer = 0;
const audio = createJourneyAudio(score, status => {
  const active = status.state === "playing" || status.state === "starting";
  for (const button of soundButtons) {
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-busy", String(status.state === "starting"));
    button.querySelector("[data-sound-label]").textContent = status.state === "starting" ? labels.loading : active ? labels.pause
      : status.state === "paused" ? labels.resume : status.state === "finished" ? labels.replay
      : button.classList.contains("hero-listen") ? labels.heroListen : labels.listen;
    button.querySelector(".sound-icon").textContent = active ? "Ⅱ" : "▶";
  }
  root.querySelector("[data-audio-status]").textContent = status.state === "playing"
    ? `${status.volume === 0 ? labels.muted : labels.playing} · ${sectionName(status.section)}`
    : labels[status.state] ?? labels.off;
  root.querySelectorAll("[data-audio-feedback]").forEach(feedback => {
    feedback.hidden = !["error", "unavailable"].includes(status.state);
    feedback.textContent = feedback.hidden ? "" : labels[status.state];
  });
  if (status.state === "playing" && !displayTimer) {
    displayTimer = setInterval(() => syncMixer(audio.snapshot()), 250);
  } else if (status.state !== "playing") {
    clearInterval(displayTimer);
    displayTimer = 0;
  }
  syncMixer(audio.snapshot?.());
  requestScene();
});
const experiments = mountExperiments(root, audio, isPortuguese);
const visual = createScoreVisual(root, score, requestScene);
const controller = new AbortController();
const { signal } = controller;
soundButtons.forEach(button => button.addEventListener("click", () => audio.enabled ? audio.pause() : audio.start(), { signal }));
root.querySelector("[data-audio-restart]").addEventListener("click", () => audio.restart(), { signal });
root.querySelector("[data-audio-repeat]").addEventListener("click", event => {
  const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(next));
  audio.setRepeat(next);
}, { signal });
const volumeInputs = [...root.querySelectorAll("[data-volume]")];
volumeInputs.forEach(input => input.addEventListener("input", () => {
  volumeInputs.forEach(other => { other.value = input.value; });
  audio.setVolume(Number(input.value) / 100);
}, { signal }));
root.querySelectorAll("[data-enhanced]").forEach(element => { element.hidden = false; });

const layerNames = isPortuguese
  ? { guitar: "Violão", vocal: "Voz", strings: "Cordas", bass: "Baixo", percussion: "Bateria" }
  : { guitar: "Guitar", vocal: "Voice", strings: "Strings", bass: "Bass", percussion: "Percussion" };
const mixer = root.querySelector("[data-layer-mixer]");
const trackMixer = mixer.querySelector("[data-track-mixer]");
const initialMix = new Map(score.tracks.map(track => [track.id, audio.getTrackVolume(track.id)]));
let lastDisplaySecond = -1;
for (const track of score.tracks) {
  const strip = document.createElement("div");
  strip.className = "music-mixer-strip";
  if (track.voice === "vocal") {
    strip.classList.add(track.name.endsWith("II") ? "music-mixer-strip--voice-two" : "music-mixer-strip--voice-one");
  }
  const label = track.voice === "vocal"
    ? `${layerNames.vocal} ${track.name.endsWith("II") ? "II" : "I"}`
    : layerNames[track.voice];
  const sliderId = `about-track-volume-${track.id}`;
  const heading = document.createElement("div");
  heading.className = "music-mixer-strip-heading";
  const labelElement = document.createElement("label");
  labelElement.htmlFor = sliderId;
  labelElement.textContent = label;
  const value = document.createElement("output");
  value.htmlFor = sliderId;
  const initialVolume = Math.round(audio.getTrackVolume(track.id) * 100);
  value.value = `${initialVolume}%`;
  value.textContent = value.value;
  const slider = document.createElement("input");
  slider.id = sliderId;
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = String(initialVolume);
  slider.dataset.trackVolume = String(track.id);
  slider.setAttribute("aria-valuetext", `${initialVolume}%`);
  slider.addEventListener("input", () => {
    const percent = Number(slider.value);
    audio.setTrackVolume(track.id, percent / 100);
    value.value = percent === 0 ? (isPortuguese ? "Silenciada" : "Muted") : `${percent}%`;
    value.textContent = value.value;
    slider.setAttribute("aria-valuetext", value.value);
  }, { signal });
  heading.append(labelElement, value);
  strip.append(heading, slider);
  trackMixer.append(strip);
}
root.querySelector("[data-mix-reset]").addEventListener("click", () => {
  for (const slider of trackMixer.querySelectorAll("[data-track-volume]")) {
    slider.value = String(Math.round(initialMix.get(Number(slider.dataset.trackVolume)) * 100));
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    // The source gain is more precise than its rounded slider percentage.
    audio.setTrackVolume(Number(slider.dataset.trackVolume), initialMix.get(Number(slider.dataset.trackVolume)));
  }
  root.querySelector("[data-layer-status]").textContent = isPortuguese ? "Mix restaurada." : "Mix restored.";
}, { signal });
function formatTime(seconds, round = false) {
  const safeSeconds = Math.max(0, seconds);
  const time = round ? Math.round(safeSeconds) : Math.floor(safeSeconds);
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
}
function syncMixer(snapshot) {
  if (!snapshot) return;
  if (snapshot.state === "off") {
    root.querySelectorAll("[data-audio-position]").forEach(element => { element.textContent = labels.off; });
    return;
  }
  const { seconds: currentSeconds } = playbackPositionForDisplay(snapshot, score);
  const text = `${sectionName(snapshot.section)} · ${formatTime(currentSeconds, currentSeconds >= score.durationSeconds)} / ${formatTime(score.durationSeconds, true)}`;
  root.querySelectorAll("[data-audio-position]").forEach(element => { element.textContent = text; });
}
syncMixer(audio.snapshot?.() ?? { state: "off", beat: 0, seconds: 0, section: "Intro" });

const hero = root.querySelector(".about-hero");
const dock = root.querySelector("[data-dock]");
const panels = [...root.querySelectorAll(".dock-panel")];
const nativePopover = "popover" in HTMLElement.prototype;
if (nativePopover) panels.forEach(panel => { panel.hidden = false; });
function closePanel(panel) {
  if (nativePopover) { if (panel.matches(":popover-open")) panel.hidePopover(); }
  else {
    panel.hidden = true;
    root.querySelector(`[popovertarget="${panel.id}"]`)?.setAttribute("aria-expanded", "false");
  }
}
function syncDock() {
  const focusInControls = dock.contains(document.activeElement) || panels.some(panel => panel.contains(document.activeElement));
  dock.hidden = hero.getBoundingClientRect().bottom > 96 && !focusInControls;
}
const dockObserver = new IntersectionObserver(syncDock, { rootMargin: "-96px 0px 0px", threshold: 0 });
dockObserver.observe(hero);
if (!nativePopover) {
  panels.forEach(panel => { panel.hidden = true; });
  root.querySelectorAll("[popovertarget]").forEach(button => button.addEventListener("click", () => {
    const target = root.querySelector(`#${button.getAttribute("popovertarget")}`);
    const opening = target.hidden;
    panels.forEach(closePanel);
    target.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
  }, { signal }));
  document.addEventListener("pointerdown", event => {
    if (!panels.some(panel => panel.contains(event.target)) && !event.target.closest("[popovertarget]")) panels.forEach(closePanel);
  }, { signal });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const open = panels.find(panel => !panel.hidden);
    if (!open) return;
    closePanel(open);
    root.querySelector(`[popovertarget="${open.id}"]`).focus();
  }, { signal });
}
root.querySelector("[data-open-mixer]").addEventListener("click", () => {
  mixer.open = true;
  panels.forEach(closePanel);
  requestAnimationFrame(() => mixer.querySelector("summary").focus({ preventScroll: true }));
}, { signal });
root.querySelectorAll(".chapter-menu a").forEach(link => link.addEventListener("click", () => panels.forEach(closePanel), { signal }));
root.addEventListener("focusout", () => requestAnimationFrame(syncDock), { signal });
syncDock();
const motionButton = root.querySelector("[data-motion-toggle]");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");
let motionPaused = reduceMotion.matches;
let frozenScrollBeat = null;
let pointerFrame = 0;
let sceneFrame = 0;
let desiredPointer = { x: 0, y: 0 };
function paintScenes(timestamp) {
  sceneFrame = 0;
  if (!scoreRibbonStoryboardMode) updateScoreThread();
  const snapshot = audio.snapshot?.() ?? null;
  const mainBounds = root.getBoundingClientRect();
  const visible = mainBounds.bottom >= 0 && mainBounds.top <= innerHeight;
  if (visible && !scoreRibbonStoryboardMode && !scoreRibbonTransitionMode && !scoreGpuScrollMode) {
    const chapter = root.dataset.activeMovement ?? "opening";
    // Silence uses the page's reading position as a visual-only score cursor.
    // Playback remains authoritative whenever audio is active.
    const scrollBeat = frozenScrollBeat ?? score.bars * score.beatsPerBar * clamp(-mainBounds.top / Math.max(1, root.offsetHeight - innerHeight), 0, 1);
    const result = visual.update({ chapter, scrollBeat, motionEnabled: !motionPaused && !reduceMotion.matches, reducedMotion: reduceMotion.matches, playbackSnapshot: snapshot });
    if (!scoreGridStudyMode && chapter === "music" && result && !result.frozen) {
      const excerptElement = root.querySelector("[data-score-excerpt]");
      if (excerptElement && result.bars.length) {
        const first = result.bars[0];
        const last = result.bars.at(-1);
        const excerptText = first === last ? `${labels.bar} ${first}` : `${labels.bars} ${first}–${last}`;
        const label = snapshot?.state === "off" ? `${labels.preview} · ${excerptText}` : excerptText;
        if (excerptElement.textContent !== label) excerptElement.textContent = label;
      }
    }
  } else if (visible && scoreGpuScrollMode && updateGpuScroll) {
    const result = updateGpuScroll({
      chapter: root.dataset.activeMovement ?? "opening",
      pose: scoreGpuPose,
      zoom: gpuEditorialFrame.zoom,
      frameOffset: gpuEditorialFrame.offset,
      motionEnabled: !motionPaused && !reduceMotion.matches,
      reducedMotion: reduceMotion.matches,
      playbackSnapshot: snapshot,
      timestamp,
    });
    if (root.dataset.activeMovement === "music" && result) {
      const excerptElement = root.querySelector("[data-score-excerpt]");
      if (excerptElement) {
        const excerptText = result.firstBar === result.lastBar
          ? `${labels.bar} ${result.firstBar}` : `${labels.bars} ${result.firstBar}–${result.lastBar}`;
        const label = result.playbackActive ? excerptText : `${labels.preview} · ${excerptText}`;
        if (excerptElement.textContent !== label) excerptElement.textContent = label;
      }
    }
  } else if (visible && scoreRibbonTransitionMode && updateRibbonTransition) {
    updateRibbonTransition({
      progress: scoreTransitionProgress,
      motionEnabled: !motionPaused && !reduceMotion.matches,
      reducedMotion: reduceMotion.matches,
      playbackSnapshot: snapshot,
    });
  }
  if (snapshot && Math.floor(snapshot.seconds) !== lastDisplaySecond) {
    lastDisplaySecond = Math.floor(snapshot.seconds);
    syncMixer(snapshot);
  }
  if (visible && !scoreRibbonStoryboardMode && audio.playing && !motionPaused && !reduceMotion.matches) requestScene();
}
function requestScene() {
  if (!sceneFrame && !document.hidden) sceneFrame = requestAnimationFrame(timestamp => paintScenes(timestamp));
}
function invalidateScoreLayout() {
  scoreThreadNeedsMeasure = true;
  scoreGpuOffsetsNeedMeasure = true;
  requestScene();
}
function applyPointer() {
  pointerFrame = 0;
  const { x, y } = motionPaused || reduceMotion.matches || !finePointer.matches ? { x: 0, y: 0 } : desiredPointer;
  hero.style.setProperty("--light-x", `${x * 8}px`);
  hero.style.setProperty("--light-y", `${y * 8}px`);
  hero.style.setProperty("--near-x", `${x * 3}px`);
  hero.style.setProperty("--near-y", `${y * 3}px`);
}
function syncMotion() {
  motionButton.hidden = reduceMotion.matches;
  document.documentElement.dataset.motionPaused = String(motionPaused);
  motionButton.setAttribute("aria-pressed", String(motionPaused));
  motionButton.textContent = motionPaused ? labels.resumeMotion : labels.motion;
  frozenScrollBeat = motionPaused
    ? score.bars * score.beatsPerBar * clamp(-root.getBoundingClientRect().top / Math.max(1, root.offsetHeight - innerHeight), 0, 1)
    : null;
  applyPointer();
  if (!motionPaused && !reduceMotion.matches) {
    invalidateScoreLayout();
  }
  requestScene();
}
motionButton.addEventListener("click", () => { motionPaused = !motionPaused; syncMotion(); }, { signal });
reduceMotion.addEventListener("change", () => { motionPaused = reduceMotion.matches; syncMotion(); }, { signal });
finePointer.addEventListener("change", applyPointer, { signal });
hero.addEventListener("pointermove", event => {
  if (motionPaused || reduceMotion.matches || !finePointer.matches) return;
  const bounds = hero.getBoundingClientRect();
  desiredPointer = { x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) };
  if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
}, { signal, passive: true });
hero.addEventListener("pointerleave", () => { desiredPointer = { x: 0, y: 0 }; applyPointer(); }, { signal });
syncMotion();

const links = [...root.querySelectorAll(".journey-nav a")];
let activeMovement = "opening";
function selectMovement() {
  const line = Math.max(180, window.innerHeight * .35);
  let active = chapters[0];
  for (const chapter of chapters) {
    if (chapter.getBoundingClientRect().top <= line) active = chapter;
  }
  const movement = active.dataset.movement;
  root.dataset.activeMovement = movement;
  if (movement !== activeMovement) {
    activeMovement = movement;
    if (movement !== "closing") audio.setMovement(movement);
  }
  links.forEach(link => {
    if (link.hash === `#${movement}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  syncDock();
}
const observer = new IntersectionObserver(selectMovement, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
chapters.forEach(chapter => observer.observe(chapter));
window.addEventListener("scrollend", selectMovement, { signal });
window.addEventListener("scroll", requestScene, { signal, passive: true });
window.addEventListener("resize", () => { selectMovement(); invalidateScoreLayout(); }, { signal });
window.addEventListener("hashchange", () => { selectMovement(); invalidateScoreLayout(); }, { signal });
root.querySelectorAll("details").forEach(details => details.addEventListener("toggle", invalidateScoreLayout, { signal }));
document.fonts?.ready.then(invalidateScoreLayout);
selectMovement();
requestScene();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.pause();
    cancelAnimationFrame(pointerFrame); pointerFrame = 0;
    cancelAnimationFrame(sceneFrame); sceneFrame = 0;
  } else requestScene();
}, { signal });
// A BFCache restoration keeps the controls mounted, but never resumes sound.
window.addEventListener("pagehide", event => {
  audio.pause();
  if (event.persisted) return;
  clearInterval(displayTimer);
  controller.abort(); observer.disconnect(); dockObserver.disconnect(); revealObserver?.disconnect(); cancelAnimationFrame(pointerFrame); cancelAnimationFrame(sceneFrame);
  experiments.dispose(); visual.dispose(); audio.dispose(); disposeRibbonTransition?.(); disposeGpuScroll?.();
}, { signal });

if (scoreGridStudyMode) {
  import("./score-grid-study.js");
}

if (scoreRibbonStudyMode) {
  import("./score-ribbon-study.js");
}

if (scoreRibbonStoryboardMode) {
  import("./score-ribbon-storyboard.js?v=code-frame-1");
}

if (scoreRibbonTransitionMode) {
  import("./score-ribbon-transition.js?v=spatial-fold-2").then(module => {
    updateRibbonTransition = module.updateScoreRibbonTransition;
    disposeRibbonTransition = module.disposeScoreRibbonTransition;
    requestScene();
  }).catch(error => {
    delete document.body.dataset.scoreRibbonTransition;
    console.error("A prévia da fita musical não carregou.", error);
  });
}

if (scoreGpuScrollMode) {
  import("./score-gpu-scroll.js?v=study-marker-hidden-1").then(module => module.mountAboutGpuScroll(root)).then(runtime => {
    updateGpuScroll = runtime.update;
    disposeGpuScroll = runtime.dispose;
    invalidateScoreLayout();
  }).catch(error => {
    console.error("The GPU score could not load; falling back to the Canvas score transition.", error);
    import("./score-ribbon-transition.js?v=canvas-fallback-1").then(module => {
      updateRibbonTransition = module.updateScoreRibbonTransition;
      disposeRibbonTransition = module.disposeScoreRibbonTransition;
      requestScene();
    });
  });
}
