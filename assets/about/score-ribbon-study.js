import { scoreRibbonStudy as study } from "./score-ribbon-study-data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
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
  ribbonTitle: "Score ribbon · first spatial study",
  ribbonMeta: "The same PDF row, gently carried through depth",
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
  ribbonTitle: "Fita de partitura · primeiro estudo espacial",
  ribbonMeta: "A mesma pauta do PDF, conduzida suavemente pela profundidade",
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
        <div class="score-ribbon-proof__source-view">
          <img alt="" decoding="async" />
        </div>
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

const sourceImage = proof.querySelector(".score-ribbon-proof__source-view img");
sourceImage.src = new URL("./guitar-score/score-ribbon-row-030-033.png", import.meta.url).href;
const planeCanvas = proof.querySelector('[data-view="plane"]');
const ribbonCanvas = proof.querySelector('[data-view="ribbon"]');
const inkCanvas = document.createElement("canvas");
const inkContext = inkCanvas.getContext("2d", { alpha: true });
const source = sourceImage;

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

function ribbonPoint(x, y, width, height) {
  const u = (x - study.x0) / (study.x1 - study.x0);
  const v = (y - study.y0) / (study.y1 - study.y0);
  const centerY = height * .50 + Math.sin((u * 1.35 - .15) * Math.PI * 2) * height * .18;
  const depth = .7 + .42 * Math.sin(Math.PI * u);
  const horizontalSkew = (v - .5) * (u - .5) * 76;
  return {
    x: 40 + u * (width - 80) + horizontalSkew,
    y: centerY + (v - .5) * 62 * depth,
    depth,
    u,
    radius: 3 + Math.max(0, depth - .72) * 2.1,
  };
}

function destinationPoint(u, v, width, height) {
  const x = study.x0 + u * (study.x1 - study.x0);
  const y = study.y0 + v * (study.y1 - study.y0);
  return ribbonPoint(x, y, width, height);
}

function drawTriangle(context, image, sourcePoints, destinationPoints) {
  const [s0, s1, s2] = sourcePoints;
  const [d0, d1, d2] = destinationPoints;
  const dx1 = s1.x - s0.x;
  const dy1 = s1.y - s0.y;
  const dx2 = s2.x - s0.x;
  const dy2 = s2.y - s0.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < .001) return;
  const du1 = d1.x - d0.x;
  const dv1 = d1.y - d0.y;
  const du2 = d2.x - d0.x;
  const dv2 = d2.y - d0.y;
  const a = (du1 * dy2 - du2 * dy1) / determinant;
  const c = (dx1 * du2 - dx2 * du1) / determinant;
  const b = (dv1 * dy2 - dv2 * dy1) / determinant;
  const d = (dx1 * dv2 - dx2 * dv1) / determinant;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;

  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

function drawRibbonTexture(context, width, height) {
  const columns = 32;
  const rows = 3;
  const sourceWidth = inkCanvas.width;
  const sourceHeight = inkCanvas.height;
  context.save();
  context.globalAlpha = .56;
  for (let column = 0; column < columns; column += 1) {
    const u0 = column / columns;
    const u1 = (column + 1) / columns;
    for (let row = 0; row < rows; row += 1) {
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      const s0 = { x: u0 * sourceWidth, y: v0 * sourceHeight };
      const s1 = { x: u1 * sourceWidth, y: v0 * sourceHeight };
      const s2 = { x: u0 * sourceWidth, y: v1 * sourceHeight };
      const s3 = { x: u1 * sourceWidth, y: v1 * sourceHeight };
      const d0 = destinationPoint(u0, v0, width, height);
      const d1 = destinationPoint(u1, v0, width, height);
      const d2 = destinationPoint(u0, v1, width, height);
      const d3 = destinationPoint(u1, v1, width, height);
      drawTriangle(context, inkCanvas, [s0, s1, s2], [d0, d1, d2]);
      drawTriangle(context, inkCanvas, [s1, s3, s2], [d1, d3, d2]);
    }
  }
  context.restore();
}

function blendColor(far, near, progress) {
  const parse = value => value.match(/[\da-f]{2}/gi).map(channel => Number.parseInt(channel, 16));
  const a = parse(far);
  const b = parse(near);
  const amount = Math.max(0, Math.min(1, progress));
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)).join(" ")})`;
}

function drawRibbon() {
  const { context, width, height } = resizeCanvas(ribbonCanvas, 258);
  context.clearRect(0, 0, width, height);
  const atmosphere = context.createRadialGradient(width * .52, height * .52, 4, width * .52, height * .52, width * .53);
  atmosphere.addColorStop(0, "rgb(73 37 118 / 24%)");
  atmosphere.addColorStop(1, "rgb(8 8 14 / 0%)");
  context.fillStyle = atmosphere;
  context.fillRect(0, 0, width, height);
  if (!source.complete || !source.naturalWidth) return;

  drawRibbonTexture(context, width, height);
  const voicePoints = createVoicePoints((x, y) => ribbonPoint(x, y, width, height));
  [
    { points: voicePoints[0], far: "#386fbd", near: "#83bdff" },
    { points: voicePoints[1], far: "#7947ad", near: "#d0afff" },
  ].forEach(({ points, far, near }) => {
    context.save();
    context.beginPath();
    if (points.length) context.moveTo(points[0].x, points[0].y);
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const span = (end.x - start.x) / 3;
      context.bezierCurveTo(start.x + span, start.y, end.x - span, end.y, end.x, end.y);
      const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, blendColor(far, near, (start.depth - .65) / .5));
      gradient.addColorStop(1, blendColor(far, near, (end.depth - .65) / .5));
      context.strokeStyle = gradient;
      context.lineWidth = 2.35;
      context.lineCap = "round";
      context.shadowColor = near;
      context.shadowBlur = 8;
      context.stroke();
      context.beginPath();
      context.moveTo(end.x, end.y);
    }
    context.restore();

    for (const point of points) {
      const color = blendColor(far, near, (point.depth - .65) / .5);
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 10;
      context.fill();
      context.restore();
    }
  });
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
