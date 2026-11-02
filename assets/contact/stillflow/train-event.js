const asset = '/assets/contact/stillflow/events/sf04/train-passage-10fps.mp4';
const fadeDuration = 1800;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const parameters = new URLSearchParams(location.search);
const forcedOnce = parameters.get('train') === '1';

function mountTrainEvent() {
  const stage = document.querySelector('[data-contact-stage]');
  if (!stage || !document.body.classList.contains('sf-public')) return () => {};

  const video = document.createElement('video');
  video.className = 'sf-train-event';
  video.width = 1280;
  video.height = 720;
  video.muted = true;
  video.defaultMuted = true;
  video.playbackRate = 1;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  stage.append(video);

  const pauseButton = document.querySelector('[data-sf-pause]');
  const life = new AbortController();
  let visible = true;
  let disposed = false;
  let played = false;
  let failed = false;
  let eventState = 'idle';
  let timer = 0;
  let fadeAnimation;

  const stateId = () => stage.dataset.sfState
    || stage.querySelector('[data-sf-frame][data-sf-current]')?.dataset.sfState
    || 'rainy';
  const isStable = () => !stage.dataset.sfPhase || stage.dataset.sfPhase === 'idle';
  const isPaused = () => stage.dataset.sfPaused === 'true'
    || pauseButton?.getAttribute('aria-pressed') === 'true';
  const canRun = () => !disposed && !failed && !reducedMotion.matches
    && !document.hidden && visible && !isPaused() && stateId() === 'rainy' && isStable();

  function clearTimer() {
    window.clearTimeout(timer);
    timer = 0;
  }

  function animateOpacity(target) {
    fadeAnimation?.cancel();
    fadeAnimation = undefined;
    if (typeof video.animate !== 'function') {
      video.style.opacity = String(target);
      return undefined;
    }

    const from = Number.parseFloat(getComputedStyle(video).opacity) || 0;
    const animation = video.animate(
      [{ opacity: from }, { opacity: target }],
      { duration: fadeDuration, easing: 'ease-in-out', fill: 'both' },
    );
    fadeAnimation = animation;
    animation.addEventListener('finish', () => {
      if (fadeAnimation !== animation) return;
      video.style.opacity = String(target);
      fadeAnimation = undefined;
      animation.cancel();
    }, { once: true });
    return animation;
  }

  function finishEvent() {
    if (eventState === 'idle') return;
    eventState = 'idle';
    fadeAnimation?.cancel();
    fadeAnimation = undefined;
    video.pause();
    video.style.opacity = '0';
    if (video.readyState > 0) {
      try { video.currentTime = 0; } catch { /* A failed decode has no seekable frame. */ }
    }
    sync();
  }

  function fadeOut() {
    if (eventState !== 'playing') return;
    eventState = 'fading';
    const animation = animateOpacity(0);
    if (animation) animation.addEventListener('finish', finishEvent, { once: true });
    else finishEvent();
  }

  function pausePlayback() {
    video.pause();
    fadeAnimation?.pause();
  }

  function resumePlayback() {
    fadeAnimation?.play();
    if (eventState === 'playing' || eventState === 'fading') {
      void video.play().catch(() => finishEvent());
    }
  }

  function scheduleNext(initial = false) {
    if (timer || failed || forcedOnce && played || !canRun()) return;
    const minimum = initial ? 24000 : 105000;
    const maximum = initial ? 42000 : 180000;
    const delay = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
    timer = window.setTimeout(() => {
      timer = 0;
      void playEvent();
    }, delay);
  }

  function waitForFrame() {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
      };
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('Train video unavailable')); };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Train video timed out'));
      }, 15000);
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.src = asset;
      video.preload = 'auto';
      video.load();
    });
  }

  async function playEvent() {
    if (eventState !== 'idle' || !canRun()) return;
    clearTimer();
    eventState = 'loading';
    try {
      await waitForFrame();
      if (!canRun()) { eventState = 'idle'; sync(); return; }
      await video.play();
      if (!canRun()) { eventState = 'idle'; pausePlayback(); sync(); return; }
      eventState = 'playing';
      played = true;
      animateOpacity(1);
    } catch {
      failed = true;
      finishEvent();
    }
  }

  function onTimeUpdate() {
    if (eventState !== 'playing' || !Number.isFinite(video.duration)) return;
    if (video.currentTime >= video.duration - fadeDuration / 1000 - 0.2) fadeOut();
  }

  function onEnded() {
    if (eventState === 'playing') fadeOut();
    else if (eventState === 'fading' && fadeAnimation?.playState !== 'running') finishEvent();
  }

  function sync() {
    if (disposed) return;
    if (reducedMotion.matches) {
      clearTimer();
      finishEvent();
      return;
    }
    if (document.hidden || !visible || isPaused()) {
      clearTimer();
      if (eventState === 'playing' || eventState === 'fading') pausePlayback();
      return;
    }
    if (stateId() !== 'rainy' || !isStable()) {
      clearTimer();
      if (eventState === 'playing') fadeOut();
      return;
    }
    if (eventState === 'playing' || eventState === 'fading') {
      resumePlayback();
      return;
    }
    if (eventState !== 'loading') {
      if (forcedOnce && !played) void playEvent();
      else scheduleNext(!played);
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(stage, { attributes: true, attributeFilter: ['data-sf-state', 'data-sf-phase', 'data-sf-paused'] });
  if (pauseButton) {
    observer.observe(pauseButton, { attributes: true, attributeFilter: ['aria-pressed'] });
  }
  const intersection = 'IntersectionObserver' in window
    ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.05 })
    : undefined;
  intersection?.observe(stage);
  reducedMotion.addEventListener('change', sync, { signal: life.signal });
  document.addEventListener('visibilitychange', sync, { signal: life.signal });
  video.addEventListener('timeupdate', onTimeUpdate, { signal: life.signal });
  video.addEventListener('ended', onEnded, { signal: life.signal });

  sync();

  return () => {
    disposed = true;
    clearTimer();
    life.abort();
    observer.disconnect();
    intersection?.disconnect();
    fadeAnimation?.cancel();
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  };
}

let cleanup = mountTrainEvent();
window.addEventListener('pagehide', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pageshow', event => {
  if (event.persisted) cleanup = mountTrainEvent();
});
