import { scoreRibbonStudy } from "./score-ribbon-study-data.js";
import { drawScoreRibbon } from "./score-ribbon-renderer.js?v=object-flow-2";

const thread = document.querySelector("[data-score-thread]");
if (!thread) throw new Error("The About score thread is missing.");

document.body.dataset.scoreRibbonTransition = "true";
const excerpt = document.querySelector("[data-score-excerpt]");
if (excerpt) {
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  excerpt.textContent = isEnglish ? "Bars 30–33 · score study" : "Compassos 30–33 · estudo visual";
}

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./score-ribbon-transition.css?code-music-2", import.meta.url);
stylesheet.dataset.scoreRibbonTransitionStyle = "";
document.head.append(stylesheet);

const canvas = document.createElement("canvas");
canvas.className = "score-ribbon-transition__canvas";
canvas.setAttribute("aria-hidden", "true");
thread.append(canvas);

let width = 0;
let height = 0;
let drawn = false;
let state = { progress: 0, motionEnabled: true };
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

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
  drawScoreRibbon(context, width, height, scoreRibbonStudy, state);
  drawn = true;
}

const resizeObserver = new ResizeObserver(render);

resizeObserver.observe(thread);

export function updateScoreRibbonTransition(nextState) {
  if (
    drawn
    && nextState.progress === state.progress
    && nextState.motionEnabled === state.motionEnabled
  ) return;
  state = nextState;
  draw();
}

export function disposeScoreRibbonTransition() {
  resizeObserver.disconnect();
  canvas.remove();
}
