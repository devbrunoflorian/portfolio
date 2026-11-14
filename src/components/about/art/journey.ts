import { journeyState, type JourneyChapter } from './journey-state';

/** Owns this stage only: scroll, pointer, masks and lifecycle share one frame. */
export function mountAboutJourney(root: HTMLElement) {
  const composition = root.querySelector<HTMLElement>('[data-art-composition]')!;
  const panels = [...root.querySelectorAll<HTMLElement>('[data-journey-panel]')];
  const thresholds = [...root.querySelectorAll<SVGFEFuncRElement>('[data-art-threshold]')];
  const field = root.querySelector<SVGRadialGradientElement>('#art-reveal-field')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
  let disposed = false;
  let suspended = false;
  let frame = 0;
  let layoutDirty = true;
  let start = 0;
  let travel = 1;
  let width = 1;
  let visible = false;
  let chapter: JourneyChapter | null = null;
  let interactiveChapter: JourneyChapter | null = null;
  const hashPositions: Record<string, number> = { music: 0, art: .5, games: 1 };
  let fontsReady = false;
  let hashSeekPending = Object.hasOwn(hashPositions, location.hash.slice(1));
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function measure() {
    const bounds = root.getBoundingClientRect();
    start = scrollY + bounds.top;
    travel = Math.max(1, root.offsetHeight - innerHeight);
    width = bounds.width;
    layoutDirty = false;
  }

  function setChapter(next: JourneyChapter | null) {
    if (chapter === next) return;
    chapter = next;
    if (next) root.dataset.currentChapter = next;
    else delete root.dataset.currentChapter;
    window.dispatchEvent(new Event('about-journey-change'));
  }

  function setInteractiveChapter(next: JourneyChapter | null) {
    if (interactiveChapter === next) return;
    interactiveChapter = next;
    if (next) root.dataset.interactiveChapter = next;
    else delete root.dataset.interactiveChapter;
    for (const panel of panels) {
      const inactive = !!next && panel.dataset.journeyPanel !== next;
      panel.inert = inactive;
      if (inactive) panel.setAttribute('aria-hidden', 'true');
      else panel.removeAttribute('aria-hidden');
    }
  }

  function render() {
    frame = 0;
    if (disposed || suspended || document.hidden) return;
    if (layoutDirty) measure();
    if (reduced.matches) {
      root.dataset.journeyMode = 'static';
      composition.removeAttribute('data-masked');
      composition.style.removeProperty('visibility');
      setChapter(null);
      setInteractiveChapter(null);
      return;
    }
    root.dataset.journeyMode = 'pinned';
    const state = journeyState(scrollY, start, travel);
    root.dataset.journeyProgress = state.progress.toFixed(5);
    root.dataset.artPresence = state.presence.toFixed(5);
    root.dataset.journeyPhase = state.entering ? 'entering-art' : 'leaving-art';
    setChapter(state.chapter);
    setInteractiveChapter(state.interactiveChapter);
    // Music is below Art on entry; Games is below Art on exit.
    root.dataset.underlay = state.entering ? 'music' : 'games';
    const paused = document.documentElement.dataset.motionPaused === 'true';
    const presence = state.presence;
    if (presence >= 1 - 1e-6) composition.removeAttribute('data-masked');
    else composition.dataset.masked = 'true';
    composition.style.visibility = presence <= 0 ? 'hidden' : 'visible';
    const intercept = String(12 * presence - 11);
    for (const channel of thresholds) channel.setAttribute('intercept', intercept);
    field.setAttribute('cy', state.entering ? '.15' : '.85');
    const enabled = visible && !paused && hover.matches;
    const targetX = enabled ? pointer.targetX : 0;
    const targetY = enabled ? pointer.targetY : 0;
    if (paused) {
      pointer.x = 0;
      pointer.y = 0;
    } else {
      pointer.x += (targetX - pointer.x) * .16;
      pointer.y += (targetY - pointer.y) * .16;
    }
    root.style.setProperty('--art-pointer-x', pointer.x.toFixed(4));
    root.style.setProperty('--art-pointer-y', pointer.y.toFixed(4));
    root.style.setProperty('--art-depth', paused ? '0' : state.depth.toFixed(4));
    if (enabled && (Math.abs(targetX - pointer.x) > .002 || Math.abs(targetY - pointer.y) > .002)) schedule();
  }

  function schedule() {
    if (!frame && !disposed && !suspended && !document.hidden) frame = requestAnimationFrame(render);
  }
  function invalidate() { layoutDirty = true; schedule(); }
  function setMode() {
    root.dataset.journeyMode = reduced.matches ? 'static' : 'pinned';
    invalidate();
  }
  function resetPointer() { pointer.targetX = 0; pointer.targetY = 0; schedule(); }
  function seekHash() {
    if (reduced.matches) return;
    const target = location.hash.slice(1);
    if (Object.hasOwn(hashPositions, target)) {
      if (layoutDirty) measure();
      scrollTo({ top: start + travel * hashPositions[target]!, behavior: 'instant' });
      schedule();
    }
  }
  function cancelPendingHashSeek() { hashSeekPending = false; }
  function handleHashChange() {
    hashSeekPending = !fontsReady && Object.hasOwn(hashPositions, location.hash.slice(1));
    seekHash();
  }

  window.addEventListener('scroll', schedule, { passive: true, signal: events.signal });
  window.addEventListener('resize', invalidate, { passive: true, signal: events.signal });
  window.addEventListener('hashchange', handleHashChange, { signal: events.signal });
  window.addEventListener('wheel', cancelPendingHashSeek, { passive: true, signal: events.signal });
  window.addEventListener('touchstart', cancelPendingHashSeek, { passive: true, signal: events.signal });
  window.addEventListener('pointerdown', cancelPendingHashSeek, { signal: events.signal });
  window.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      cancelPendingHashSeek();
    }
  }, { signal: events.signal });
  root.addEventListener('pointermove', event => {
    if (!hover.matches || reduced.matches || !visible) return;
    pointer.targetX = Math.max(-1, Math.min(1, (event.clientX / width - .5) * 2));
    pointer.targetY = Math.max(-1, Math.min(1, (event.clientY / innerHeight - .5) * 2));
    schedule();
  }, { passive: true, signal: events.signal });
  root.addEventListener('pointerleave', resetPointer, { signal: events.signal });
  reduced.addEventListener('change', setMode, { signal: events.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else invalidate();
  }, { signal: events.signal });
  window.addEventListener('pagehide', event => {
    hashSeekPending = false;
    if (!event.persisted) { dispose(); return; }
    suspended = true; cancelAnimationFrame(frame); frame = 0;
  }, { signal: events.signal });
  window.addEventListener('pageshow', () => { suspended = false; invalidate(); }, { signal: events.signal });

  const intersection = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (!visible) resetPointer();
    schedule();
  });
  intersection.observe(root);
  const layout = new ResizeObserver(invalidate);
  layout.observe(document.querySelector('[data-about-page]') ?? root);
  const motion = new MutationObserver(schedule);
  motion.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion-paused'] });
  document.fonts.ready.then(() => {
    if (disposed) return;
    fontsReady = true;
    invalidate();
    if (hashSeekPending) {
      hashSeekPending = false;
      seekHash();
    }
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    events.abort(); cancelAnimationFrame(frame);
    intersection.disconnect(); layout.disconnect(); motion.disconnect();
    setChapter(null);
    setInteractiveChapter(null);
    root.removeAttribute('data-journey-mode');
    composition.removeAttribute('data-masked');
    composition.style.removeProperty('visibility');
    root.style.removeProperty('--art-pointer-x');
    root.style.removeProperty('--art-pointer-y');
    root.style.removeProperty('--art-depth');
  }
  setMode();
  return { dispose };
}
