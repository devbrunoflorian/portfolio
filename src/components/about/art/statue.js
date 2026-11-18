import { createStoneFracture, distance, noise } from './statue-fracture.js';

export async function mountStatue(portrait, controls, signal) {
  const canvas = portrait.querySelector('canvas');
  const paint = portrait.querySelector('img');
  const strikeButton = controls.querySelector('[data-statue-strike]');
  const restoreButton = controls.querySelector('[data-statue-restore]');
  const status = controls.querySelector('[role="status"]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stone = new Image();
  stone.src = portrait.dataset.statueSource;
  const lightPaint = new Image();
  lightPaint.src = '/assets/about/materials/art-muse-light-cutout.png';
  await Promise.all([stone.decode(), paint.decode(), lightPaint.decode()]);
  signal.throwIfAborted();

  const W = 1470, H = 1070, scale = 2 / 3;
  const stoneRows = [[0, 8], [.228, 249], [.274, 293], [.357, 421], [.445, 550], [.646, 730], [1, 1062]];
  let frame = 0, hits = 0, revealed = false, revealTime = 0, hover = null, particles = [], loose = [], scars = [];

  function surface() {
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const ctx = layer.getContext('2d');
    ctx.scale(scale, scale);
    return ctx;
  }

  const ctx = canvas.getContext('2d');
  ctx.scale(scale,scale);
  const marble = surface(), layer = surface(), backing = surface();
  let pixels;
  const hasStone = ({x,y}) => x >= 0 && y >= 0 && x < W && y < H && pixels[(Math.floor(y*scale)*canvas.width + Math.floor(x*scale))*4+3] > 120;
  const still = () => motion.matches || document.documentElement.dataset.motionPaused === 'true' || document.hidden;
  function updateBacking() {
    backing.clearRect(0,0,W,H);
    backing.drawImage(document.documentElement.dataset.theme === 'light' ? lightPaint : paint,0,0,W,H);
    backing.globalCompositeOperation = 'destination-in';
    backing.drawImage(marble.canvas,0,0,W,H);
    backing.globalCompositeOperation = 'source-over';
  }

  function drawScars(strokes) {
    for (const {points,damage} of strokes) if (damage > .08) {
      layer.beginPath();
      layer.moveTo(points[0].x,points[0].y);
      for (const point of points.slice(1)) layer.lineTo(point.x,point.y);
      layer.strokeStyle = `rgba(250,236,222,${Math.min(.83,damage)})`;
      layer.lineWidth = 1.9 + damage*2;
      layer.lineJoin = 'round';
      layer.stroke();
      layer.strokeStyle = `rgba(38,24,26,${Math.min(.86,damage*.92)})`;
      layer.lineWidth = .7 + damage*1.4;
      layer.stroke();
    }
  }

  function rebuildStoneLayer() {
    layer.clearRect(0, 0, W, H);
    layer.drawImage(marble.canvas, 0, 0, W, H);
    drawScars(edges);
    drawScars(scars);
    layer.globalCompositeOperation = 'destination-in';
    layer.drawImage(marble.canvas, 0, 0, W, H);
    layer.globalCompositeOperation = 'destination-out';
    for (const fragment of cells) if (!fragment.attached) layer.fill(fragment.path);
    layer.globalCompositeOperation = 'source-over';
  }

  function render(now = performance.now()) {
    frame = 0;
    ctx.clearRect(0, 0, W, H);
    if (!revealed) {
      ctx.drawImage(layer.canvas, 0, 0, W, H);
      if (hover && !still()) {
        const gradient = ctx.createRadialGradient(hover.x, hover.y, 14, hover.x, hover.y, 79);
        gradient.addColorStop(0, '#000');
        gradient.addColorStop(.42, '#000d');
        gradient.addColorStop(1, '#0000');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.fillRect(hover.x - 79, hover.y - 79, 158, 158);
      }
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(backing.canvas, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const alpha = still() ? 1 : Math.min(1,Math.max(0,(now-revealTime)/430));
      portrait.style.setProperty('--statue-reveal', String(alpha));
      ctx.globalAlpha = 1-alpha;
      if (alpha < 1) ctx.drawImage(backing.canvas,0,0,W,H);
      ctx.globalAlpha = 1;
    }
    for (const fragment of loose) {
      const t = Math.max(0,(now-fragment.time)/1000), {x,y} = fragment.site;
      ctx.save();
      ctx.translate(x + fragment.vx*t, y + 24*t + 570*t*t);
      ctx.rotate(fragment.spin*t);
      ctx.translate(-x,-y);
      ctx.globalAlpha = Math.min(1,Math.max(0,(1.06-t)*5));
      ctx.clip(fragment.path);
      ctx.drawImage(marble.canvas,0,0,W,H);
      ctx.restore();
    }
    for (const particle of particles) {
      const t = (now-particle.time)/1000;
      ctx.fillStyle = `rgba(225,198,180,${Math.max(0,(.55-t)/1.4)})`;
      ctx.fillRect(particle.x + particle.vx*t,particle.y + particle.vy*t + 180*t*t,particle.size,particle.size);
    }
    loose = loose.filter(f => now-f.time < 1060);
    particles = particles.filter(p => now-p.time < 550);
    if (loose.length || particles.length) requestDraw();
  }

  function requestDraw() { if (!frame && !document.hidden) frame = requestAnimationFrame(render); }
  function strike(point) {
    if (revealed || !hasStone(point)) return;
    const impact = cells.find(fragment => fragment.attached && contains(fragment, point));
    if (!impact) return;
    hits++;
    hover = null;
    const now = performance.now();
    const seam = impact.edges.map(({edge}) => edge.mid).sort((a,b) => distance(a,point)-distance(b,point))[0];
    const bend = {x:point.x + (seam.x-point.x)*.46 + (seam.y-point.y)*.13,y:point.y + (seam.y-point.y)*.46 - (seam.x-point.x)*.13};
    scars.push({points:[point,bend,seam],damage:.52});
    for (const edge of edges) {
      if (!edge.solid) continue;
      const d = distance(edge.mid,point);
      edge.damage = Math.min(1.15,edge.damage + Math.max(0,1-d/215)*(.82 + hits*.12));
    }
    // First contact scars the surface. Later breaks remove pieces disconnected from the base.
    const connected = hits === 5 ? new Set() : supportedFrom(anchors, true);
    const detached = hits === 1 ? [] : cells.filter(f => f.grip && f.attached && !connected.has(f.id));
    for (const f of detached) f.attached = false;
    if (!still()) {
      loose.push(...detached.sort((a,b) => distance(a.grip,point)-distance(b.grip,point)).slice(0,18).map(f => ({...f,time:now,vx:(f.grip.x-point.x)*.24,spin:(noise(f.id)-.5)*.6})));
      for (let i=0;i<15;i++) particles.push({...point,time:now,vx:(noise(i+hits)-.5)*320,vy:-noise(i+40)*88,size:1+noise(i+60)*4});
      loose = loose.slice(-24);
      particles = particles.slice(-45);
    }
    revealed = hits === 5;
    if (revealed) revealTime = now;
    else rebuildStoneLayer();
    strikeButton.setAttribute('aria-disabled',String(revealed));
    restoreButton.setAttribute('aria-disabled','false');
    status.textContent = revealed ? status.dataset.revealed : detached.length ? status.dataset.detached : status.dataset.cracked;
    requestDraw();
  }

  function position(event) {
    const box = canvas.getBoundingClientRect();
    return {x:(event.clientX-box.left)/box.width*W,y:(event.clientY-box.top)/box.height*H};
  }
  function settle() { loose=[]; particles=[]; hover=null; requestDraw(); }
  // Register the reference to the watercolor's eyes, lips and jaw in artwork space.
  for (let index = 1; index < stoneRows.length; index++) {
    const [sourceTop, targetTop] = stoneRows[index - 1];
    const [sourceBottom, targetBottom] = stoneRows[index];
    marble.drawImage(stone, 0, sourceTop * stone.height, stone.width,
      (sourceBottom - sourceTop) * stone.height, 24, targetTop, 962, targetBottom - targetTop);
  }
  pixels = marble.getImageData(0, 0, canvas.width, canvas.height).data;
  const { cells, edges, contains, anchors, supportedFrom } = createStoneFracture(ctx, scale, hasStone);
  updateBacking();
  rebuildStoneLayer();
  portrait.style.setProperty('--statue-reveal', '0');
  render();
  portrait.dataset.statueReady = '';
  controls.hidden = false;
  restoreButton.setAttribute('aria-disabled', 'true');
  const events = { signal };
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || still() || revealed) return;
    const point = position(event);
    hover = hasStone(point) ? point : null;
    canvas.style.cursor = hover ? 'crosshair' : '';
    requestDraw();
  }, events);
  canvas.addEventListener('pointerleave', () => { hover = null; requestDraw(); }, events);
  canvas.addEventListener('click', event => strike(position(event)), events);
  strikeButton.addEventListener('click', () => {
    const focus = {x:515,y:450};
    const nearest = cells.filter(f => f.attached && f.grip)
      .sort((a,b) => distance(a.grip,focus) - distance(b.grip,focus))[0];
    if (nearest) strike(nearest.grip);
  }, events);
  restoreButton.addEventListener('click', () => {
    if (!hits) return;
    revealed = false;
    hits = 0;
    scars = [];
    portrait.style.setProperty('--statue-reveal', '0');
    for (const edge of edges) edge.damage = 0;
    for (const fragment of cells) fragment.attached = true;
    rebuildStoneLayer();
    strikeButton.setAttribute('aria-disabled', 'false');
    restoreButton.setAttribute('aria-disabled', 'true');
    status.textContent = status.dataset.restored;
    settle();
  }, events);
  document.addEventListener('visibilitychange', settle, events);
  motion.addEventListener('change', settle, events);
  const appearance = new MutationObserver(records => {
    if (records.some(record => record.attributeName === 'data-theme')) updateBacking();
    settle();
    if (!document.hidden) { cancelAnimationFrame(frame); render(); }
  });
  appearance.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme','data-motion-paused'] });
  signal.addEventListener('abort', () => {
    appearance.disconnect();
    cancelAnimationFrame(frame);
  }, { once:true });
  return { settle };
}
