import { score } from "./score.js";
import { createJourneyAudio } from "./audio.js";
import { mountExperiments } from "./experiments.js";

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
const soundButton = root.querySelector("[data-sound-toggle]");
const audio = createJourneyAudio(score, status => {
  const active = status.state === "playing" || status.state === "starting";
  soundButton.setAttribute("aria-pressed", String(active));
  soundButton.setAttribute("aria-busy", String(status.state === "starting"));
  root.querySelector("[data-sound-label]").textContent = status.state === "starting" ? labels.loading : active ? labels.pause : labels.listen;
  root.querySelector("[data-audio-status]").textContent = status.state === "playing"
    ? `${status.volume === 0 ? labels.muted : labels.playing} · ${status.section} · ${movementNames[status.movement]}${status.pending ? ` → ${movementNames[status.pending]} (${labels.next})` : ""}`
    : labels[status.state] ?? labels.off;
});
const experiments = mountExperiments(root, audio, isPortuguese);
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

const hero = root.querySelector(".about-hero");
const motionButton = root.querySelector("[data-motion-toggle]");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");
let motionPaused = reduceMotion.matches;
let pointerFrame = 0;
let desiredPointer = { x: 0, y: 0 };
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
window.addEventListener("resize", selectMovement, { signal });
window.addEventListener("hashchange", selectMovement, { signal });
selectMovement();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.pause();
    cancelAnimationFrame(pointerFrame); pointerFrame = 0;
  }
}, { signal });
// A BFCache restoration keeps the controls mounted, but never resumes sound.
window.addEventListener("pagehide", event => {
  audio.pause();
  if (event.persisted) return;
  controller.abort(); observer.disconnect(); cancelAnimationFrame(pointerFrame);
  experiments.dispose(); audio.dispose();
}, { signal });
