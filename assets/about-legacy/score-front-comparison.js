import { createTravelProjector } from './score-travel-geometry.js';

/** Comparison uses the original PDF raster's pixel origin, not a fitted screenshot. */
export function mountFrontComparison(page, sourceCanvas, score, sourceSystem, view) {
  const panel = document.createElement('section');
  panel.innerHTML = `<h2>PDF × render · compassos 31–33</h2>
    <p>Mesma escala e mesmas âncoras. PDF em ciano; render em âmbar. No 32, o PDF local ainda tem o acorde agudo antigo; o render segue a pausa solicitada.</p>
    <div class="comparison-pair"><figure><figcaption>PDF original · página 2</figcaption><canvas aria-label="PDF frontal 31–33"></canvas></figure><figure><figcaption>Render frontal</figcaption><canvas aria-label="Render frontal 31–33"></canvas></figure></div>
    <figure><figcaption>Sobreposição · ciano = PDF · âmbar = render</figcaption><canvas aria-label="Sobreposição PDF e render 31–33"></canvas></figure>
    <label>Presença do render <input type="range" min="0" max="100" value="65" aria-label="Opacidade do render na sobreposição"></label><p data-comparison-metrics></p>`;
  panel.className = 'front-comparison';
  page.querySelector('.fold-gate > .fold-gate-poses').after(panel);
  const style = document.createElement('style');
  style.textContent = '.comparison-pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.front-comparison canvas{aspect-ratio:auto}.front-comparison figure{margin:20px 0}@media(max-width:700px){.comparison-pair{grid-template-columns:1fr}}';
  panel.append(style);
  const image = new Image();
  image.src = '/assets/about-legacy/guitar-score/score-ribbon-row-030-033.png';
  const canvases = [...panel.querySelectorAll('canvas')];
  const slider = panel.querySelector('input');

  function draw() {
    if (!image.complete || !image.naturalWidth || !sourceCanvas.width) return;
    const width = sourceCanvas.clientWidth, height = width / 1.8;
    const project = createTravelProjector(width, height, score, 1, view);
    const origin = project(view.x0, 0), scale = origin.scale;
    const sourceStart = sourceSystem.bars.find(b => b.number === 31).xStart;
    const bottom = sourceSystem.glyphs.filter(g => g.noteId).map(g => g.sourceY + g.v * sourceSystem.sourceHalfStep)
      .reduce((sum, value, _, values) => sum + value / values.length, 0);
    const pdf = document.createElement('canvas'); pdf.width = sourceCanvas.width; pdf.height = sourceCanvas.height;
    const context = pdf.getContext('2d'); context.scale(2, 2);
    context.beginPath(); context.rect(origin.x, 0, project(view.x1, 0).x - origin.x, height); context.clip();
    const factor = scale / sourceSystem.sourceHalfStep;
    context.drawImage(image, origin.x + (85 / 3 - sourceStart) * factor,
      origin.y + (125 - bottom) * factor, image.naturalWidth / 3 * factor, image.naturalHeight / 3 * factor);
    const pdfData = context.getImageData(0, 0, pdf.width, pdf.height);
    const renderData = sourceCanvas.getContext('2d').getImageData(0, 0, pdf.width, pdf.height);
    const top = Math.max(0, Math.floor(project(view.x0, -18).y * 2));
    const end = Math.min(pdf.height, Math.ceil(project(view.x0, 13).y * 2));
    const cropHeight = end - top;
    const pdfInk = new Uint8ClampedArray(pdf.width * cropHeight);
    const renderInk = new Uint8ClampedArray(pdfInk.length);
    for (let i = 0; i < pdfInk.length; i++) {
      const at = (top * pdf.width + i) * 4;
      pdfInk[i] = pdfData.data[at + 3] * (255 - Math.min(...pdfData.data.slice(at, at + 3))) / 255;
      renderInk[i] = Math.max(0, Math.max(...renderData.data.slice(at, at + 3)) - 9);
    }
    const colors = [[72, 204, 255], [255, 180, 90]];
    canvases.forEach((canvas, index) => {
      canvas.width = pdf.width; canvas.height = cropHeight;
      const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(pdf.width, cropHeight);
      for (let i = 0; i < pdfInk.length; i++) {
        const a = index === 1 ? 0 : pdfInk[i] / 255;
        const b = index === 0 ? 0 : renderInk[i] / 246 * (index === 2 ? Number(slider.value) / 100 : 1);
        const offset = i * 4;
        for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] =
          Math.min(255, [6, 6, 9][channel] + a * colors[0][channel] + b * colors[1][channel]);
        pixels.data[offset + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    });
    const heads = score.pdfGlyphs.filter(g => g.noteId && g.x >= view.x0 && g.x <= view.x1);
    const delta = Math.max(...heads.map(g => Math.abs(Math.round(g.y) - g.y) * scale));
    panel.querySelector('[data-comparison-metrics]').textContent =
      `20 cabeças · mesmo path e escala do PDF · desvio vertical máximo do snap diatônico: ${delta.toFixed(2)} px neste viewport. O 32 é uma alteração editorial deliberada. O halo colorido é uma comparação visual, não uma medida de erro de pixel.`;
  }
  image.addEventListener('load', draw);
  slider.addEventListener('input', draw);
  return { draw };
}
