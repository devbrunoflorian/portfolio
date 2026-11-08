import { scoreRibbonData } from './score-ribbon-data.js';
import { scoreRibbonTimeline as score, STATIC_SCORE_BEAT } from './score-ribbon-timeline.js';
import { scorePositionAtBeat } from './score-ribbon-timeline.js';
import { drawScoreRibbon, staffYForMidi, visualVoiceSegments, voiceRibbonPoints } from './score-ribbon-renderer.js';
import { buildEngraving } from './score-engraving.js';
import { buildCompoundGroups } from './score-compound-groups.js';
import { createAdaptiveDpr, initialGpuPixelRatio } from './score-gpu-budget.js';

const CHAPTER_POSES = { opening: 0, code: 0, music: 1, art: .52, games: .78, closing: 1 };
const PITCH_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export function selectedNotation() {
  const bars = score.bars.slice(30, 33);
  const view = { x0: bars[0].xStart, x1: bars.at(-1).xEnd };
  const glyphs = new Map(score.pdfGlyphs.filter(glyph => glyph.noteId).map(glyph => [glyph.noteId, glyph]));
  const heads = scoreRibbonData.systems.flatMap(system => system.heads).filter(head => head.bar >= 31 && head.bar <= 33);
  const points = heads.map(head => ({
    id: head.id,
    bar: head.bar,
    midi: head.writtenMidi,
    x: glyphs.get(head.id).x,
    y: -((Math.floor(head.writtenMidi / 12) - 1) * 7 + PITCH_STEP[head.writtenMidi % 12] - 30),
  }));
  const engraving = buildEngraving(score, points, view);
  const groups = buildCompoundGroups(engraving, score);
  const voicePaths = [1, 2].flatMap(track => visualVoiceSegments(score.voices, track, view).map(segment => {
    const notes = segment.map(note => ({ ...note, y: staffYForMidi(note.writtenMidi, score) }));
    return { track, notes, points: voiceRibbonPoints(notes, (x, y) => ({ x, y })) };
  }));
  return { view, points, engraving, groups, voicePaths };
}

function loadTransitionStylesheet() {
  if (document.querySelector('[data-score-ribbon-transition-style]')) return null;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./score-ribbon-transition.css?gpu-scroll-games-readability-2', import.meta.url);
  stylesheet.dataset.scoreRibbonTransitionStyle = '';
  document.head.append(stylesheet);
  return stylesheet;
}

function waitForStylesheet(stylesheet) {
  if (!stylesheet || stylesheet.sheet) return Promise.resolve();
  return new Promise(resolve => {
    let timeout;
    const done = () => { clearTimeout(timeout);resolve(); };
    stylesheet.addEventListener('load', done, { once: true });
    stylesheet.addEventListener('error', done, { once: true });
    timeout = setTimeout(done, 2000);
  });
}

export async function mountAboutGpuScroll(root, host = root.querySelector('[data-score-thread]')) {
  if (!root || !host) throw new Error('The About score thread is missing.');
  document.body.dataset.scoreRibbonTransition = 'true';
  document.body.dataset.scoreGpuScroll = 'true';
  const stylesheet = loadTransitionStylesheet();
  await waitForStylesheet(stylesheet);
  const fallback = document.createElement('canvas');
  fallback.className = 'score-gpu-scroll-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  Object.assign(fallback.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%', pointerEvents: 'none' });
  host.append(fallback);

  const notation = selectedNotation();
  const state = { pose: 0, chapter: 'opening', motionEnabled: true, reducedMotion: false, timestamp: null };
  const dprBudget = createAdaptiveDpr(initialGpuPixelRatio(window.devicePixelRatio));
  let width = 0, height = 0, pixelRatio = initialGpuPixelRatio(window.devicePixelRatio);
  let gpu = null, gpuLoading = false, gpuFailed = false, pageVisible = false, disposed = false, lastPose = null;
  let lastFallbackChapter = '', fallbackDirty = true, resizeFrame = 0;

  function resizeFallback() {
    width = window.innerWidth;
    height = window.innerHeight;
    fallback.width = Math.max(1, Math.round(width * Math.min(window.devicePixelRatio || 1, 1.5)));
    fallback.height = Math.max(1, Math.round(height * Math.min(window.devicePixelRatio || 1, 1.5)));
    fallbackDirty = true;
  }

  function fallbackPose(chapter) { return CHAPTER_POSES[chapter] ?? 0; }

  function drawFallback(chapter, force = false) {
    if (disposed || !width || !height) return;
    if (!force && !fallbackDirty && lastFallbackChapter === chapter) {
      fallback.hidden = false;
      if (gpu?.canvas) gpu.canvas.hidden = true;
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const context = fallback.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const beat = STATIC_SCORE_BEAT;
    const pose = fallbackPose(chapter);
    drawScoreRibbon(context, width, height, score, {
      progress: pose,
      foldProgress: pose,
      motionEnabled: false,
      viewStart: notation.view.x0,
      viewEnd: notation.view.x1,
      playbackBeat: null,
      playbackX: scorePositionAtBeat(beat),
    });
    fallback.hidden = false;
    if (gpu?.canvas) gpu.canvas.hidden = true;
    fallbackDirty = false;
    lastFallbackChapter = chapter;
  }

  function exposeGpu() {
    if (!gpu?.canvas || gpuFailed) return;
    gpu.canvas.classList.add('score-gpu-scroll-canvas');
    gpu.canvas.setAttribute('aria-hidden', 'true');
    gpu.canvas.removeAttribute('aria-label');
    Object.assign(gpu.canvas.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%', pointerEvents: 'none' });
    gpu.canvas.hidden = false;
    fallback.hidden = true;
  }

  function renderPose(pose, timestamp) {
    if (!gpu || gpuFailed || !pageVisible || document.hidden || state.reducedMotion || !state.motionEnabled) return;
    if (lastPose === pose) return;
    const decision = Number.isFinite(timestamp) ? dprBudget.observe(timestamp) : null;
    if (decision?.lowered) {
      pixelRatio = decision.pixelRatio;
      gpu.setPixelRatio(pixelRatio);
    }
    gpu.draw(pose, 'C', false);
    exposeGpu();
    lastPose = pose;
    host.dataset.scoreGpuPose = pose.toFixed(6);
    host.dataset.scoreGpuDpr = String(pixelRatio);
  }

  async function mountGpu() {
    if (disposed || gpu || gpuLoading || gpuFailed || state.reducedMotion) return;
    gpuLoading = true;
    try {
      const { mountGpuRibbon } = await import('./score-gpu-ribbon.js?v=score-voices-2026-11-08');
      if (disposed) return;
      gpu = await mountGpuRibbon(host, {
        score,
        ...notation,
        width,
        height,
        pixelRatio,
        diagnostics: false,
      });
      if (disposed) { gpu.dispose(); gpu = null; return; }
      gpu.canvas.addEventListener('webglcontextlost', onContextLost);
      if (pageVisible && !document.hidden && state.motionEnabled && !state.reducedMotion) renderPose(state.pose, state.timestamp);
      else drawFallback(state.chapter, true);
    } catch (error) {
      gpuFailed = true;
      console.warn('The About GPU score is unavailable; using its static Canvas fallback.', error);
      drawFallback(state.chapter, true);
    } finally {
      gpuLoading = false;
    }
  }

  function onContextLost() {
    gpuFailed = true;
    lastPose = null;
    drawFallback(state.chapter, true);
  }

  function update(nextState) {
    if (disposed) return;
    Object.assign(state, nextState);
    if (!pageVisible || document.hidden) return;
    if (state.reducedMotion) {
      drawFallback(state.chapter);
      return;
    }
    if (!gpu && !gpuFailed) {
      drawFallback(state.chapter);
      mountGpu();
      return;
    }
    if (!state.motionEnabled) {
      if (lastPose === null || !gpu) drawFallback(state.chapter);
      return;
    }
    renderPose(state.pose, state.timestamp);
  }

  resizeFallback();
  const visibilityObserver = new IntersectionObserver(entries => {
    pageVisible = Boolean(entries[0]?.isIntersecting);
    if (pageVisible && state.reducedMotion) drawFallback(state.chapter);
    else if (pageVisible && state.motionEnabled && !gpu && !gpuFailed) {
      drawFallback(state.chapter);
      mountGpu();
    } else if (pageVisible && state.motionEnabled) {
      renderPose(state.pose, performance.now());
    }
  }, { threshold: 0 });
  visibilityObserver.observe(root);
  const onVisibility = () => {
    if (document.hidden) return;
    if (pageVisible && state.motionEnabled && !state.reducedMotion) {
      renderPose(state.pose, performance.now());
    } else if (pageVisible) drawFallback(state.chapter, true);
  };
  const onResize = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(async () => {
      resizeFrame = 0;
      resizeFallback();
      if (gpu) { gpu.canvas.removeEventListener('webglcontextlost', onContextLost);gpu.dispose();gpu = null;lastPose = null; }
      if (state.reducedMotion) drawFallback(state.chapter, true);
      else if (pageVisible) await mountGpu();
    });
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize, { passive: true });

  return {
    update(nextState) {
      if (Number.isFinite(nextState.pose)) {
        // The main page supplies a pure, chapter-keyed pose from global scroll progress.
        state.pose = nextState.pose;
      }
      update({ ...nextState, pose: state.pose });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      gpu?.canvas.removeEventListener('webglcontextlost', onContextLost);
      gpu?.dispose();
      fallback.remove();
      stylesheet?.remove();
      delete host.dataset.scoreGpuPose;
      delete host.dataset.scoreGpuDpr;
      delete document.body.dataset.scoreGpuScroll;
      delete document.body.dataset.scoreRibbonTransition;
    },
  };
}
