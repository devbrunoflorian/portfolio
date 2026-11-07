import { scoreRibbonStudy } from "./score-ribbon-study-data.js";
import { drawScoreRibbon } from "./score-ribbon-renderer.js?v=mobile-frame-2";

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
const resizeObserver = new ResizeObserver(() => {
  const bounds = thread.getBoundingClientRect();
  if (!bounds.width || !bounds.height || (bounds.width === width && bounds.height === height)) return;
  width = bounds.width;
  height = bounds.height;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext("2d", { alpha: true });
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawScoreRibbon(context, width, height, scoreRibbonStudy);
});

resizeObserver.observe(thread);
window.addEventListener("pagehide", () => resizeObserver.disconnect(), { once: true });
