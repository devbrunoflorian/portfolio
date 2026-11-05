import { score } from "./score.js";
import { createJourneyAudio, playbackPositionForDisplay } from "./audio.js";
import { mountExperiments } from "./experiments.js";
import { createScoreVisual } from "./score-visual.js";

const root = document.querySelector(".about-main");
const isPortuguese = document.documentElement.lang === "pt-BR";
const labels = isPortuguese ? {
  listen: "Ouvir o percurso", pause: "Pausar som", loading: "Ativando som…", off: "Som desligado",
  paused: "Som pausado · retome quando quiser", error: "Não foi possível ativar o som. Tente ouvir novamente.",
  unavailable: "Som indisponível neste navegador. A página continua em silêncio.",
  playing: "Tocando", finished: "Música concluída", next: "próximo compasso", muted: "Volume em zero", motion: "Pausar movimento", resumeMotion: "Retomar movimento",
} : {
  listen: "Listen to the journey", pause: "Pause sound", loading: "Starting sound…", off: "Sound is off",
  paused: "Sound paused · resume when you like", error: "Sound could not start. Try listening again.",
  unavailable: "Sound is unavailable in this browser. Explore in silence.",
  playing: "Playing", finished: "Piece finished", next: "next bar", muted: "Volume at zero", motion: "Pause motion", resumeMotion: "Resume motion",
};
const movementNames = { opening: "Dissonância", code: "Code / lo-fi", music: "Music / Dissonância", art: "Art / legato", games: "Games / 8-bit" };
const sectionNames = isPortuguese ? {} : {
  "Verso I": "Verse I", "Ponte I": "Bridge I", "Refrão I": "Chorus I",
  "Verso II": "Verse II", "Ponte II": "Bridge II", "Refrão II": "Chorus II", "Pós Refrão": "Post-Chorus",
};
const sectionName = name => sectionNames[name] ?? name;
const soundButton = root.querySelector("[data-sound-toggle]");
const audio = createJourneyAudio(score, status => {
  const active = status.state === "playing" || status.state === "starting";
  soundButton.setAttribute("aria-pressed", String(active));
  soundButton.setAttribute("aria-busy", String(status.state === "starting"));
  root.querySelector("[data-sound-label]").textContent = status.state === "starting" ? labels.loading : active ? labels.pause : labels.listen;
  root.querySelector("[data-audio-status]").textContent = status.state === "playing"
    ? `${status.volume === 0 ? labels.muted : labels.playing} · ${sectionName(status.section)} · ${movementNames[status.movement]}${status.pending ? ` → ${movementNames[status.pending]} (${labels.next})` : ""}`
    : labels[status.state] ?? labels.off;
  syncMixer(audio.snapshot?.());
  requestScene();
});
const experiments = mountExperiments(root, audio, isPortuguese);
const visual = createScoreVisual(root, score);
const controller = new AbortController();
const { signal } = controller;
soundButton.addEventListener("click", () => audio.enabled ? audio.pause() : audio.start(), { signal });
root.querySelector("[data-audio-restart]").addEventListener("click", () => audio.restart(), { signal });
root.querySelector("[data-audio-repeat]").addEventListener("click", event => {
  const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(next));
  audio.setRepeat(next);
}, { signal });
root.querySelector("[data-volume]").addEventListener("input", event => audio.setVolume(Number(event.target.value) / 100), { signal });
root.querySelectorAll("[data-enhanced]").forEach(element => { element.hidden = false; });

const layerNames = isPortuguese
  ? { guitar: "Guitarra", vocal: "Voz instrumental", strings: "Cordas", bass: "Baixo", percussion: "Percussão" }
  : { guitar: "Guitar", vocal: "Instrumental voice", strings: "Strings", bass: "Bass", percussion: "Percussion" };
const mixer = root.querySelector("[data-layer-mixer]");
const layerButtons = mixer.querySelector(".music-layer-buttons");
const trackRanges = new Map(score.tracks.map(track => [track.id, { first: Infinity, end: 0 }]));
for (const note of score.notes) {
  const range = trackRanges.get(note.track);
  range.first = Math.min(range.first, note.beat);
  range.end = Math.max(range.end, note.beat + note.duration);
}
let chosenLayer = null;
let lastDisplaySecond = -1;
const allButton = document.createElement("button");
allButton.type = "button";
allButton.textContent = isPortuguese ? "Mix original" : "Original mix";
layerButtons.append(allButton);
const trackButtons = new Map();
for (const track of score.tracks) {
  const button = document.createElement("button");
  button.type = "button";
  const label = layerNames[track.voice] + (track.voice === "vocal" ? ` ${track.name.endsWith("II") ? "II" : "I"}` : "");
  const first = trackRanges.get(track.id).first;
  const entry = score.sections.findLast(section => section.beat <= first)?.name ?? "Intro";
  button.textContent = first ? `${label} · ${sectionName(entry)}` : label;
  button.dataset.layer = String(track.id);
  trackButtons.set(track.id, { button, label });
  layerButtons.append(button);
  button.addEventListener("click", () => { chosenLayer = track.id; audio.highlightTrack(track.id); syncMixer(audio.snapshot()); }, { signal });
}
allButton.addEventListener("click", () => { chosenLayer = null; audio.highlightTrack(null); syncMixer(audio.snapshot()); }, { signal });
function formatTime(seconds, round = false) {
  const safeSeconds = Math.max(0, seconds);
  const time = round ? Math.round(safeSeconds) : Math.floor(safeSeconds);
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
}
function syncMixer(snapshot) {
  if (!snapshot) return;
  const span = score.bars * score.beatsPerBar;
  const { beat: songBeat, seconds: currentSeconds } = playbackPositionForDisplay(snapshot, score);
  if (chosenLayer !== null) {
    const range = trackRanges.get(chosenLayer);
    if (songBeat < range.first || songBeat >= range.end) { chosenLayer = null; audio.highlightTrack(null); }
  }
  allButton.setAttribute("aria-pressed", String(chosenLayer === null));
  for (const [id, { button }] of trackButtons) {
    const range = trackRanges.get(id);
    button.disabled = songBeat < range.first || songBeat >= range.end;
    button.setAttribute("aria-pressed", String(chosenLayer === id));
  }
  mixer.querySelector("[data-audio-position]").textContent = `${sectionName(snapshot.section)} · ${formatTime(currentSeconds, currentSeconds >= score.durationSeconds)} / ${formatTime(score.durationSeconds, true)}`;
  mixer.querySelector("[data-layer-status]").textContent = chosenLayer === null
    ? isPortuguese ? "A mix original está selecionada." : "The original mix is selected."
    : isPortuguese ? `Destaque: ${trackButtons.get(chosenLayer).label}. As outras camadas recuam.` : `Highlighting ${trackButtons.get(chosenLayer).label}. Other layers recede.`;
}
syncMixer(audio.snapshot?.() ?? { state: "off", beat: 0, seconds: 0, section: "Intro" });

const hero = root.querySelector(".about-hero");
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
  if (movement !== activeMovement) { activeMovement = movement; audio.setMovement(movement); }
  links.forEach(link => {
    if (link.hash === `#${movement}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
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
  controller.abort(); observer.disconnect(); cancelAnimationFrame(pointerFrame); cancelAnimationFrame(sceneFrame);
  experiments.dispose(); visual.dispose(); audio.dispose();
}, { signal });
