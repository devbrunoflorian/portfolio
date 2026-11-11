import { createAdaptiveDpr } from './score-gpu-budget.js';

const POSES = [0.13, 0.4, 1];
const REFERENCE_PIXEL_RATIO = 2;

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, median: null, p95: null, max: null };
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return { count: sorted.length, median, p95: percentile(sorted, 0.95), max: sorted.at(-1) };
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function setCanvasStyle(canvas, width, height) {
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function copyCanvas(source, destination) {
  if (destination.width !== source.width || destination.height !== source.height) {
    destination.width = source.width;
    destination.height = source.height;
  }
  const context = destination.getContext('2d');
  context.clearRect(0, 0, destination.width, destination.height);
  context.drawImage(source, 0, 0);
}

function compareRgba(reference, candidate) {
  if (reference.width !== candidate.width || reference.height !== candidate.height
    || reference.data.length !== candidate.data.length) {
    return {
      comparable: false,
      reference: { width: reference.width, height: reference.height, channels: reference.data.length },
      candidate: { width: candidate.width, height: candidate.height, channels: candidate.data.length },
    };
  }
  let changedChannels = 0, changedPixels = 0, pixelsOver16 = 0, maxDelta = 0;
  for (let i = 0; i < reference.data.length; i += 4) {
    let pixelChanged = false;
    let pixelMaxDelta = 0;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(reference.data[i + channel] - candidate.data[i + channel]);
      if (delta) { changedChannels++; pixelChanged = true; }
      if (channel < 3) pixelMaxDelta = Math.max(pixelMaxDelta, delta);
      maxDelta = Math.max(maxDelta, delta);
    }
    if (pixelChanged) changedPixels++;
    if (pixelMaxDelta > 16) pixelsOver16++;
  }
  return {
    comparable: true,
    width: reference.width,
    height: reference.height,
    channels: reference.data.length,
    changedChannels,
    changedPixels,
    pixelsOver16,
    pixelsOver16Percent: pixelsOver16 / (reference.width * reference.height) * 100,
    maxDelta,
  };
}

export function mountGpuStudy(page, options, renderCanvas) {
  const { firstBar = 31, lastBar = firstBar + 2, markerId = 'guitar-33-4-1' } = options;
  const windowLabel = `compassos ${firstBar}–${lastBar}`;
  const section = document.createElement('section');
  section.dataset.gpuStudy = 'true';
  section.innerHTML = `
    <h2>Projeção na GPU · ${windowLabel}</h2>
    <p>Three.js com deformação no vertex shader, comparado ao Canvas C. A referência mostra a mesma janela de ${windowLabel}; a nota dourada é <code>${markerId}</code>. Diferenças de rasterização são esperadas e não demonstram paridade visual.</p>
    <button type="button" data-load>Carregar estudo GPU</button>
    <output data-status role="status" aria-live="polite">Preparando a referência Canvas C · 13%…</output>
    <div data-controls>
      <div class="gpu-controls">
        <label>Posição <output data-pose-label>13.0%</output>
          <input data-pose type="range" min="0" max="1000" step="1" value="130" aria-label="Posição da partitura, de 0 a 100 por cento">
        </label>
        <button type="button" data-play disabled>Iniciar ida e volta</button>
        <output data-fps>RAF: parado</output>
      </div>
      <p class="gpu-note">A cadência RAF conta callbacks do navegador; não mede FPS apresentado pela GPU. Em movimento, o Canvas permanece estático para não acrescentar desenho à medição.</p>
      <div class="gpu-presets" aria-label="Poses de comparação">
        <span>Comparar em:</span>
        <button type="button" data-preset="13">13%</button>
        <button type="button" data-preset="40">40%</button>
        <button type="button" data-preset="100">100%</button>
      </div>
      <div class="gpu-pair">
        <figure><figcaption data-reference-caption>Canvas C · preparando referência</figcaption><canvas data-reference-preview aria-label="Referência estática Canvas C"></canvas></figure>
        <figure><figcaption data-gpu-caption>Three.js C · experimental</figcaption><div class="gpu-canvas-slot" data-gpu-preview><span data-gpu-placeholder>Carregue o estudo para iniciar o renderer GPU.</span></div></figure>
      </div>
      <button type="button" data-overlay disabled>Gerar sobreposição frontal · 100%</button>
      <figure data-overlay-figure hidden><figcaption>Canvas ciano + GPU âmbar · pose frontal 100%</figcaption><canvas data-overlay-preview aria-label="Sobreposição Canvas em ciano e GPU em âmbar na pose frontal"></canvas></figure>
      <div class="gpu-controls"><button type="button" data-lose-context disabled>Simular perda de contexto</button><button type="button" data-restore-context hidden>Restaurar contexto</button></div>
      <p data-context-fallback role="status" hidden></p>
      <div class="gpu-benchmark">
        <h3>Benchmark · 60 poses consecutivas</h3>
        <p>Três aquecimentos, depois 60 posições de 0% a 100%. Para medir o teto adaptativo, rode uma vez em 1,5× na condição de CPU desejada.</p>
        <div class="gpu-controls">
          <label>DPR do renderer GPU
            <select data-dpr disabled aria-label="DPR usado no benchmark"><option value="1">1×</option><option value="1.5" selected>1,5×</option><option value="2">2×</option></select>
          </label>
          <label><input data-cpu-throttle type="checkbox" disabled> Confirmo que o throttling de CPU 4× está ativo no DevTools</label>
          <button type="button" data-measure disabled>Medir 60 poses</button>
        </div>
        <p class="gpu-note">A caixa apenas registra a condição informada; este código não aplica nem detecta throttling do DevTools.</p>
        <output data-measure-status role="status" aria-live="polite"></output>
        <button type="button" data-pixel-diff disabled>Contar diferenças RGBA em 13%, 40% e 100%</button>
        <pre data-gpu-report data-gpu-report-output></pre>
      </div>
    </div>`;
  page.append(section);

  const styles = document.createElement('style');
  styles.textContent = `
    [data-gpu-study]{margin:36px 0;color:#e9e5f0;font:16px/1.55 Inter,system-ui,sans-serif}
    [data-gpu-study] [hidden]{display:none!important}
    [data-gpu-study] h2{color:#c19aff;font-size:24px;margin:0 0 10px}
    [data-gpu-study] h3{font-size:19px;margin:28px 0 8px}
    [data-gpu-study] p{max-width:920px;color:#bcb4c9}
    [data-gpu-study] button,[data-gpu-study] select{padding:9px 13px;border:1px solid #705585;border-radius:4px;background:#21172b;color:#f1eafa;font:inherit}
    [data-gpu-study] button{cursor:pointer}
    [data-gpu-study] button:disabled{opacity:.55;cursor:wait}
    [data-gpu-study] button:focus-visible,[data-gpu-study] select:focus-visible,[data-gpu-study] input:focus-visible{outline:2px solid #ffdc83;outline-offset:2px}
    [data-gpu-study] [data-status], [data-gpu-study] [data-measure-status], [data-gpu-study] [data-fps]{display:inline-block;margin:12px 10px;color:#d8c5e8}
    [data-gpu-study] .gpu-controls,[data-gpu-study] .gpu-presets{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0}
    [data-gpu-study] .gpu-controls label{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    [data-gpu-study] [data-pose]{width:min(440px,55vw);accent-color:#c19aff}
    [data-gpu-study] .gpu-presets span{color:#bcb4c9}
    [data-gpu-study] .gpu-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}
    [data-gpu-study] figure{min-width:0;margin:0;border:1px solid #383044;border-radius:7px;overflow:hidden;background:#08080e}
    [data-gpu-study] figcaption{padding:9px 12px;color:#cfb7ec;font-size:13px}
    [data-gpu-study] .gpu-pair canvas{display:block;width:100%;height:auto;aspect-ratio:1.8;background:#08080e}
    [data-gpu-study] [data-overlay-figure]{max-width:1142px;margin:18px 0;border:1px solid #383044;border-radius:7px;overflow:hidden;background:#060609}
    [data-gpu-study] [data-overlay-preview]{display:block;width:100%;height:auto;aspect-ratio:1.8}
    [data-gpu-study] .gpu-canvas-slot{position:relative;min-height:120px;background:#08080e;color:#bcb4c9}
    [data-gpu-study] .gpu-canvas-slot canvas{display:block;width:100%;height:auto;aspect-ratio:1.8}
    [data-gpu-study] [data-gpu-placeholder]{display:block;padding:24px}
    [data-gpu-study] .gpu-note{font-size:13px}
    [data-gpu-study] .gpu-benchmark{margin-top:28px;padding-top:12px;border-top:1px solid #383044}
    [data-gpu-study] .gpu-benchmark pre{max-height:480px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 ui-monospace,monospace;color:#d7c9e5}
    [data-gpu-study] [data-context-fallback]{padding:12px;border:1px solid #9a6e38;color:#ffdc83;background:#20180e}
    [data-gpu-study] [data-cpu-throttle]{accent-color:#c19aff}
    @media(max-width:700px){[data-gpu-study] .gpu-pair{grid-template-columns:1fr}[data-gpu-study] [data-pose]{width:min(100%,440px)}}
  `;
  section.append(styles);

  const loadButton = section.querySelector('[data-load]');
  const controls = section.querySelector('[data-controls]');
  const status = section.querySelector('[data-status]');
  const slider = section.querySelector('[data-pose]');
  const poseLabel = section.querySelector('[data-pose-label]');
  const playButton = section.querySelector('[data-play]');
  const fpsOutput = section.querySelector('[data-fps]');
  const referenceCaption = section.querySelector('[data-reference-caption]');
  const gpuCaption = section.querySelector('[data-gpu-caption]');
  const referencePreview = section.querySelector('[data-reference-preview]');
  const gpuPreview = section.querySelector('[data-gpu-preview]');
  const gpuPlaceholder = section.querySelector('[data-gpu-placeholder]');
  const measureButton = section.querySelector('[data-measure]');
  const measureStatus = section.querySelector('[data-measure-status]');
  const dprSelect = section.querySelector('[data-dpr]');
  const cpuThrottleCheck = section.querySelector('[data-cpu-throttle]');
  const pixelDiffButton = section.querySelector('[data-pixel-diff]');
  const overlayButton = section.querySelector('[data-overlay]');
  const overlayFigure = section.querySelector('[data-overlay-figure]');
  const overlayPreview = section.querySelector('[data-overlay-preview]');
  const reportElement = section.querySelector('[data-gpu-report]');
  const contextFallback = section.querySelector('[data-context-fallback]');
  const loseContextButton = section.querySelector('[data-lose-context]');
  const restoreContextButton = section.querySelector('[data-restore-context]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Fixed study contract: preserve the approved 1280px viewport's 1142px score field.
  const sceneWidth = 1142;
  const sceneHeight = sceneWidth / 1.8;
  const source = document.createElement('div');
  source.setAttribute('aria-hidden', 'true');
  Object.assign(source.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${sceneWidth}px`, height: `${sceneHeight}px`,
    visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden',
  });
  const referenceCanvas = document.createElement('canvas');
  setCanvasStyle(referenceCanvas, sceneWidth, sceneHeight);
  const gpuHost = gpuPreview;
  source.append(referenceCanvas);
  section.append(source);

  let gpuStudy;
  let disposed = false;
  let lostContext = false;
  let loading = false;
  let referenceReady = false;
  let playing = false;
  let direction = 1;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let fpsWindowStart = 0;
  let fpsWindowFrames = 0;
  let referencePose = 0.13;

  function drawReference(pose) {
    renderCanvas(referenceCanvas, pose, true, 'C', 'auto', false, null, 3);
    referencePose = pose;
    referenceReady = true;
    copyCanvas(referenceCanvas, referencePreview);
    referenceCaption.textContent = `Canvas C · ${windowLabel} · ${Math.round(pose * 100)}% · backing ${referenceCanvas.width}×${referenceCanvas.height}`;
  }

  function drawGpu(pose) {
    if (!gpuStudy || lostContext) return;
    gpuStudy.draw(pose, 'C');
    gpuCaption.textContent = `Three.js C · ${windowLabel} · ${Math.round(pose * 100)}% · experimental`;
  }

  function drawComparison(pose) {
    drawReference(pose);
    if (gpuStudy && !lostContext) {
      gpuStudy.setPixelRatio(REFERENCE_PIXEL_RATIO);
      drawGpu(pose);
    }
  }

  function setPoseLabel(value) {
    const pose = Math.max(0, Math.min(1, value));
    poseLabel.textContent = `${(pose * 100).toFixed(1)}%`;
    return pose;
  }

  function onContextLost(event) {
    event.preventDefault();
    lostContext = true;
    stopMotion(false);
    contextFallback.hidden = false;
    contextFallback.textContent = 'Contexto WebGL perdido. A referência Canvas C permanece disponível como quadro estático; recarregue o estudo para tentar novamente.';
    gpuStudy.canvas.hidden = true;
    gpuPlaceholder.hidden = false;
    gpuPlaceholder.textContent = 'Contexto WebGL perdido. A referência Canvas continua disponível.';
    gpuCaption.textContent = 'Three.js C · contexto WebGL perdido';
    measureButton.disabled = pixelDiffButton.disabled = true;
    overlayButton.disabled = true;
    playButton.disabled = true;
    loseContextButton.disabled = true;
    status.textContent = 'A referência estática continua disponível; a medição GPU foi interrompida.';
    loadButton.hidden = false;
    loadButton.disabled = false;
    loadButton.textContent = 'Recarregar estudo GPU';
    restoreContextButton.hidden = false;
  }

  function onContextRestored() {
    lostContext=false;contextFallback.hidden=true;gpuStudy.canvas.hidden=false;gpuPlaceholder.hidden=true;
    measureButton.disabled=pixelDiffButton.disabled=playButton.disabled=loseContextButton.disabled=overlayButton.disabled=false;
    status.textContent='Contexto WebGL restaurado. Quadro estático retomado.';
    restoreContextButton.hidden = true;
    loadButton.hidden = true;
    drawGpu(Number(slider.value)/1000);
  }

  async function loadStudy() {
    if (loading || disposed || gpuStudy && !lostContext) return;
    loading = true;
    loadButton.disabled = true;
    status.textContent = 'Carregando renderer GPU…';
    try {
      if (!referenceReady) drawReference(referencePose);
      if (gpuStudy) { gpuStudy.dispose(); gpuStudy = undefined; }
      lostContext = false;
      const { mountGpuRibbon } = await import('./score-gpu-ribbon.js?v=header-clef-stem-6');
      if (disposed) return;
      gpuStudy = await mountGpuRibbon(gpuHost, { ...options, width: sceneWidth, height: sceneHeight });
      if (disposed) { gpuStudy.dispose(); gpuStudy = undefined; return; }
      gpuStudy.setPixelRatio(REFERENCE_PIXEL_RATIO);
      gpuStudy.canvas.setAttribute('aria-label', 'Renderer GPU experimental, comparação da partitura');
      gpuStudy.canvas.style.width = '100%';
      gpuStudy.canvas.style.height = 'auto';
      gpuStudy.canvas.addEventListener('webglcontextlost', onContextLost);
      gpuStudy.canvas.addEventListener('webglcontextrestored', onContextRestored);
      gpuPlaceholder.hidden = true;
      contextFallback.hidden = true;
      controls.hidden = false;
      playButton.disabled = false;
      loseContextButton.disabled = false;
      measureButton.disabled = pixelDiffButton.disabled = dprSelect.disabled = cpuThrottleCheck.disabled = false;
      overlayButton.disabled = false;
      restoreContextButton.hidden = true;
      loadButton.hidden = true;
      slider.value = '130';
      setPoseLabel(0.13);
      drawComparison(0.13);
      status.textContent = reducedMotion.matches
        ? 'Estudo pronto. Movimento reduzido: quadro estático até você iniciar a ida e volta.'
        : 'Estudo pronto. Ida e volta iniciada; use Pausar para manter um quadro estático.';
      if (!reducedMotion.matches) startMotion();
    } catch (error) {
      status.textContent = `Não foi possível iniciar o WebGL: ${error?.message ?? error}. A referência Canvas permanece disponível.`;
      loadButton.disabled = false;
      loadButton.hidden = false;
    } finally {
      loading = false;
    }
  }

  function stopMotion(sync = true) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    playing = false;
    lastFrameTime = fpsWindowStart = fpsWindowFrames = 0;
    playButton.textContent = 'Iniciar ida e volta';
    fpsOutput.textContent = 'RAF: parado';
    if (sync && gpuStudy && !lostContext) drawComparison(Number(slider.value) / 1000);
  }

  function startMotion() {
    if (!gpuStudy || lostContext || playing) return;
    playing = true;
    playButton.textContent = 'Pausar';
    lastFrameTime = fpsWindowStart = fpsWindowFrames = 0;
    const tick = now => {
      if (!playing || disposed || !gpuStudy || lostContext) return;
      if (!lastFrameTime) lastFrameTime = now;
      const elapsed = Math.min(50, now - lastFrameTime);
      lastFrameTime = now;
      fpsWindowFrames++;
      if (!fpsWindowStart) fpsWindowStart = now;

      let next = Number(slider.value) + elapsed * 0.125 * direction;
      if (next >= 1000) { next = 1000; direction = -1; }
      else if (next <= 0) { next = 0; direction = 1; }
      slider.value = String(next);
      const pose = setPoseLabel(next / 1000);
      drawGpu(pose);
      referenceCaption.textContent = `Canvas C · ${windowLabel} · referência estática ${Math.round(referencePose * 100)}%`;
      if (now - fpsWindowStart >= 500) {
        const rafFps = fpsWindowFrames * 1000 / (now - fpsWindowStart);
        fpsOutput.textContent = `Cadência RAF ${rafFps.toFixed(1)} callbacks/s · não é FPS GPU`;
        fpsWindowStart = now;
        fpsWindowFrames = 0;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
  }

  async function measureGpu() {
    if (!gpuStudy || lostContext) return;
    section.dataset.complete='false';
    measureButton.disabled = pixelDiffButton.disabled = dprSelect.disabled = cpuThrottleCheck.disabled = true;
    slider.disabled = true;
    loseContextButton.disabled = true;
    for (const button of section.querySelectorAll('[data-preset]')) button.disabled = true;
    const pixelRatio = Number(dprSelect.value);
    const condition = cpuThrottleCheck.checked
      ? '4× DevTools CPU throttling, user-confirmed (not controlled by this module)'
      : 'normal CPU condition, user-selected';
    const poses = Array.from({ length: 60 }, (_, index) => index / 59);
    const samples = [];
      const frameIntervals = [];
      const adaptiveDpr = createAdaptiveDpr(pixelRatio);
      const adaptiveDecisions = [];
      let previousFrameTimestamp = null;
    const started = performance.now();
    try {
      stopMotion(false);
      gpuStudy.setPixelRatio(pixelRatio);
      measureStatus.textContent = `Aquecendo o renderer GPU · DPR ${pixelRatio}×…`;
      for (let warmup = 0; warmup < 3; warmup++) {
        gpuStudy.draw(0.13, 'C');
        await nextFrame();
        gpuStudy.pollGPU();
      }
      for (let index = 0; index < poses.length; index++) {
        const pose = poses[index];
        const drawStarted = performance.now();
        const sample = gpuStudy.draw(pose, 'C', true);
        const callMs = performance.now() - drawStarted;
        samples.push({ pose, cpuMs: Number.isFinite(sample?.cpuMs) ? sample.cpuMs : callMs, gpuSample: sample });
        const frameTimestamp = await nextFrame();
        if (previousFrameTimestamp !== null) frameIntervals.push(frameTimestamp - previousFrameTimestamp);
        previousFrameTimestamp = frameTimestamp;
        const decision = adaptiveDpr.observe(frameTimestamp);
        if (decision) adaptiveDecisions.push(decision);
        gpuStudy.pollGPU();
        measureStatus.textContent = `Renderer GPU · ${index + 1}/60 · DPR ${pixelRatio}×`;
      }
      for (let wait = 0; wait < 120 && samples.some(item => item.gpuSample?.gpuStatus === 'pending'); wait++) {
        await nextFrame();
        gpuStudy.pollGPU();
      }
      const frames = samples.map(({ pose, cpuMs, gpuSample }) => ({
        pose,
        cpuMs,
        gpuMs: Number.isFinite(gpuSample?.gpuMs) ? gpuSample.gpuMs : null,
        gpuStatus: gpuSample?.gpuStatus ?? 'unsupported',
        geometryCached: gpuSample?.geometryCached ?? null,
        geometryMs: Number.isFinite(gpuSample?.geometryMs) ? gpuSample.geometryMs : null,
        submissionMs: Number.isFinite(gpuSample?.submissionMs) ? gpuSample.submissionMs : null,
        bufferUploadCalls: gpuSample?.bufferUploadCalls ?? null,
        frameTextureUploads: gpuSample?.frameTextureUploads ?? null,
      }));
      const cpu = summarize(frames.map(frame => frame.cpuMs).filter(Number.isFinite));
      const rafInterval = summarize(frameIntervals);
      const gpuValues = frames.filter(frame => frame.gpuStatus === 'available' && Number.isFinite(frame.gpuMs)).map(frame => frame.gpuMs);
      const gpu = summarize(gpuValues);
      const cpuPass = cpu.count === 60 && cpu.p95 <= 3.5;
      const gpuPass = gpu.count === 60 && gpu.median <= 8 && gpu.p95 <= 12;
      const result = cpuPass && gpuPass
        ? 'pass'
        : !cpuPass ? 'CPU p95 exceeds 3.5 ms or the series is incomplete'
          : 'GPU target not met or not verifiable: 60 valid timer samples are required';
      const report = {
        method: 'Three warmups followed by 60 C draws at evenly spaced poses from 0 to 100 percent. Canvas is not drawn inside this loop. RAF intervals use the 59 gaps between those 60 measured frame callbacks.',
        condition,
        environment: {
          userAgent: navigator.userAgent,
          viewport: { width: innerWidth, height: innerHeight },
          devicePixelRatio: window.devicePixelRatio,
          css: { width: sceneWidth, height: sceneHeight },
          backing: { width: gpuStudy.canvas.width, height: gpuStudy.canvas.height },
          rendererPixelRatio: pixelRatio,
          visibility: document.visibilityState,
          runMs: performance.now() - started,
          gpuRenderer: gpuStudy.metrics?.renderer ?? null,
          gpuTimerAvailable: gpuStudy.metrics?.gpuTimer ?? null,
          rendererMetrics: {
            geometryBuilds: gpuStudy.metrics?.geometryBuilds ?? null,
            triangulationPasses: gpuStudy.metrics?.triangulationPasses ?? null,
            geometryBytes: gpuStudy.metrics?.geometryBytes ?? null,
            frameTextureBytes: gpuStudy.metrics?.frameTextureBytes ?? null,
            bufferUploadCalls: gpuStudy.metrics?.bufferUploadCalls ?? null,
            bufferUploadBytes: gpuStudy.metrics?.bufferUploadBytes ?? null,
            actualFrameUploads: gpuStudy.metrics?.actualFrameUploads ?? null,
          },
        },
        thresholds: {
          cpu: 'p95 per-pose draw call <= 3.5 ms',
          raf: 'after 60 consecutive pose frames, p95 interval > 20 ms lowers DPR only: 1.5 -> 1.25 -> 1',
          gpu: 'median <= 8 ms and p95 <= 12 ms, with all 60 GPU timer samples valid',
        },
        summary: { cpu, rafInterval, adaptiveDecisions, recommendedDpr: adaptiveDpr.pixelRatio, gpu, validGpuSamples: gpu.count, result },
        limitations: [
          'GPU times depend on EXT_disjoint_timer_query_webgl2 support and valid, non-disjoint query results.',
          'The checkbox records the operator-selected DevTools CPU condition; it does not throttle or verify the browser.',
          'RAF intervals measure callback cadence, not display presentation or scanout.',
        ],
        frames,
      };
      const json = JSON.stringify(report, null, 2);
      reportElement.textContent = json;
      reportElement.dataset.gpuReport = JSON.stringify(report);
      section.dataset.complete = 'true';
      measureStatus.textContent = `Benchmark concluído · CPU p95 ${cpu.p95?.toFixed(3) ?? '—'} ms · RAF p95 ${rafInterval.p95?.toFixed(2) ?? '—'} ms · DPR recomendado ${adaptiveDpr.pixelRatio}× · GPU ${gpu.count}/60 · ${result}.`;
      gpuStudy.setPixelRatio(REFERENCE_PIXEL_RATIO);
      drawComparison(Number(slider.value) / 1000);
    } catch (error) {
      measureStatus.textContent = `Benchmark interrompido: ${error?.message ?? error}`;
    } finally {
      measureButton.disabled = pixelDiffButton.disabled = dprSelect.disabled = cpuThrottleCheck.disabled = Boolean(lostContext);
      slider.disabled = Boolean(lostContext);
      loseContextButton.disabled = Boolean(lostContext);
      for (const button of section.querySelectorAll('[data-preset]')) button.disabled = Boolean(lostContext);
    }
  }

  async function measurePixelDifferences() {
    if (!gpuStudy || lostContext) return;
    pixelDiffButton.disabled = measureButton.disabled = true;
    const results = [];
    try {
      stopMotion(false);
      gpuStudy.setPixelRatio(REFERENCE_PIXEL_RATIO);
      for (const pose of POSES) {
        renderCanvas(referenceCanvas, pose, true, 'C', 'auto', false, null, 3);
        gpuStudy.draw(pose, 'C');
        await nextFrame();
        const canvasPixels = referenceCanvas.getContext('2d').getImageData(0, 0, referenceCanvas.width, referenceCanvas.height);
        const gpuPixels = gpuStudy.readPixels({ mask: false });
        const maskPixels=gpuStudy.readPixels({mask:true});
        let goldCoveragePixels=0;for(let i=3;i<maskPixels.data.length;i+=4)if(maskPixels.data[i])goldCoveragePixels++;
        results.push({
          pose,
          background:{canvas:[...canvasPixels.data.slice(0,4)],gpu:[...gpuPixels.data.slice(0,4)]},
          mask:{goldCoveragePixels,totalPixels:maskPixels.width*maskPixels.height,channel:'alpha'},
          comparison: compareRgba(
            { data: canvasPixels.data, width: referenceCanvas.width, height: referenceCanvas.height },
            { data: gpuPixels.data, width: gpuPixels.width, height: gpuPixels.height },
          ),
          pixelRatio: gpuPixels.pixelRatio,
        });
        measureStatus.textContent = `Contagem RGBA · ${Math.round(pose * 100)}% concluído`;
      }
      const report = {
        method: 'Canvas/GPU readback at matching CSS size and 2× backing resolution. A pixel exceeds the 16/255 threshold when its largest RGB channel delta is greater than 16; alpha is excluded.',
        results,
        interpretation: 'Rasterization, edge antialiasing, color conversion, and shader composition can differ. Changed-channel counts and maximum delta do not establish visual parity or approval.',
      };
      const json = JSON.stringify(report, null, 2);
      reportElement.textContent = json;
      reportElement.dataset.gpuReport = JSON.stringify(report);
      measureStatus.textContent = `Contagem concluída · pixels com diferença RGB >16/255: ${results.map(item => `${Math.round(item.pose * 100)}% ${item.comparison.pixelsOver16Percent.toFixed(2)}%`).join(' · ')}.`;
      drawComparison(Number(slider.value) / 1000);
    } catch (error) {
      measureStatus.textContent = `Contagem RGBA interrompida: ${error?.message ?? error}`;
    } finally {
      pixelDiffButton.disabled = measureButton.disabled = Boolean(lostContext);
    }
  }

  async function drawFrontalOverlay() {
    if (!gpuStudy || lostContext) return;
    overlayButton.disabled = true;
    try {
      stopMotion(false);
      gpuStudy.setPixelRatio(REFERENCE_PIXEL_RATIO);
      drawReference(1);
      gpuStudy.draw(1, 'C');
      await nextFrame();
      const source = referenceCanvas.getContext('2d').getImageData(0, 0, referenceCanvas.width, referenceCanvas.height);
      const gpu = gpuStudy.readPixels({ mask: false });
      if (source.width !== gpu.width || source.height !== gpu.height) throw new Error('Canvas and GPU dimensions differ.');
      overlayPreview.width = source.width;
      overlayPreview.height = source.height;
      const context = overlayPreview.getContext('2d');
      const overlay = context.createImageData(source.width, source.height);
      for (let i = 0; i < overlay.data.length; i += 4) {
        const canvasWeight = Math.max(0, Math.min(1, (Math.max(source.data[i], source.data[i + 1], source.data[i + 2]) - 6) / 225));
        const gpuWeight = Math.max(0, Math.min(1, (Math.max(gpu.data[i], gpu.data[i + 1], gpu.data[i + 2]) - 6) / 225));
        if (canvasWeight > .025 && gpuWeight > .025) {
          const overlap = Math.max(canvasWeight, gpuWeight);
          overlay.data[i] = 6 + overlap * 249;
          overlay.data[i + 1] = 6 + overlap * 249;
          overlay.data[i + 2] = 9 + overlap * 246;
        } else if (canvasWeight > .025) {
          overlay.data[i] = 6;
          overlay.data[i + 1] = 6 + canvasWeight * 208;
          overlay.data[i + 2] = 9 + canvasWeight * 246;
        } else if (gpuWeight > .025) {
          overlay.data[i] = 6 + gpuWeight * 249;
          overlay.data[i + 1] = 6 + gpuWeight * 160;
          overlay.data[i + 2] = 9 + gpuWeight * 26;
        } else {
          overlay.data[i] = 6;
          overlay.data[i + 1] = 6;
          overlay.data[i + 2] = 9;
        }
        overlay.data[i + 3] = 255;
      }
      context.putImageData(overlay, 0, 0);
      overlayFigure.hidden = false;
      slider.value = '1000';
      setPoseLabel(1);
      drawGpu(1);
      status.textContent = 'Sobreposição frontal pronta: Canvas em ciano, GPU em âmbar.';
    } catch (error) {
      measureStatus.textContent = `Sobreposição interrompida: ${error?.message ?? error}`;
    } finally {
      overlayButton.disabled = Boolean(lostContext);
    }
  }

  loadButton.addEventListener('click', loadStudy);
  playButton.addEventListener('click', () => playing ? stopMotion() : startMotion());
  slider.addEventListener('input', () => {
    stopMotion(false);
    const pose = setPoseLabel(Number(slider.value) / 1000);
    if (gpuStudy && !lostContext) {
      drawGpu(pose);
      referenceCaption.textContent = `Canvas C · referência estática ${Math.round(referencePose * 100)}%`;
    }
  });
  slider.addEventListener('change', () => drawComparison(Number(slider.value) / 1000));
  for (const button of section.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.preset) / 100;
      slider.value = String(value * 1000);
      setPoseLabel(value);
      for (const candidate of section.querySelectorAll('[data-preset]')) candidate.setAttribute('aria-pressed', String(candidate === button));
      stopMotion(false);
      drawComparison(value);
    });
  }
  measureButton.addEventListener('click', measureGpu);
  pixelDiffButton.addEventListener('click', measurePixelDifferences);
  overlayButton.addEventListener('click', drawFrontalOverlay);
  loseContextButton.addEventListener('click', () => gpuStudy?.loseContext?.());
  restoreContextButton.addEventListener('click', () => gpuStudy?.restoreContext?.());
  function onMotionPreference(event){
    if (event.matches && playing) stopMotion();
  }
  reducedMotion.addEventListener?.('change',onMotionPreference);

  requestAnimationFrame(() => {
      if (disposed || referenceReady) return;
    try {
      drawReference(0.13);
      status.textContent = 'Referência Canvas C · 13% pronta. Carregue o renderer GPU quando quiser.';
    } catch (error) {
      status.textContent = `Não foi possível desenhar a referência Canvas: ${error?.message ?? error}`;
    }
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopMotion(false);
    reducedMotion.removeEventListener?.('change',onMotionPreference);
    gpuStudy?.dispose();
    gpuStudy = undefined;
    source.remove();
  }
  addEventListener('pagehide', dispose, { once: true });

  if (new URLSearchParams(location.search).get('score-gpu') === 'study' && !reducedMotion.matches) loadStudy();
  else if (reducedMotion.matches) status.textContent = 'Movimento reduzido: referência Canvas estática pronta; carregue o renderer GPU quando desejar.';
  return { section, dispose };
}
