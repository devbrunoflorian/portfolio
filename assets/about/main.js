import { score } from "./score.js?v=a1c14c40";
import { createJourneyAudio, playbackPositionForDisplay } from "./audio.js";
import { mountExperiments } from "./experiments.js";
import { createScoreVisual, scoreStageOffset } from "./score-visual.js";

const root = document.querySelector(".about-main");
const chapters = [...root.querySelectorAll("[data-movement]")];
const scoreThread = root.querySelector("[data-score-thread]");
const scoreLeads = root.querySelector("[data-score-leads]");
const scoreCameraStops = [
  { x: -.09, y: 0, scale: 1.08, opacity: .17, lead: .05, rotate: 0 },
  { x: .075, y: 0, scale: .94, opacity: .085, lead: .06, rotate: 0 },
  { x: 0, y: 0, scale: 1, opacity: .38, lead: .86, rotate: 0 },
  { x: -.065, y: 0, scale: 1.06, opacity: .16, lead: 0, rotate: 0 },
  { x: .075, y: 0, scale: .93, opacity: .075, lead: .04, rotate: 0 },
  { x: 0, y: 0, scale: .9, opacity: .06, lead: 0, rotate: 0 },
];
const scoreCameraAnchors = {
  opening: ".hero-field",
  code: ".code-stack",
  music: ".score-stage-spacer",
  art: ".art-experiment",
  games: ".games-experiment",
  closing: ".closing-links",
};
let scoreThreadCenters = [];
let scoreThreadNeedsMeasure = true;
let scoreThreadLastScrollY = Number.NaN;
let scoreThreadLastStyle = "";
let scoreLayoutRevision = 0;
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function scoreProgressForScroll() {
  const bounds = root.getBoundingClientRect();
  const rootTop = bounds.top + window.scrollY;
  const scrollRange = Math.max(1, bounds.height - window.innerHeight);
  return clamp((window.scrollY - rootTop) / scrollRange, 0, 1);
}
function scoreBeatForScroll() {
  return scoreProgressForScroll() * score.bars * score.beatsPerBar;
}
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
  const before = scoreCameraStops[Math.max(0, index - 1)][key];
  const start = scoreCameraStops[index][key];
  const end = scoreCameraStops[index + 1][key];
  const after = scoreCameraStops[Math.min(scoreCameraStops.length - 1, index + 2)][key];
  const squared = progress * progress;
  const cubed = squared * progress;
  const value = .5 * (2 * start + (-before + end) * progress + (2 * before - 5 * start + 4 * end - after) * squared + (-before + 3 * start - 3 * end + after) * cubed);
  return clamp(value, Math.min(start, end), Math.max(start, end));
}
function updateScoreThread(force = false) {
  if (!scoreThread || motionPaused || reduceMotion.matches) return;
  const scrollY = window.scrollY;
  if (!force && !scoreThreadNeedsMeasure && scrollY === scoreThreadLastScrollY) return;
  if (force || scoreThreadNeedsMeasure || scoreThreadCenters.length !== chapters.length) {
    scoreThreadCenters = chapters.map(chapter => {
      const bounds = chapter.getBoundingClientRect();
      return bounds.top + scrollY + bounds.height / 2;
    });
    scoreThreadNeedsMeasure = false;
  }
  scoreThreadLastScrollY = scrollY;
  const storyPoint = scrollY + window.innerHeight * .52;
  let index = 0;
  while (index < scoreThreadCenters.length - 2 && storyPoint > scoreThreadCenters[index + 1]) index += 1;
  const start = scoreThreadCenters[index] ?? 0;
  const end = scoreThreadCenters[index + 1] ?? start + 1;
  const progress = clamp((storyPoint - start) / Math.max(1, end - start), 0, 1);
  const mainBounds = root.getBoundingClientRect();
  const enter = clamp((window.innerHeight - mainBounds.top) / (window.innerHeight * .42), 0, 1);
  const leave = clamp(mainBounds.bottom / (window.innerHeight * .42), 0, 1);
  const visibility = Math.min(enter, leave);
  const values = {
    x: cameraValue("x", index, progress),
    y: cameraValue("y", index, progress),
    scale: cameraValue("scale", index, progress),
    opacity: cameraValue("opacity", index, progress) * visibility,
    lead: cameraValue("lead", index, progress) * visibility,
    rotate: cameraValue("rotate", index, progress),
  };
  const startOffset = scoreStageOffset(scoreAnchorFor(chapters[index]), values.scale);
  const endOffset = scoreStageOffset(scoreAnchorFor(chapters[index + 1]), values.scale);
  const y = values.y * window.innerHeight + startOffset + (endOffset - startOffset) * progress;
  const signature = `${values.x.toFixed(4)}|${y.toFixed(2)}|${values.scale.toFixed(4)}|${values.opacity.toFixed(4)}|${values.lead.toFixed(4)}|${values.rotate.toFixed(3)}`;
  if (signature === scoreThreadLastStyle) return;
  scoreThreadLastStyle = signature;
  scoreThread.style.setProperty("--thread-x", `${(values.x * 100).toFixed(3)}vw`);
  scoreThread.style.setProperty("--thread-y", `${y.toFixed(2)}px`);
  scoreThread.style.setProperty("--thread-scale", values.scale.toFixed(4));
  scoreThread.style.setProperty("--thread-opacity", values.opacity.toFixed(4));
  scoreThread.style.setProperty("--thread-rotate", `${values.rotate.toFixed(3)}deg`);
  scoreLeads.style.setProperty("--thread-x", `${(values.x * 100).toFixed(3)}vw`);
  scoreLeads.style.setProperty("--thread-y", `${y.toFixed(2)}px`);
  scoreLeads.style.setProperty("--thread-scale", values.scale.toFixed(4));
  scoreLeads.style.setProperty("--thread-rotate", `${values.rotate.toFixed(3)}deg`);
  scoreLeads.style.setProperty("--lead-opacity", values.lead.toFixed(4));
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
function paintScenes() {
  sceneFrame = 0;
  updateScoreThread();
  const snapshot = audio.snapshot?.() ?? null;
  const mainBounds = root.getBoundingClientRect();
  const visible = mainBounds.bottom >= 0 && mainBounds.top <= innerHeight;
  if (visible) {
    const chapter = root.dataset.activeMovement ?? "opening";
    const activeChapter = chapters.find(item => item.dataset.movement === chapter) ?? chapters[0];
    const chapterBounds = activeChapter.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight - chapterBounds.top) / (innerHeight + chapterBounds.height)));
    const scrollBeat = motionPaused || reduceMotion.matches ? frozenScrollBeat ?? scoreBeatForScroll() : scoreBeatForScroll();
    const result = visual.update({ chapter, progress, scrollBeat, motionEnabled: !motionPaused && !reduceMotion.matches, reducedMotion: reduceMotion.matches, playbackSnapshot: snapshot, layoutRevision: scoreLayoutRevision });
    if (chapter === "music" && result && !result.frozen) {
      const excerptElement = root.querySelector("[data-score-excerpt]");
      if (excerptElement && result.bars.length) {
        const first = result.bars[0];
        const last = result.bars.at(-1);
        const excerptText = first === last ? `${labels.bar} ${first}` : `${labels.bars} ${first}–${last}`;
        const label = snapshot?.state === "off" ? `${labels.preview} · ${excerptText}` : excerptText;
        if (excerptElement.textContent !== label) excerptElement.textContent = label;
      }
    }
  }
  if (snapshot && Math.floor(snapshot.seconds) !== lastDisplaySecond) {
    lastDisplaySecond = Math.floor(snapshot.seconds);
    syncMixer(snapshot);
  }
  if (visible && audio.playing && !motionPaused && !reduceMotion.matches) requestScene();
}
function requestScene() {
  if (!sceneFrame && !document.hidden) sceneFrame = requestAnimationFrame(paintScenes);
}
function invalidateScoreLayout() {
  scoreThreadNeedsMeasure = true;
  scoreLayoutRevision += 1;
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
  applyPointer();
  if (motionPaused || reduceMotion.matches) {
    if (frozenScrollBeat === null) frozenScrollBeat = scoreBeatForScroll();
  } else {
    frozenScrollBeat = null;
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
  experiments.dispose(); visual.dispose(); audio.dispose();
}, { signal });
