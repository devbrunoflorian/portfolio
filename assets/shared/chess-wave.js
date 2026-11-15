const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
export const WAVE_DURATION = 1100;

export function createChessGrid(width, height) {
  let cell = Math.max(40, Math.min(64, Math.round(width / 24)));
  while (Math.ceil(width / cell) * Math.ceil(height / cell) > 800) cell++;
  const tiles = [];
  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let col = 0; col < Math.ceil(width / cell); col++) {
      tiles.push({ x: col * cell, y: row * cell, even: (row + col) % 2 === 0 });
    }
  }
  return { width, height, cell, tiles };
}

const rect = (x, y, width, height = width) => `M${x.toFixed(2)} ${y.toFixed(2)}h${width.toFixed(2)}v${height.toFixed(2)}h-${width.toFixed(2)}Z`;

export function chessClip(grid, progress) {
  if (progress >= 1) return 'inset(0)';
  if (progress <= 0) return 'inset(50%)';
  const { width, height, cell, tiles } = grid;
  const band = cell * 3;
  const front = -band + (width + height + 2 * band) * ease(progress);
  const paths = [];
  let fullRun = null;
  const flushRun = () => {
    if (fullRun) paths.push(rect(fullRun.x, fullRun.y, fullRun.width, cell));
    fullRun = null;
  };
  for (const { x, y, even } of tiles) {
    if (fullRun && fullRun.y !== y) flushRun();
    const q = clamp((front - (width - x - cell / 2 + y + cell / 2) + band) / (2 * band));
    if (q <= 0) continue;
    if (q >= 1) {
      if (fullRun) fullRun.width += cell;
      else fullRun = { x, y, width: cell };
      continue;
    }
    if (even) {
      const size = cell * smooth(q * 2);
      paths.push(rect(x + (cell - size) / 2, y + (cell - size) / 2, size));
    } else if (q > .5) {
      const size = cell * (1 - smooth(q * 2 - 1));
      paths.push(rect(x, y, cell), rect(x + (cell - size) / 2, y + (cell - size) / 2, size));
    }
  }
  flushRun();
  return paths.length ? `path(evenodd, "${paths.join('')}")` : 'inset(50%)';
}

export function canAnimateTheme() {
  return Boolean(document.startViewTransition)
    && CSS.supports('clip-path', 'path(evenodd, "M0 0h1v1h-1Z")')
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
    && !matchMedia('(forced-colors: active)').matches
    && !document.hidden
    && innerWidth * innerHeight * (devicePixelRatio || 1) ** 2 <= 9_000_000;
}

export function startChessWave(apply) {
  const root = document.documentElement;
  const grid = createChessGrid(innerWidth, innerHeight);
  const controller = new AbortController();
  let frame = 0;
  let watchdog;
  let ended = false;
  let transition;
  let fallback;
  const finish = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    clearTimeout(watchdog);
    controller.abort();
    transition?.skipTransition();
    root.removeAttribute('data-theme-transition');
    root.style.removeProperty('--theme-reveal');
  };
  root.dataset.themeTransition = 'preparing';
  root.style.setProperty('--theme-reveal', 'inset(50%)');
  try {
    transition = document.startViewTransition(async () => {
      const prepared = await apply();
      if (!prepared) finish();
    });
    transition.ready.then(() => {
      if (ended) return;
      root.dataset.themeTransition = 'running';
      const start = performance.now();
      const tick = now => {
        if (ended) return;
        const progress = Math.min(1, (now - start) / WAVE_DURATION);
        root.style.setProperty('--theme-reveal', chessClip(grid, progress));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else finish();
      };
      frame = requestAnimationFrame(tick);
    }).catch(finish);
    transition.finished.then(finish, finish);
  } catch {
    finish();
    fallback = apply();
  }
  const options = { capture: true, passive: true, signal: controller.signal };
  for (const event of ['scroll', 'resize', 'orientationchange', 'pagehide']) window.addEventListener(event, finish, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); }, options);
  document.addEventListener('pointerdown', finish, options);
  document.addEventListener('keydown', finish, options);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', finish, { signal: controller.signal });
  if (!ended) watchdog = setTimeout(finish, 2000);
  return { finish, finished: transition?.finished ?? Promise.resolve(fallback) };
}
