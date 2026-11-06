import { score } from "./score.js?v=a1c14c40";
import { createJourneyAudio, playbackPositionForDisplay } from "./audio.js";
import { mountExperiments } from "./experiments.js";
import { createScoreVisual } from "./score-visual.js";

const root = document.querySelector(".about-main");
const isPortuguese = document.documentElement.lang === "pt-BR";
const labels = isPortuguese ? {
  listen: "Ouvir", heroListen: "Ouvir Dissonância", resume: "Continuar", replay: "Ouvir de novo", pause: "Pausar", loading: "Iniciando…", off: "Som desligado",
  paused: "Som pausado · retome quando quiser", error: "Não foi possível ativar o som. Tente ouvir novamente.",
  unavailable: "Som indisponível neste navegador. A página continua em silêncio.",
  playing: "Tocando", finished: "Música concluída", next: "próximo compasso", muted: "Volume em zero", motion: "Pausar movimento", resumeMotion: "Retomar movimento",
} : {
  listen: "Listen", heroListen: "Listen to Dissonância", resume: "Continue", replay: "Play again", pause: "Pause", loading: "Starting…", off: "Sound is off",
  paused: "Sound paused · resume when you like", error: "Sound could not start. Try listening again.",
  unavailable: "Sound is unavailable in this browser. Explore in silence.",
  playing: "Playing", finished: "Piece finished", next: "next bar", muted: "Volume at zero", motion: "Pause motion", resumeMotion: "Resume motion",
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
const visual = createScoreVisual(root, score);
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
let pointerFrame = 0;
let sceneFrame = 0;
let desiredPointer = { x: 0, y: 0 };
function paintScenes() {
  sceneFrame = 0;
  const snapshot = audio.snapshot?.() ?? null;
  let visible = false;
  for (const host of root.querySelectorAll("[data-score-scene]")) {
    const bounds = host.closest("section").getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > innerHeight) continue;
    visible = true;
    const progress = Math.max(0, Math.min(1, (innerHeight - bounds.top) / (innerHeight + bounds.height)));
    visual.update({ chapter: host.dataset.scoreScene, progress, motionEnabled: !motionPaused && !reduceMotion.matches, playbackSnapshot: snapshot });
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

const chapters = [...root.querySelectorAll("[data-movement]")];
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
window.addEventListener("resize", selectMovement, { signal });
window.addEventListener("resize", requestScene, { signal });
window.addEventListener("hashchange", selectMovement, { signal });
window.addEventListener("hashchange", requestScene, { signal });
root.querySelector(".stack-more").addEventListener("toggle", requestScene, { signal });
document.fonts?.ready.then(requestScene);
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
  controller.abort(); observer.disconnect(); dockObserver.disconnect(); cancelAnimationFrame(pointerFrame); cancelAnimationFrame(sceneFrame);
  experiments.dispose(); visual.dispose(); audio.dispose();
}, { signal });
