import { scoreRibbonData } from './score-ribbon-data.js';
import { scoreRibbonTimeline as score, STATIC_SCORE_BEAT } from './score-ribbon-timeline.js';
import { scorePlaybackWindowAtBeat, scorePositionAtBeat, scoreWindowAtBeat } from './score-ribbon-timeline.js';
import { drawScoreRibbon, staffYForMidi, visualVoiceSegments, voiceRibbonPoints } from './score-ribbon-renderer.js';
import { buildEngraving } from './score-engraving.js';
import { buildCompoundGroups } from './score-compound-groups.js';
import { createTravelProjector, viewportStaffScale } from './score-travel-geometry.js?v=about-mobile-framing-4';
import { fitCloseZoom, projectedHeadWidth, limitCloseZoom } from './score-close-framing.js?v=about-mobile-framing-4';
import { createAdaptiveDpr, initialGpuPixelRatio } from './score-gpu-budget.js';
import { shouldEnableScoreLight } from './score-gpu-route.js?v=score-light-1';
import { scoreSourceRange, trebleClefFromTimeline } from './score-gpu-ribbon-geometry.js?v=header-clef-space-4';

const CHAPTER_POSES = { opening: 0, code: 0, music: 1, art: .52, games: .78, closing: 1 };
const PITCH_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const STATIC_WINDOW = scoreWindowAtBeat(STATIC_SCORE_BEAT, 1280);
const STATIC_WINDOW_WIDTH = STATIC_WINDOW.endX - STATIC_WINDOW.startX;
const scoreLightEnabled = typeof window === 'undefined'
  || shouldEnableScoreLight(new URLSearchParams(window.location.search));

export function selectedNotationForBars(firstBar, lastBar) {
  const first = Math.max(1, Math.min(score.bars.length, Math.floor(firstBar)));
  const last = Math.max(first, Math.min(score.bars.length, Math.floor(lastBar)));
  const bars = score.bars.slice(first - 1, last);
  const view = { x0: bars[0].xStart, x1: bars.at(-1).xEnd };
  const glyphs = new Map(score.pdfGlyphs.filter(glyph => glyph.noteId).map(glyph => [glyph.noteId, glyph]));
  const heads = scoreRibbonData.systems.flatMap(system => system.heads).filter(head => head.bar >= first && head.bar <= last);
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
  return { view, points, engraving, groups, voicePaths, firstBar: first, lastBar: last };
}

export function selectedNotation() {
  return selectedNotationForBars(STATIC_WINDOW.firstBar, STATIC_WINDOW.lastBar);
}

export function playbackNotationAtBeat(beat) {
  const frame = scorePlaybackWindowAtBeat(beat, 1280, STATIC_WINDOW_WIDTH);
  return { ...selectedNotationForBars(frame.firstBar, frame.lastBar), sourceRange: { x0: frame.startX, x1: frame.endX } };
}

function loadTransitionStylesheet() {
  if (document.querySelector('[data-score-ribbon-transition-style]')) return null;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./score-ribbon-transition.css?gpu-scroll-games-readability-3', import.meta.url);
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
  let activeNotation = notation;
  let activeWindowKey = `${notation.firstBar}:${notation.lastBar}`;
  const clefGlyph = trebleClefFromTimeline(score).glyph;
  let activeSourceRange = scoreSourceRange(notation.view, score.bars, score.staffLines, true, clefGlyph);
  const state = { pose: 0, journey: 0, zoom: 1, frameOffset: { x: 0, y: 0 }, chapter: 'opening', motionEnabled: true, reducedMotion: false, timestamp: null };
  const dprBudget = createAdaptiveDpr(initialGpuPixelRatio(window.devicePixelRatio));
  let width = 0, height = 0, pixelRatio = initialGpuPixelRatio(window.devicePixelRatio);
  let gpu = null, gpuLoading = false, gpuFailed = false, pageVisible = false, disposed = false,
    lastPose = null, lastZoom = null, lastJourney = null, lastPlaybackBeat = -1, lastPlaybackActive = false;
  let lastChapter = null;
  let lastFrameX = null, lastFrameY = null;
  let lastSourceRange = null;
  let lastFallbackChapter = '', fallbackDirty = true, resizeFrame = 0;
  let flowFrame = 0, lastFlowPhase = 0;
  const closeProjectionScratch = {};
  const closeHead = notation.groups.flatMap(group => group.heads).find(head => head.noteId === 'guitar-33-3-1');
  const headContour = closeHead?.contours.flat() ?? [];
  const closeHeadWidth = headContour.length ? Math.max(...headContour.map(p=>p.u))-Math.min(...headContour.map(p=>p.u)) : 3;
  let closeFitKey='', closeFitZoom=1, safeFitKey='', safeFitZoom=1;

  function stopFlow() {
    if (!flowFrame) return;
    cancelAnimationFrame(flowFrame);
    flowFrame = 0;
  }

  function animateFlow(timestamp) {
    flowFrame = 0;
    if (disposed || !gpu || gpuFailed || !pageVisible || document.hidden || state.reducedMotion || !state.motionEnabled) return;
    const phase = (timestamp / 11500) % 1;
    renderPose(state.pose, null, phase);
    flowFrame = requestAnimationFrame(animateFlow);
  }

  function startFlow() {
    if (flowFrame || disposed || !gpu || gpuFailed || !pageVisible || document.hidden || state.reducedMotion || !state.motionEnabled) return;
    flowFrame = requestAnimationFrame(animateFlow);
  }

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
    const mobileCrop = width <= 700 ? (notation.view.x1 - notation.view.x0) * .25 : 0;
    drawScoreRibbon(context, width, height, score, {
      progress: pose,
      foldProgress: pose,
      motionEnabled: false,
      viewStart: notation.view.x0 + mobileCrop,
      viewEnd: notation.view.x1 - mobileCrop,
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

  function renderPose(pose, timestamp, flowPhase = lastFlowPhase) {
    if (!gpu || gpuFailed || !pageVisible || document.hidden || state.reducedMotion || !state.motionEnabled) return;
    flowPhase = Number.isFinite(flowPhase) ? flowPhase : 0;
    let frameX = Number.isFinite(state.frameOffset?.x) ? state.frameOffset.x : 0;
    let frameY = Number.isFinite(state.frameOffset?.y) ? state.frameOffset.y : 0;
    const playbackBeat = Number.isFinite(state.playbackSnapshot?.beat) ? state.playbackSnapshot.beat : -1;
    const playbackActive = ['starting', 'playing', 'paused', 'finished'].includes(state.playbackSnapshot?.state)
      && playbackBeat >= 0;
    const closeWeight = Math.max(0, Math.min(1, state.materialClose ?? 0));
    let drawZoom=state.zoom;
    const view=activeSourceRange;
    const middle=(score.staffLines[0]+score.staffLines.at(-1))/2;
    const anchor=!playbackActive&&closeHead?closeHead.anchor
      :{u:view.x0+(view.x1-view.x0)*.35,v:middle};
    const options={width,height,score,pose,view,anchor,headWidth:closeHeadWidth};
    if(closeWeight>0&&width<=700) {
      const key=[width,height,pose,view.x1-view.x0,(anchor.u-view.x0)/(view.x1-view.x0),anchor.v].join(':');
      if(key!==closeFitKey) {closeFitZoom=fitCloseZoom(options,width<=360?22:28,closeProjectionScratch);closeFitKey=key;}
      drawZoom+=(closeFitZoom-drawZoom)*closeWeight;
    }
    const safetyProgress=Math.max(0,Math.min(1,(state.journey-2)/.24));
    const safetyBlend=safetyProgress*safetyProgress*(3-2*safetyProgress);
    if(safetyBlend>0&&state.journey<=4) {
      const key=[width,height,pose,view.x1-view.x0,drawZoom].join(':');
      if(key!==safeFitKey) {
        safeFitZoom=limitCloseZoom({...options,zoom:drawZoom,headWidth:closeHeadWidth*1.1},width<=700?50:90,closeProjectionScratch);
        safeFitKey=key;
      }
      drawZoom+=(safeFitZoom-drawZoom)*safetyBlend;
    }
    if(closeWeight>0) {
      if(width<=700)host.dataset.scoreCloseWidth=projectedHeadWidth({...options,zoom:drawZoom},closeProjectionScratch).toFixed(2);
      const projector=createTravelProjector(width,height,score,pose,view,.2,true,closeProjectionScratch,drawZoom);
      const mobileScale=viewportStaffScale(width, drawZoom, pose);
      const target=projector(anchor.u,middle+(anchor.v-middle)*mobileScale);
      // One camera correction follows the musical anchor; every piece keeps its UV.
      frameX+=(width*.5-target.x-frameX)*closeWeight;
      frameY+=(height*.54-target.y-frameY)*closeWeight;
    }
    const readingChanged = gpu.setReadingRegions(state.readingRegions);
    if (!readingChanged && lastPose === pose && lastZoom === drawZoom && lastJourney === state.journey && lastFrameX === frameX && lastFrameY === frameY
      && lastPlaybackBeat === playbackBeat && lastPlaybackActive === playbackActive
      && lastChapter === state.chapter
      && lastFlowPhase === flowPhase
      && lastSourceRange?.x0 === activeSourceRange.x0 && lastSourceRange?.x1 === activeSourceRange.x1) return;
    const decision = Number.isFinite(timestamp) ? dprBudget.observe(timestamp) : null;
    if (decision?.lowered) {
      pixelRatio = decision.pixelRatio;
      gpu.setPixelRatio(pixelRatio);
    }
    gpu.setSourceRange(activeSourceRange.x0, activeSourceRange.x1);
    gpu.draw(pose, 'C', false, drawZoom, { x: frameX, y: frameY }, state.chapter === 'music', scoreLightEnabled,
      flowPhase, state.journey, { beat: playbackBeat, active: playbackActive });
    exposeGpu();
    lastPose = pose;
    lastZoom = drawZoom;
    lastJourney = state.journey;
    lastPlaybackBeat = playbackBeat;
    lastPlaybackActive = playbackActive;
    lastFrameX = frameX;
    lastFrameY = frameY;
    lastChapter = state.chapter;
    lastFlowPhase = flowPhase;
    lastSourceRange = { ...activeSourceRange };
    host.dataset.scoreGpuJourney = state.journey.toFixed(4);
    host.dataset.scorePigment = gpu.metrics.pigmentReady ? "ready" : "pending";
    host.dataset.scoreGpuPose = pose.toFixed(6);
    host.dataset.scoreGpuDpr = String(pixelRatio);
    host.dataset.scoreGpuFlow = flowPhase.toFixed(4);
    host.dataset.scoreGpuZoom = drawZoom.toFixed(2);
    host.dataset.scoreGpuBeat = playbackBeat >= 0 ? playbackBeat.toFixed(2) : 'off';
    host.dataset.scoreGpuPlayback = playbackActive ? 'active' : 'off';
  }

  async function mountGpu() {
    if (disposed || gpu || gpuLoading || gpuFailed || state.reducedMotion) return;
    gpuLoading = true;
    try {
      const { mountGpuRibbon } = await import('./score-gpu-ribbon.js?v=about-mobile-framing-4');
      if (disposed) return;
      gpu = await mountGpuRibbon(host, {
        score,
        ...activeNotation,
        width,
        height,
        pixelRatio,
        diagnostics: false,
        markerId: null,
      });
      if (disposed) { gpu.dispose(); gpu = null; return; }
      gpu.canvas.addEventListener('webglcontextlost', onContextLost);
      if (pageVisible && !document.hidden && state.motionEnabled && !state.reducedMotion) {
        renderPose(state.pose, state.timestamp);
        startFlow();
      }
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
    const playback = nextState.playbackSnapshot;
    const playbackActive = ['starting', 'playing', 'paused', 'finished'].includes(playback?.state)
      && Number.isFinite(playback?.beat);
    if (playbackActive) {
      const window = scorePlaybackWindowAtBeat(playback.beat, 1280, STATIC_WINDOW_WIDTH);
      const key = `${window.firstBar}:${window.lastBar}`;
      if (key !== activeWindowKey) {
        activeNotation = selectedNotationForBars(window.firstBar, window.lastBar);
        activeWindowKey = key;
        if (gpu) gpu.setNotation(activeNotation);
        lastPose = null;
        lastSourceRange = null;
      }
      activeSourceRange = { x0: window.startX, x1: window.endX };
    } else {
      const staticKey = `${notation.firstBar}:${notation.lastBar}`;
      if (activeWindowKey !== staticKey) {
        activeNotation = notation;
        activeWindowKey = staticKey;
        if (gpu) gpu.setNotation(activeNotation);
        lastPose = null;
        lastSourceRange = null;
      }
      activeSourceRange = scoreSourceRange(notation.view, score.bars, score.staffLines, true, clefGlyph);
    }
    if (!pageVisible || document.hidden) { stopFlow();return; }
    if (state.reducedMotion || gpuFailed) {
      stopFlow();
      drawFallback(state.chapter);
      return;
    }
    if (!gpu && !gpuFailed) {
      drawFallback(state.chapter);
      mountGpu();
      return;
    }
    if (!state.motionEnabled) {
      stopFlow();
      if (lastPose === null || !gpu) drawFallback(state.chapter);
      return;
    }
    renderPose(state.pose, state.timestamp);
    if (state.playbackSnapshot?.state === "playing") stopFlow();
    else startFlow();
  }

  resizeFallback();
  const visibilityObserver = new IntersectionObserver(entries => {
    pageVisible = Boolean(entries[0]?.isIntersecting);
    if (!pageVisible) stopFlow();
    else if (pageVisible && state.reducedMotion) drawFallback(state.chapter);
    else if (pageVisible && state.motionEnabled && !gpu && !gpuFailed) {
      drawFallback(state.chapter);
      mountGpu();
    } else if (pageVisible && state.motionEnabled) {
      renderPose(state.pose, performance.now());
      startFlow();
    }
  }, { threshold: 0 });
  visibilityObserver.observe(root);
  const onVisibility = () => {
    if (document.hidden) { stopFlow();return; }
    if (pageVisible && state.motionEnabled && !state.reducedMotion) {
      renderPose(state.pose, performance.now());
      startFlow();
    } else if (pageVisible) drawFallback(state.chapter, true);
  };
  const onResize = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(async () => {
      resizeFrame = 0;
      stopFlow();
      resizeFallback();
      if (gpu) { gpu.canvas.removeEventListener('webglcontextlost', onContextLost);gpu.dispose();gpu = null;lastPose = null;lastZoom = null; }
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
      return { firstBar: activeNotation.firstBar, lastBar: activeNotation.lastBar,
        playbackActive: ['starting', 'playing', 'paused', 'finished'].includes(nextState.playbackSnapshot?.state)
          && Number.isFinite(nextState.playbackSnapshot?.beat) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopFlow();
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
      delete host.dataset.scoreGpuFlow;
      delete host.dataset.scoreGpuZoom;
      delete host.dataset.scoreGpuBeat;
      delete host.dataset.scoreGpuPlayback;
      delete document.body.dataset.scoreGpuScroll;
      delete document.body.dataset.scoreRibbonTransition;
    },
  };
}
