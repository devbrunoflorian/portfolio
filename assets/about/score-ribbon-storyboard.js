import { scoreRibbonStudy } from "./score-ribbon-study-data.js";
import { drawScoreRibbon } from "./score-ribbon-renderer.js?v=mobile-frame-2";

const root = document.querySelector(".about-main");
const stage = root?.querySelector(".score-stage-spacer");
if (!root || !stage) throw new Error("The About Music score stage is missing.");

document.body.dataset.scoreRibbonStoryboard = "music";
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./score-ribbon-storyboard.css", import.meta.url);
stylesheet.dataset.scoreRibbonStoryboardStyle = "";
document.head.append(stylesheet);

const canvas = document.createElement("canvas");
canvas.className = "score-ribbon-storyboard__canvas";
canvas.setAttribute("aria-hidden", "true");
canvas.dataset.scoreRibbonFrame = "music";
stage.append(canvas);

const excerpt = root.querySelector("[data-score-excerpt]");
const excerptLabels = {
  wide: { en: "Bars 30–33 · score study", pt: "Compassos 30–33 · estudo visual" },
  narrow: { en: "Bar 30 · score study", pt: "Compasso 30 · estudo visual" },
};
const locale = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "pt";

// PDF-coordinate right edge of the bar-30 line; keep the full measure in the mobile window.
const mobileBarlineX = 202.2188;
const narrowCrop = {
  ...scoreRibbonStudy,
  x1: mobileBarlineX,
  voices: scoreRibbonStudy.voices.filter(event => event.x <= mobileBarlineX),
};
let resizeObserver;
let lastWidth = 0;
let lastHeight = 0;

function render() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height || (width === lastWidth && height === lastHeight)) return;
  lastWidth = width;
  lastHeight = height;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d", { alpha: true });
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const isNarrow = window.matchMedia("(max-width: 700px)").matches;
  const crop = isNarrow ? narrowCrop : scoreRibbonStudy;
  if (excerpt) excerpt.textContent = (isNarrow ? excerptLabels.narrow : excerptLabels.wide)[locale];
  drawScoreRibbon(context, width, height, crop);
}

resizeObserver = new ResizeObserver(render);
resizeObserver.observe(stage);
render();
window.addEventListener("pagehide", () => resizeObserver?.disconnect(), { once: true });
