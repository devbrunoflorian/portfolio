import { createJourneyAudio } from "../about-legacy/audio.js";
import { score } from "../about-legacy/score.js";

const root = document.querySelector("[data-about-page]");
if (!root) throw new Error("About page root is missing");

const isEnglish = document.documentElement.lang.startsWith("en");
const playLabel = root.querySelector("[data-play-label]")?.textContent.trim() ?? "Listen to Dissonância";
const pauseLabel = root.querySelector("[data-play-toggle]")?.dataset.pauseLabel ?? "Pause Dissonância";
const initialStatus = root.querySelector("[data-audio-status]")?.textContent.trim() ?? "Sound is off";
const playButtons = [...root.querySelectorAll("[data-play-toggle]")];
const statusNodes = [...root.querySelectorAll("[data-audio-status]")];
const audio = createJourneyAudio(score, updateAudioState);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const chapters = [...root.querySelectorAll("[data-chapter]")];
let activeChapter = "opening";
let frame = 0;
let visualPaused = false;
let focusReturn = null;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function updateAudioState(state) {
  const playing = state.state === "playing" || state.state === "starting";
  for (const button of playButtons) {
    const label = playing ? pauseLabel : playLabel;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(playing));
    const text = button.querySelector("[data-play-label]");
    if (text) text.textContent = label;
  }

  const status = state.state === "playing"
    ? `${state.section} · ${formatTime(state.seconds)}`
    : state.state === "error" || state.state === "unavailable"
      ? (isEnglish ? "Audio unavailable" : "Áudio indisponível")
      : initialStatus;
  statusNodes.forEach(node => { node.textContent = status; });
  if (playing) requestFrame();
}

playButtons.forEach(button => button.addEventListener("click", () => {
  if (audio.playing) audio.pause();
  else audio.start();
}));

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
globalVolume?.addEventListener("input", () => audio.setVolume(Number(globalVolume.value)));

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
chapters.forEach(chapter => chapterObserver.observe(chapter));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateScrollState() {
  frame = 0;
  const bridge = root.querySelector("[data-material-bridge]");
  const artImage = root.querySelector("[data-art-image]");
  if (!visualPaused && !reducedMotion.matches) {
    if (bridge) {
      const bounds = bridge.getBoundingClientRect();
      const progress = clamp((innerHeight * .82 - bounds.top) / (bounds.height + innerHeight * .64), 0, 1);
      bridge.style.setProperty("--material-progress", progress.toFixed(4));
    }
    if (artImage) {
      const bounds = artImage.closest("[data-chapter]").getBoundingClientRect();
      const progress = (innerHeight * .5 - (bounds.top + bounds.height * .5)) / Math.max(1, innerHeight);
      artImage.style.setProperty("--art-parallax", `${clamp(progress, -1, 1) * 28}px`);
    }
  }

  root.querySelector("[data-player-dock]")?.toggleAttribute("data-visible", scrollY > innerHeight * .6);
  if (audio.playing && !document.hidden) {
    frame = requestAnimationFrame(updateScrollState);
  }
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
  document.documentElement.dataset.motionPaused = String(visualPaused);
  root.dataset.visualPaused = String(visualPaused);
  motionButton.setAttribute("aria-pressed", String(visualPaused));
  motionButton.textContent = visualPaused
    ? (isEnglish ? "Resume visual movement" : "Retomar movimento visual")
    : (isEnglish ? "Pause visual movement" : "Pausar movimento visual");
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

const firstWindow = root.querySelector("#music-mixer");
firstWindow?.addEventListener("toggle", requestFrame);
requestFrame();

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frame);
  chapterObserver.disconnect();
  audio.dispose();
}, { once: true });
