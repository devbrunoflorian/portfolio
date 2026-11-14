import { createJourneyAudio } from "../about-legacy/audio.js";
import { score } from "../about-legacy/score.js";
import { readingChapterIndex } from "./scene/reading.js";
import { mountStackCarousel } from "./stack-carousel.js?v=stack-category-carousel-5";

const page = document.querySelector("[data-about-page]");
if (!page) throw new Error("About root is missing");
const stackCarousel = mountStackCarousel(page);

const english = document.documentElement.lang.startsWith("en");
const scoreCaption = page.querySelector(".score-frame figcaption > span");
const staticCaption = scoreCaption?.textContent;
const initialStatus = page.querySelector("[data-audio-status]")?.textContent.trim() ?? "Sound is off";
const statusLabels = [...page.querySelectorAll("[data-audio-status]")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const opening = page.querySelector(".about-opening");
const nativeOpeningFade = CSS.supports(
  "(view-timeline: --opening-exit block) and (animation-timeline: --opening-exit) and (animation-range: exit 12% exit 72%)",
);
if (opening && !nativeOpeningFade) opening.dataset.openingFadeFallback = "true";
const chapters = [...page.querySelectorAll("[data-chapter]")];
const audio = createJourneyAudio(score, renderPlayback);
let activeChapter = "opening";
let framePending = false;
let motionPaused = false;
let pageDisposed = false;
const initialMix = new Map(score.tracks.map(track => [track.id, audio.getTrackVolume(track.id)]));

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function renderPlayback(state) {
  window.dispatchEvent(new CustomEvent("about-audio-state", { detail: state }));
  const status = state.state === "playing" || state.state === "paused"
    ? `${state.state === "paused" ? (english ? "Paused · " : "Pausado · ") : ""}${state.section} · ${formatTime(audio.snapshot().seconds)}`
    : state.state === "error" || state.state === "unavailable"
      ? (english ? "Audio unavailable" : "Áudio indisponível")
      : initialStatus;
  statusLabels.forEach(label => { label.textContent = status; });
  requestSceneFrame();
}

function togglePlayback() {
  if (audio.playing || audio.snapshot().state === "starting") audio.pause();
  else void audio.start();
}

function handleAudioCommand(event) {
  if (pageDisposed) return;
  /** @type {import("../../src/components/about/audio-contract").AudioCommand} */
  const command = event.detail;
  if (!command || typeof command.type !== "string") return;
  switch (command.type) {
    case "toggle":
      togglePlayback();
      break;
    case "track-volume":
      audio.setTrackVolume(Number(command.trackId), Number(command.value));
      break;
    case "master-volume":
      audio.setVolume(Number(command.value));
      break;
    case "repeat":
      audio.setRepeat(Boolean(command.value));
      break;
    case "restore-tracks":
      for (const [id, value] of initialMix) audio.setTrackVolume(id, value);
      break;
    case "restart":
      audio.restart();
      requestSceneFrame();
      break;
  }
}
window.addEventListener("about-audio-command", handleAudioCommand);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function updateOpeningFadeFallback() {
  if (!opening || nativeOpeningFade) return;
  if (reducedMotion.matches) {
    opening.style.setProperty("--opening-image-opacity", "1");
    return;
  }

  const { top, height } = opening.getBoundingClientRect();
  const exitProgress = clamp(-top / Math.max(1, height), 0, 1);
  const fadeProgress = clamp(exitProgress / .6, 0, 1);
  const opacity = (1 - fadeProgress).toFixed(3);
  if (opening.style.getPropertyValue("--opening-image-opacity") !== opacity) {
    opening.style.setProperty("--opening-image-opacity", opacity);
  }
}

function updateScrollScene() {
  framePending = false;
  if (pageDisposed) return;
  updateOpeningFadeFallback();
  const index = readingChapterIndex(chapters.map(chapter => chapter.getBoundingClientRect()), innerHeight * .52);
  if (index >= 0) {
    activeChapter = chapters[index].dataset.chapter;
    if (page.dataset.activeChapter !== activeChapter) page.dataset.activeChapter = activeChapter;
  }
  const journey = page.querySelector("[data-about-journey]");
  if (journey?.dataset.journeyMode === "pinned") {
    const bounds = journey.getBoundingClientRect();
    if (bounds.top <= 0 && bounds.bottom >= innerHeight) {
      activeChapter = journey.dataset.currentChapter ?? "music";
      page.dataset.activeChapter = activeChapter;
    }
  }
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
  if (audio.playing) requestSceneFrame();
}

function requestSceneFrame() {
  if (pageDisposed || framePending || document.hidden) return;
  framePending = true;
  requestAnimationFrame(updateScrollScene);
}
window.addEventListener("scroll", requestSceneFrame, { passive: true });
window.addEventListener("about-journey-change", requestSceneFrame);
window.addEventListener("resize", () => {
  requestSceneFrame();
}, { passive: true });
reducedMotion.addEventListener?.("change", requestSceneFrame);

const motionButton = page.querySelector("[data-motion-toggle]");
motionButton?.addEventListener("click", () => {
  motionPaused = !motionPaused;
  page.dataset.visualPaused = String(motionPaused);
  document.documentElement.dataset.motionPaused = String(motionPaused);
  motionButton.setAttribute("aria-pressed", String(motionPaused));
  const label = motionPaused
    ? (english ? "Resume movement" : "Retomar movimento")
    : (english ? "Pause movement" : "Pausar movimento");
  motionButton.setAttribute("aria-label", label);
  motionButton.setAttribute("title", label);
  for (const icon of motionButton.querySelectorAll("[data-motion-icon]")) {
    icon.style.display = icon.dataset.motionIcon === "resume"
      ? (motionPaused ? "" : "none")
      : (motionPaused ? "none" : "");
  }
  stackCarousel.setMotionPaused(motionPaused);
  requestSceneFrame();
});

for (const disclosure of page.querySelectorAll("details")) {
  disclosure.addEventListener("toggle", () => {
    requestSceneFrame();
  });
}
const layoutObserver = new ResizeObserver(() => {
  requestSceneFrame();
});
layoutObserver.observe(page);
document.fonts.ready.then(() => {
  if (pageDisposed) return;
  requestSceneFrame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  else requestSceneFrame();
});
window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  framePending = false;
  stackCarousel.setMotionPaused(motionPaused);
  requestSceneFrame();
});
window.addEventListener("pagehide", event => {
  if (event.persisted) {
    audio.pause();
    stackCarousel.setMotionPaused(true);
    return;
  }
  pageDisposed = true;
  window.removeEventListener("about-audio-command", handleAudioCommand);
  window.removeEventListener("about-journey-change", requestSceneFrame);
  document.documentElement.classList.remove("about-world-open");
  layoutObserver.disconnect();
  stackCarousel.dispose();
  audio.dispose();
});
requestSceneFrame();
