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
const nativeArtParallax = CSS.supports("(animation-timeline: view()) and (animation-range: entry)");
const chapters = [...page.querySelectorAll("[data-chapter]")];
const artImage = page.querySelector("[data-art-image]");
const artSection = artImage?.closest('[data-chapter="art"]');
const musicSection = page.querySelector('[data-chapter="music"]');
const audio = createJourneyAudio(score, renderPlayback);
let activeChapter = "opening";
let framePending = false;
let motionPaused = false;
let pendingMusicStart = false;
let artDissolve = 0;
let artDissolveRuntime = null;
let artDissolveLoad = null;
let restoreFocus = null;
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
  const state = audio.snapshot().state;
  if (audio.playing || state === "starting") {
    pendingMusicStart = false;
    audio.pause();
    return;
  }
  if (activeChapter === "music") {
    pendingMusicStart = false;
    void audio.start();
    return;
  }
  pendingMusicStart = true;
  page.querySelector('[data-chapter="music"]')?.scrollIntoView({
    behavior: reducedMotion.matches ? "auto" : "smooth",
    block: "center",
  });
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

function loadArtDissolve() {
  if (!artImage || artDissolveRuntime || artDissolveLoad || reducedMotion.matches) return;
  artDissolveLoad = import("./scene/art-dissolve.js?v=about-art-dissolve-2")
    .then(({ mountArtDissolve }) => mountArtDissolve(artImage, artDissolve))
    .then(runtime => {
      if (pageDisposed) { runtime.dispose(); return; }
      artDissolveRuntime = runtime;
      runtime.update(artDissolve, { reducedMotion: reducedMotion.matches, motionPaused });
    })
    .catch(error => {
      console.warn("The Art dissolve is unavailable; the original image remains visible.", error);
    });
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
  if (pendingMusicStart && activeChapter === "music") {
    pendingMusicStart = false;
    void audio.start();
  } else if (pendingMusicStart && ["art", "games", "closing"].includes(activeChapter)) {
    pendingMusicStart = false;
  }
  const artBounds = artSection?.getBoundingClientRect();
  const musicBounds = musicSection?.getBoundingClientRect();
  if (artImage && artBounds && musicBounds) {
    const readingLine = innerHeight * .5;
    const musicCenter = musicBounds.top + musicBounds.height * .5;
    const artCenter = artBounds.top + artBounds.height * .5;
    artDissolve = reducedMotion.matches
      ? Number(activeChapter === "art")
      : clamp((readingLine - musicCenter) / Math.max(1, artCenter - musicCenter), 0, 1);
    if (!reducedMotion.matches && (activeChapter === "music" || artDissolve > 0)) loadArtDissolve();
    artDissolveRuntime?.update(artDissolve, { reducedMotion: reducedMotion.matches, motionPaused });
  }
  if (!motionPaused && !reducedMotion.matches) {
    if (artImage && !nativeArtParallax) {
      const bounds = artBounds ?? artImage.closest("[data-chapter]")?.getBoundingClientRect();
      const position = bounds ? (innerHeight * .5 - (bounds.top + bounds.height * .5)) / Math.max(1, innerHeight) : 0;
      artImage.style.setProperty("--art-parallax", `${clamp(position, -1, 1) * 24}px`);
    }
  }
  let playbackSnapshot = audio.snapshot();
  if (activeChapter !== "music" && ["playing", "starting"].includes(playbackSnapshot.state)) {
    audio.pause();
    playbackSnapshot = audio.snapshot();
  }
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

const worldDialog = page.querySelector("[data-world-dialog]");
const worldButton = page.querySelector("[data-world-open]");
const worldEntry = page.querySelector("[data-world-entry]");
const worldStage = page.querySelector("[data-world-stage]");
const worldPlay = page.querySelector("[data-world-play]");
let worldScroll = null;
worldButton?.addEventListener("click", () => {
  if (!worldDialog || worldDialog.open) return;
  restoreFocus = worldButton;
  worldScroll = { x: window.scrollX, y: window.scrollY };
  worldDialog.dataset.worldStarted = "false";
  if (worldEntry) worldEntry.hidden = false;
  if (worldStage) worldStage.hidden = true;
  document.documentElement.classList.add("about-world-open");
  worldDialog.showModal();
  worldPlay?.focus({ preventScroll: true });
});
worldPlay?.addEventListener("click", () => {
  if (!worldDialog?.open || worldDialog.dataset.worldStarted === "true") return;
  // A future game bundle belongs here, after the explicit Play gesture.
  for (const image of worldDialog.querySelectorAll("[data-world-src]")) {
    if (!image.hasAttribute("src")) image.setAttribute("src", image.dataset.worldSrc);
  }
  worldDialog.dataset.worldStarted = "true";
  if (worldEntry) worldEntry.hidden = true;
  if (worldStage) worldStage.hidden = false;
  worldDialog.querySelector("[data-world-close]")?.focus({ preventScroll: true });
});
page.querySelectorAll("[data-world-close]").forEach(button => {
  button.addEventListener("click", () => worldDialog?.close());
});
worldDialog?.addEventListener("click", event => {
  if (event.target === worldDialog) worldDialog.close();
});
worldDialog?.addEventListener("close", () => {
  if (worldScroll) window.scrollTo(worldScroll.x, worldScroll.y);
  document.documentElement.classList.remove("about-world-open");
  restoreFocus?.focus({ preventScroll: true });
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
    pendingMusicStart = false;
    audio.pause();
    stackCarousel.setMotionPaused(true);
    return;
  }
  pageDisposed = true;
  window.removeEventListener("about-audio-command", handleAudioCommand);
  document.documentElement.classList.remove("about-world-open");
  layoutObserver.disconnect();
  stackCarousel.dispose();
  artDissolveRuntime?.dispose();
  audio.dispose();
});
requestSceneFrame();
