import { scoreRibbonStudy as study } from "./score-ribbon-study-data.js";
import { drawScoreRibbon } from "./score-ribbon-renderer.js";

const root = document.querySelector(".about-main");
const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
const words = isEnglish ? {
  title: "About — <em>Dissonância</em>",
  return: "Return to About",
  sourceTitle: "PDF · source engraving",
  sourceMeta: "Page 2 · bars 30–33",
  sourceCaption: "Original PDF crop · guitar staff only",
  planeTitle: "Shared pitch grid",
  planeMeta: "PDF positions · voice pitches from MIDI",
  ribbonTitle: "Score ribbon · curved engraving proof",
  ribbonMeta: "PDF vectors follow the ribbon; note glyphs stay upright",
  voiceI: "Voice I",
  voiceII: "Voice II",
  guitar: "Guitar staff · PDF",
  matched: "guitar noteheads mapped by sequence",
  pitchError: "maximum pitch error",
  attacks: "voice attacks · MIDI",
  close: "Back to the page",
  missing: "The source score could not be loaded.",
} : {
  title: "About — <em>Dissonância</em>",
  return: "Voltar ao About",
  sourceTitle: "PDF · gravação original",
  sourceMeta: "Página 2 · compassos 30–33",
  sourceCaption: "Recorte original do PDF · apenas pauta do violão",
  planeTitle: "Grade de alturas compartilhada",
  planeMeta: "Posições do PDF · alturas das vozes vindas do MIDI",
  ribbonTitle: "Fita de partitura · prova de gravura curva",
  ribbonMeta: "Os vetores do PDF acompanham a fita; os glifos ficam em pé",
  voiceI: "Voz I",
  voiceII: "Voz II",
  guitar: "Pauta do violão · PDF",
  matched: "cabeças de nota do violão mapeadas em sequência",
  pitchError: "erro máximo de altura",
  attacks: "ataques das vozes · MIDI",
  close: "Voltar à página",
  missing: "Não foi possível carregar a partitura de origem.",
};

document.body.dataset.scoreRibbonStudy = "true";
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./score-ribbon-study.css", import.meta.url);
stylesheet.dataset.scoreRibbonStudyStyle = "";
document.head.append(stylesheet);

const returnUrl = new URL(window.location.href);
returnUrl.searchParams.delete("score-ribbon");
returnUrl.hash = "music";

const proof = document.createElement("main");
proof.className = "score-ribbon-proof";
proof.innerHTML = `
  <header class="score-ribbon-proof__head">
    <h1 class="score-ribbon-proof__title">${words.title}</h1>
    <a class="score-ribbon-proof__return" href="${returnUrl.href}">${words.return}</a>
  </header>
  <div class="score-ribbon-proof__body">
    <div class="score-ribbon-proof__source-row">
      <section class="score-ribbon-proof__panel" aria-labelledby="score-ribbon-source-title">
        <div class="score-ribbon-proof__panel-head">
          <h2 id="score-ribbon-source-title">${words.sourceTitle}</h2>
          <p>${words.sourceMeta}</p>
        </div>
        <div class="score-ribbon-proof__source-view"><canvas data-view="source" aria-hidden="true"></canvas></div>
        <p class="score-ribbon-proof__source-caption">${words.sourceCaption}</p>
      </section>
      <section class="score-ribbon-proof__panel" aria-labelledby="score-ribbon-plane-title">
        <div class="score-ribbon-proof__panel-head">
          <h2 id="score-ribbon-plane-title">${words.planeTitle}</h2>
          <p>${words.planeMeta}</p>
        </div>
        <div class="score-ribbon-proof__canvas-wrap"><canvas data-view="plane" aria-hidden="true"></canvas></div>
        <div class="score-ribbon-proof__legend">
          <span><i class="score-ribbon-proof__swatch score-ribbon-proof__swatch--one"></i>${words.voiceI}</span>
          <span><i class="score-ribbon-proof__swatch score-ribbon-proof__swatch--two"></i>${words.voiceII}</span>
        </div>
      </section>
    </div>
    <section class="score-ribbon-proof__panel score-ribbon-proof__panel--ribbon" aria-labelledby="score-ribbon-ribbon-title">
      <div class="score-ribbon-proof__panel-head">
        <h2 id="score-ribbon-ribbon-title">${words.ribbonTitle}</h2>
        <p>${words.ribbonMeta}</p>
      </div>
      <div class="score-ribbon-proof__canvas-wrap"><canvas data-view="ribbon" aria-hidden="true"></canvas></div>
      <div class="score-ribbon-proof__legend">
        <span><i class="score-ribbon-proof__swatch score-ribbon-proof__swatch--one"></i>${words.voiceI}</span>
        <span><i class="score-ribbon-proof__swatch score-ribbon-proof__swatch--two"></i>${words.voiceII}</span>
        <span>${words.guitar}</span>
      </div>
    </section>
    <footer class="score-ribbon-proof__facts" aria-label="${isEnglish ? "Source checks" : "Conferências de origem"}">
      <span><strong>${study.heads.length}/32</strong> ${words.matched}</span>
      <span><strong>${study.maxPdfPitchErrorPoints.toFixed(3)} pt</strong> ${words.pitchError}</span>
      <span><strong>${study.voices.length}</strong> ${words.attacks}</span>
    </footer>
  </div>`;
document.body.append(proof);

const sourceCanvas = proof.querySelector('[data-view="source"]');
const planeCanvas = proof.querySelector('[data-view="plane"]');
const ribbonCanvas = proof.querySelector('[data-view="ribbon"]');
const inkCanvas = document.createElement("canvas");
const inkContext = inkCanvas.getContext("2d", { alpha: true });
const source = new Image();
source.decoding = "async";
source.src = new URL("./guitar-score/score-ribbon-row-030-033.png", import.meta.url).href;

function staffYForMidi(midi) {
  const naturalStep = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + naturalStep[pitchClass];
  const e4 = 4 * 7 + 2;
  return study.staffBottom - (diatonic - e4) * study.halfStep;
}

function resizeCanvas(canvas, height) {
  const mobileMinimum = window.matchMedia("(max-width: 700px)").matches ? 720 : 0;
  const width = Math.max(canvas.parentElement.clientWidth - 20, mobileMinimum, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { context, width, height };
}

function createVoicePoints(transform) {
  return [1, 2].map(track => study.voices
    .filter(event => event.track === track)
    .sort((left, right) => left.beat - right.beat)
    .map(event => transform(event.x, staffYForMidi(event.writtenMidi), event)));
}

function drawSource() {
  const mobileMinimum = window.matchMedia("(max-width: 700px)").matches ? 720 : 0;
  const width = Math.max(sourceCanvas.parentElement.clientWidth - 20, mobileMinimum, 1);
  const height = width * (study.y1 - study.y0) / (study.x1 - study.x0);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  sourceCanvas.width = Math.round(width * pixelRatio);
  sourceCanvas.height = Math.round(height * pixelRatio);
  sourceCanvas.style.width = `${width}px`;
  sourceCanvas.style.height = `${height}px`;
  const context = sourceCanvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#f4f1f5";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
}

function traceCurve(context, points, color, width, glow = 0) {
  if (!points.length) return;
  context.save();
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const span = (end.x - start.x) / 3;
    context.bezierCurveTo(
      start.x + span,
      start.y + ((end.y - before.y) / 6),
      end.x - span,
      end.y - ((after.y - start.y) / 6),
      end.x,
      end.y,
    );
  }
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (glow) {
    context.shadowColor = color;
    context.shadowBlur = glow;
  }
  context.stroke();
  context.restore();

  for (const point of points) {
    context.save();
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = glow ? glow * .72 : 0;
    context.beginPath();
    context.arc(point.x, point.y, point.radius ?? 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawPlane() {
  const { context, width, height } = resizeCanvas(planeCanvas, 172);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#090811";
  context.fillRect(0, 0, width, height);
  if (!source.complete || !source.naturalWidth) return;

  const scale = Math.min(width / (study.x1 - study.x0), (height - 26) / (study.y1 - study.y0));
  const drawWidth = (study.x1 - study.x0) * scale;
  const drawHeight = (study.y1 - study.y0) * scale;
  const left = (width - drawWidth) / 2;
  const top = (height - drawHeight) / 2;
  context.save();
  context.globalAlpha = .53;
  context.drawImage(inkCanvas, left, top, drawWidth, drawHeight);
  context.restore();

  const transform = (x, y) => ({ x: left + (x - study.x0) * scale, y: top + (y - study.y0) * scale, radius: 3.1 });
  const voicePoints = createVoicePoints(transform);
  traceCurve(context, voicePoints[0], "#70a8ff", 1.8, 6);
  traceCurve(context, voicePoints[1], "#c39aff", 1.8, 6);
}

function drawRibbon() {
  const { context, width, height } = resizeCanvas(ribbonCanvas, 258);
  drawScoreRibbon(context, width, height, study);
}

function prepareInk() {
  inkCanvas.width = source.naturalWidth;
  inkCanvas.height = source.naturalHeight;
  inkContext.drawImage(source, 0, 0);
  inkContext.globalCompositeOperation = "source-in";
  inkContext.fillStyle = "#a49aaa";
  inkContext.fillRect(0, 0, inkCanvas.width, inkCanvas.height);
  inkContext.globalCompositeOperation = "source-over";
}

let resizeObserver;
function drawAll() {
  if (!source.complete || !source.naturalWidth) return;
  drawSource();
  drawPlane();
  drawRibbon();
}

source.addEventListener("load", () => {
  prepareInk();
  drawAll();
  resizeObserver = new ResizeObserver(drawAll);
  resizeObserver.observe(proof);
});
source.addEventListener("error", () => {
  proof.querySelector(".score-ribbon-proof__body").textContent = words.missing;
});
window.addEventListener("pagehide", () => resizeObserver?.disconnect(), { once: true });

if (source.complete && source.naturalWidth) {
  prepareInk();
  drawAll();
  resizeObserver = new ResizeObserver(drawAll);
  resizeObserver.observe(proof);
}

root?.setAttribute("aria-hidden", "true");
proof.querySelector(".score-ribbon-proof__return")?.focus({ preventScroll: true });
