import { scoreRibbonData } from "./score-ribbon-data.js";
import { scorePlaybackWindowAtBeat, scorePositionAtBeat, scoreRibbonTimeline, scoreWindowAtBeat, STATIC_SCORE_BEAT } from "./score-ribbon-timeline.js?v=continuous-score-5";
import { drawScoreRibbon } from "./score-ribbon-renderer.js?v=continuous-score-5";

const thread = document.querySelector("[data-score-thread]");
if (!thread) throw new Error("The About score thread is missing.");

document.body.dataset.scoreRibbonTransition = "true";
const excerpt = document.querySelector("[data-score-excerpt]");
const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./score-ribbon-transition.css?continuous-score-5", import.meta.url);
stylesheet.dataset.scoreRibbonTransitionStyle = "";
document.head.append(stylesheet);

const canvas = document.createElement("canvas");
canvas.className = "score-ribbon-transition__canvas";
canvas.setAttribute("aria-hidden", "true");
thread.append(canvas);

let width = 0;
let height = 0;
let drawn = false;
let state = { progress: 0, motionEnabled: true, playbackSnapshot: null };
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

function currentBeatForState() {
  const snapshot = state.playbackSnapshot;
  if (snapshot && snapshot.state !== "off" && Number.isFinite(snapshot.beat)) {
    return Math.max(0, Math.min(scoreRibbonData.totalBeats, snapshot.beat));
  }
  return null;
}

function updateExcerpt(window) {
  if (!excerpt) return;
  const prefix = isEnglish ? "Bars" : "Compassos";
  const label = window.firstBar === window.lastBar
    ? `${prefix} ${window.firstBar}`
    : `${prefix} ${window.firstBar}–${window.lastBar}`;
  const isSilent = currentBeatForState() === null;
  const suffix = isSilent
    ? (isEnglish ? " · still score" : " · trecho estático")
    : "";
  excerpt.textContent = `${label}${suffix}`;
}

function render() {
  const bounds = thread.getBoundingClientRect();
  if (!bounds.width || !bounds.height || (bounds.width === width && bounds.height === height)) return;
  width = bounds.width;
  height = bounds.height;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  draw();
}

function draw() {
  if (!width || !height) return;
  const context = canvas.getContext("2d", { alpha: true });
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const playbackBeat = currentBeatForState();
  const window = playbackBeat === null
    ? scoreWindowAtBeat(STATIC_SCORE_BEAT, width)
    : scorePlaybackWindowAtBeat(playbackBeat, width);
  updateExcerpt(window);
  drawScoreRibbon(context, width, height, scoreRibbonTimeline, {
    progress: state.progress,
    motionEnabled: state.motionEnabled,
    viewStart: window.startX,
    viewEnd: window.endX,
    playbackBeat,
    playbackX: playbackBeat === null ? null : scorePositionAtBeat(playbackBeat),
  });
  drawn = true;
}

const resizeObserver = new ResizeObserver(render);

resizeObserver.observe(thread);

export function updateScoreRibbonTransition(nextState) {
  const frozenSnapshot = !nextState.motionEnabled && !state.motionEnabled
    ? state.playbackSnapshot
    : nextState.playbackSnapshot;
  if (
    drawn
    && nextState.progress === state.progress
    && nextState.motionEnabled === state.motionEnabled
    && frozenSnapshot?.state === state.playbackSnapshot?.state
    && frozenSnapshot?.beat === state.playbackSnapshot?.beat
  ) return;
  state = {
    ...state,
    ...nextState,
    playbackSnapshot: frozenSnapshot ?? state.playbackSnapshot,
  };
  draw();
}

export function disposeScoreRibbonTransition() {
  resizeObserver.disconnect();
  canvas.remove();
}
