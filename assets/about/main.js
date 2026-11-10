import { createJourneyAudio } from "../about-legacy/audio.js";
import { score } from "../about-legacy/score.js";
import { mountAboutScene } from "./scene/runtime.js?v=about-pigment-2";

const page = document.querySelector("[data-about-page]");
if (!page) throw new Error("About root is missing");

const english = document.documentElement.lang.startsWith("en");
const playLabel = page.querySelector("[data-play-label]")?.textContent.trim() ?? "Listen";
const pauseLabel = page.querySelector("[data-play-toggle]")?.dataset.pauseLabel ?? "Pause";
const continueLabel = english ? "Continue Dissonância" : "Continuar Dissonância";
const scoreCaption = page.querySelector(".score-frame figcaption > span");
const staticCaption = scoreCaption?.textContent;
const initialStatus = page.querySelector("[data-audio-status]")?.textContent.trim() ?? "Sound is off";
const playButtons = [...page.querySelectorAll("[data-play-toggle]")];
const statusLabels = [...page.querySelectorAll("[data-audio-status]")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const nativeArtParallax = CSS.supports("(animation-timeline: view()) and (animation-range: entry)");
const chapters = [...page.querySelectorAll("[data-chapter]")];
const audio = createJourneyAudio(score, renderPlayback);
let activeChapter = "opening";
let framePending = false;
let motionPaused = false;
let restoreFocus = null;
let sceneRuntime = null;

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function renderPlayback(state) {
  const playing = state.state === "playing" || state.state === "starting";
  for (const button of playButtons) {
    const label = playing ? pauseLabel : state.state === "paused" ? continueLabel : playLabel;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(playing));
    const text = button.querySelector("[data-play-label]");
    if (text) text.textContent = label;
  }
  const status = state.state === "playing" || state.state === "paused"
    ? `${state.state === "paused" ? (english ? "Paused · " : "Pausado · ") : ""}${state.section} · ${formatTime(audio.snapshot().seconds)}`
    : state.state === "error" || state.state === "unavailable"
      ? (english ? "Audio unavailable" : "Áudio indisponível")
      : initialStatus;
  statusLabels.forEach(label => { label.textContent = status; });
  requestSceneFrame();
}

function togglePlayback() {
  if (audio.playing) audio.pause();
  else audio.start();
}
playButtons.forEach(button => button.addEventListener("click", togglePlayback));

const mixer = page.querySelector("[data-track-mixer]");
if (mixer) {
  for (const track of score.tracks) {
    const row = document.createElement("label");
    row.className = "about-mixer-row";
    const name = document.createElement("span");
    name.textContent = track.name;
    const control = document.createElement("input");
    control.type = "range";
    control.min = "0";
    control.max = "1";
    control.step = ".01";
    control.value = String(audio.getTrackVolume(track.id) ?? .5);
    control.setAttribute("aria-label", `${track.name} ${english ? "volume" : "volume"}`);
    const output = document.createElement("output");
    output.value = `${Math.round(Number(control.value) * 100)}%`;
    control.addEventListener("input", () => {
      const value = Number(control.value);
      audio.setTrackVolume(track.id, value);
      output.value = `${Math.round(value * 100)}%`;
    });
    row.append(name, control, output);
    mixer.append(row);
  }
}

page.querySelector("[data-main-volume]")?.addEventListener("input", event => {
  audio.setVolume(Number(event.currentTarget.value));
});

const chapterObserver = new IntersectionObserver(entries => {
  const current = entries
    .filter(entry => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!current) return;
  const nextChapter = current.target.dataset.chapter;
  if (nextChapter === activeChapter) return;
  activeChapter = nextChapter;
  page.dataset.activeChapter = nextChapter;
}, { rootMargin: "-42% 0px -42% 0px", threshold: [0, .15, .35, .6] });
chapters.forEach(chapter => chapterObserver.observe(chapter));

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function updateScrollScene() {
  framePending = false;
  const bridge = page.querySelector("[data-material-bridge]");
  const artImage = page.querySelector("[data-art-image]");
  if (!motionPaused && !reducedMotion.matches) {
    if (bridge) {
      const bounds = bridge.getBoundingClientRect();
      const progress = clamp((innerHeight * .82 - bounds.top) / (bounds.height + innerHeight * .64), 0, 1);
      const reveal = progress * progress * (3 - 2 * progress);
      bridge.style.setProperty("--material-progress", progress.toFixed(4));
      bridge.style.setProperty("--material-pigment", reveal.toFixed(4));
      bridge.style.setProperty("--paint-reveal", `${Math.round(reveal * 100)}%`);
      bridge.style.setProperty("--bridge-scale", (1.03 + reveal * .08).toFixed(3));
      bridge.style.setProperty("--bridge-rotation", `${(-4 + reveal * 4).toFixed(2)}deg`);
    }
    if (artImage && !nativeArtParallax) {
      const section = artImage.closest("[data-chapter]");
      const bounds = section.getBoundingClientRect();
      const position = (innerHeight * .5 - (bounds.top + bounds.height * .5)) / Math.max(1, innerHeight);
      artImage.style.setProperty("--art-parallax", `${clamp(position, -1, 1) * 24}px`);
    }
  }
  page.querySelector("[data-player-dock]")?.toggleAttribute("data-visible", scrollY > innerHeight * .58);
  const playbackSnapshot = audio.snapshot();
  if (playbackSnapshot.state === "playing") {
    const status = `${playbackSnapshot.section} · ${formatTime(playbackSnapshot.seconds)}`;
    for (const label of statusLabels) if (label.textContent !== status) label.textContent = status;
  }
  if (scoreCaption) {
    const caption = ["playing", "paused", "starting"].includes(playbackSnapshot.state)
      ? `Dissonância · ${playbackSnapshot.section}` : staticCaption;
    if (scoreCaption.textContent !== caption) scoreCaption.textContent = caption;
  }
  sceneRuntime?.update({
    chapter: activeChapter,
    motionEnabled: !motionPaused,
    reducedMotion: reducedMotion.matches,
    playbackSnapshot,
    timestamp: performance.now(),
  });
  if (audio.playing) requestSceneFrame();
}

function requestSceneFrame() {
  if (framePending || document.hidden) return;
  framePending = true;
  requestAnimationFrame(updateScrollScene);
}
window.addEventListener("scroll", requestSceneFrame, { passive: true });
window.addEventListener("resize", () => {
  sceneRuntime?.invalidate();
  requestSceneFrame();
}, { passive: true });
reducedMotion.addEventListener?.("change", requestSceneFrame);

const motionButton = page.querySelector("[data-motion-toggle]");
motionButton?.addEventListener("click", () => {
  motionPaused = !motionPaused;
  page.dataset.visualPaused = String(motionPaused);
  document.documentElement.dataset.motionPaused = String(motionPaused);
  motionButton.setAttribute("aria-pressed", String(motionPaused));
  motionButton.textContent = motionPaused
    ? (english ? "Resume movement" : "Retomar movimento")
    : (english ? "Pause movement" : "Pausar movimento");
  requestSceneFrame();
});

const worldDialog = page.querySelector("[data-world-dialog]");
const worldButton = page.querySelector("[data-world-open]");
worldButton?.addEventListener("click", () => {
  restoreFocus = worldButton;
  worldDialog?.showModal();
});
page.querySelectorAll("[data-world-close]").forEach(button => {
  button.addEventListener("click", () => worldDialog?.close());
});
worldDialog?.addEventListener("click", event => {
  if (event.target === worldDialog) worldDialog.close();
});
worldDialog?.addEventListener("close", () => restoreFocus?.focus({ preventScroll: true }));

for (const disclosure of page.querySelectorAll("details")) {
  disclosure.addEventListener("toggle", () => {
    sceneRuntime?.invalidate();
    requestSceneFrame();
  });
}
new ResizeObserver(() => {
  sceneRuntime?.invalidate();
  requestSceneFrame();
}).observe(page);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  else requestSceneFrame();
});
window.addEventListener("pagehide", () => {
  chapterObserver.disconnect();
  sceneRuntime?.dispose();
  audio.dispose();
}, { once: true });
mountAboutScene(page).then(runtime => {
  sceneRuntime = runtime;
  requestSceneFrame();
}).catch(error => {
  console.warn("The About score scene could not start; the chapter score remains available.", error);
});
requestSceneFrame();
