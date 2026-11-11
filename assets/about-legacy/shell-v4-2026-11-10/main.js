import { createJourneyAudio } from "../about-legacy/audio.js";
import { score } from "../about-legacy/score.js";

const root = document.querySelector(".about-main");
if (!root) throw new Error("About content is missing");

root.classList.add("about-v4");

const copy = {
  listen: root.querySelector("[data-play-label]")?.textContent.trim() ?? "Listen to Dissonância",
  pause: root.querySelector("[data-play-toggle]")?.dataset.pauseLabel ?? "Pause Dissonância",
  off: root.querySelector("[data-audio-status]")?.textContent.trim() ?? "Sound is off",
};
const playButtons = [...root.querySelectorAll("[data-play-toggle]")];
const audioStatuses = [...root.querySelectorAll("[data-audio-status]")];
const audio = createJourneyAudio(score, updateAudioState);
let activeChapter = "opening";
let frame = 0;
let visualPaused = false;
let audioSnapshot = audio.snapshot();
let focusReturn = null;

function updateAudioState(state) {
  audioSnapshot = state;
  const playing = state.state === "playing" || state.state === "starting";
  for (const button of playButtons) {
    const label = playing ? copy.pause : copy.listen;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(playing));
    const text = button.querySelector("[data-play-label]");
    if (text) text.textContent = label;
  }
  const status = state.state === "playing"
      ? `${state.section} · ${formatTime(state.seconds)}`
      : state.state === "error" || state.state === "unavailable"
        ? (document.documentElement.lang.startsWith("en") ? "Audio unavailable" : "Áudio indisponível")
        : copy.off;
  audioStatuses.forEach(node => { node.textContent = status; });
  if (state.state === "playing") requestFrame();
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

for (const button of playButtons) {
  button.addEventListener("click", () => {
    if (audio.playing) audio.pause();
    else audio.start();
  });
}

const mixer = root.querySelector("[data-track-mixer]");
if (mixer) {
  for (const track of score.tracks) {
    const label = document.createElement("label");
    label.className = "about-mixer-row";
    const name = document.createElement("span");
    name.textContent = track.name;
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1";
    range.step = ".01";
    range.value = String(audio.getTrackVolume(track.id) ?? .5);
    range.setAttribute("aria-label", `${track.name} volume`);
    const output = document.createElement("output");
    output.value = `${Math.round(Number(range.value) * 100)}%`;
    range.addEventListener("input", () => {
      const value = Number(range.value);
      audio.setTrackVolume(track.id, value);
      output.value = `${Math.round(value * 100)}%`;
    });
    label.append(name, range, output);
    mixer.append(label);
  }
}

const globalVolume = root.querySelector("[data-main-volume]");
if (globalVolume) globalVolume.addEventListener("input", () => audio.setVolume(Number(globalVolume.value)));

const chapterNodes = [...root.querySelectorAll("[data-chapter]")];
const chapterObserver = new IntersectionObserver(entries => {
  const active = entries
    .filter(entry => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!active) return;
  const chapter = active.target.dataset.chapter;
  if (chapter === activeChapter) return;
  activeChapter = chapter;
  root.dataset.activeChapter = chapter;
  audio.setMovement(chapter);
}, { rootMargin: "-42% 0px -42% 0px", threshold: [0, .15, .35, .6] });

chapterNodes.forEach(chapter => chapterObserver.observe(chapter));

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function updateScrollState() {
  frame = 0;
  const art = root.querySelector("[data-art-image]");
  if (art && !visualPaused && !reducedMotion.matches) {
    const section = art.closest("[data-chapter]");
    const bounds = section.getBoundingClientRect();
    const progress = (innerHeight * .5 - (bounds.top + bounds.height * .5)) / Math.max(1, innerHeight);
    art.style.setProperty("--art-parallax", `${Math.max(-1, Math.min(1, progress)) * 34}px`);
  }
  const dock = root.querySelector("[data-player-dock]");
  dock?.toggleAttribute("data-visible", scrollY > innerHeight * .6);
  if (audio.playing && !document.hidden) frame = requestAnimationFrame(updateScrollState);
}

function requestFrame() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(updateScrollState);
}

window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", requestFrame, { passive: true });
reducedMotion.addEventListener?.("change", requestFrame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  else requestFrame();
});

const motionButton = root.querySelector("[data-motion-toggle]");
motionButton?.addEventListener("click", () => {
  visualPaused = !visualPaused;
  motionButton.setAttribute("aria-pressed", String(visualPaused));
  motionButton.textContent = visualPaused
    ? (document.documentElement.lang.startsWith("en") ? "Resume visual movement" : "Retomar movimento visual")
    : (document.documentElement.lang.startsWith("en") ? "Pause visual movement" : "Pausar movimento visual");
  if (!visualPaused) requestFrame();
});

const world = root.querySelector("[data-world-dialog]");
const worldOpener = root.querySelector("[data-world-open]");
worldOpener?.addEventListener("click", () => {
  focusReturn = worldOpener;
  world?.showModal();
});
root.querySelectorAll("[data-world-close]").forEach(button => button.addEventListener("click", () => world?.close()));
world?.addEventListener("click", event => { if (event.target === world) world.close(); });
world?.addEventListener("close", () => focusReturn?.focus({ preventScroll: true }));

root.querySelectorAll("[data-visual-pause]").forEach(button => button.addEventListener("click", () => {
  visualPaused = !visualPaused;
  root.dataset.visualPaused = String(visualPaused);
  button.setAttribute("aria-pressed", String(visualPaused));
  if (!visualPaused) requestFrame();
}));

requestFrame();

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frame);
  chapterObserver.disconnect();
  audio.dispose();
}, { once: true });
