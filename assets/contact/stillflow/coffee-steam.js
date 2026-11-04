import { seededRandom } from './timeline.js';

const sourceSize = { width: 1672, height: 941 };
const cup = { x: 943, y: 545 };
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function mount() {
  const stage = document.querySelector('[data-contact-stage]');
  if (!stage) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'sf-coffee-steam';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return () => {};
  stage.append(canvas);

  const random = seededRandom(Number(new URLSearchParams(location.search).get('steamSeed')) || 73);
  const wisps = Array.from({ length: 15 }, () => ({
    phase: random(), life: 4 + random() * 4,
    offset: (random() - .5) * 21,
    height: 60 + random() * 38,
    width: 1.5 + random() * 1.8,
  }));
  const life = new AbortController();
  let frame = 0;
  let elapsed = 0;
  let previous = 0;
  let lastDraw = 0;
  let visible = true;
  let disposed = false;
  let localAnchor = { x: 0, y: 0 };
  let size = { width: 1, height: 1 };
  let ratio = 1;

  function resize() {
    const bounds = stage.getBoundingClientRect();
    const scale = Math.max(bounds.width / sourceSize.width, bounds.height / sourceSize.height);
    const x = (bounds.width - sourceSize.width * scale) / 2 + cup.x * scale;
    const y = cup.y * scale; // Photographic frames use object-position: center top.
    const width = Math.min(bounds.width, 160 * scale);
    const height = Math.min(bounds.height, 150 * scale);
    const left = Math.max(0, Math.min(bounds.width - width, x - width / 2));
    const top = Math.max(0, Math.min(bounds.height - height, y - height + 4 * scale));
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    size = { width, height };
    localAnchor = { x: x - left, y: y - top };
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.ceil(width * ratio));
    canvas.height = Math.max(1, Math.ceil(height * ratio));
    draw();
  }

  function drawWisp(wisp) {
    const progress = (elapsed / wisp.life + wisp.phase) % 1;
    const strength = Math.sin(Math.PI * progress) ** 1.3;
    if (strength < .03) return;
    const start = Math.max(0, progress - .66);
    const point = t => ({
      x: localAnchor.x + wisp.offset +
        Math.sin(elapsed * .45 + wisp.phase * 7 + t * 7) * (2 + t * 9) +
        Math.sin(elapsed * .29 + t * 13) * 2,
      y: localAnchor.y - t * wisp.height,
    });
    const first = point(start);
    const last = point(progress);
    const color = context.createLinearGradient(first.x, first.y, last.x, last.y);
    color.addColorStop(0, 'rgba(220,238,238,0)');
    color.addColorStop(.5, 'rgba(220,238,238,.42)');
    color.addColorStop(1, 'rgba(220,238,238,0)');
    context.globalAlpha = .86 * strength;
    context.strokeStyle = color;
    context.lineWidth = wisp.width;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(205,231,235,.24)';
    context.shadowBlur = 5;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (let i = 1; i <= 12; i++) {
      const p = point(start + (progress - start) * i / 12);
      context.lineTo(p.x, p.y);
    }
    context.stroke();
  }

  function draw() {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    const video = stage.querySelector('.sf-train-event');
    const videoOpacity = video ? Number(getComputedStyle(video).opacity) || 0 : 0;
    canvas.style.opacity = String(Math.max(0, 1 - videoOpacity));
    for (const wisp of wisps) drawWisp(wisp);
    context.globalAlpha = 1;
  }

  const shouldRun = () => !disposed && !motion.matches && !document.hidden && visible
    && stage.dataset.sfPaused !== 'true';
  function tick(time) {
    frame = 0;
    if (!shouldRun()) return;
    elapsed += previous ? Math.min((time - previous) / 1000, .08) : 0;
    previous = time;
    if (time - lastDraw >= 1000 / 30) {
      lastDraw = time;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (shouldRun()) {
      if (!frame) { previous = 0; frame = requestAnimationFrame(tick); }
    } else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      draw();
    }
  }
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: .01 });
  intersection.observe(stage);
  const observer = new MutationObserver(sync);
  observer.observe(stage, { attributes: true, attributeFilter: ['data-sf-paused'] });
  const resizer = new ResizeObserver(resize);
  resizer.observe(stage);
  document.addEventListener('visibilitychange', sync, { signal: life.signal });
  motion.addEventListener('change', sync, { signal: life.signal });
  resize();
  sync();
  stage.dataset.sfSteam = 'ready';
  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    life.abort();
    intersection.disconnect();
    observer.disconnect();
    resizer.disconnect();
    canvas.remove();
    delete stage.dataset.sfSteam;
  };
}

let cleanup = mount();
window.addEventListener('pagehide', () => { cleanup(); cleanup = () => {}; });
window.addEventListener('pageshow', event => { if (event.persisted) cleanup = mount(); });
