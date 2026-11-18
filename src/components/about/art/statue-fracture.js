export function noise(seed) {
  const x = Math.sin(seed * 19.29 + 73.63) * 43758.5453;
  return x - Math.floor(x);
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createStoneFracture(ctx, scale, hasStone) {
  // Fixed sites keep the same fracture map after resizing or reloading.
  const bounds = [{x:24,y:8},{x:986,y:8},{x:986,y:1062},{x:24,y:1062}];
  const sites = Array.from({length:63}, (_, i) => ({
    x:24 + (i % 7 + .22 + noise(i + 100) * .56) * 962 / 7,
    y:8 + (Math.floor(i / 7) + .22 + noise(i + 300) * .56) * 1054 / 9,
  }));
  function cell(site) {
    let points = bounds;
    for (const other of sites) {
      if (other === site || !points.length) continue;
      const dx = other.x - site.x, dy = other.y - site.y;
      const side = p => (p.x - (site.x + other.x) / 2) * dx + (p.y - (site.y + other.y) / 2) * dy;
      points = points.flatMap((p, i) => {
        const q = points[(i + 1) % points.length], a = side(p), b = side(q);
        const next = a <= 0 ? [p] : [];
        if ((a <= 0) !== (b <= 0)) next.push({x:p.x + (q.x-p.x) * a/(a-b),y:p.y + (q.y-p.y) * a/(a-b)});
        return next;
      });
    }
    return points.map(p => ({x:Math.round(p.x*100)/100,y:Math.round(p.y*100)/100}));
  }

  const edgeMap = new Map();
  const cells = sites.map((site, id) => {
    const vertices = cell(site);
    const edges = vertices.map((a, i) => {
      const b = vertices[(i+1) % vertices.length];
      const forward = a.x < b.x || (a.x === b.x && a.y < b.y);
      const [p,q] = forward ? [a,b] : [b,a];
      const key = `${p.x},${p.y}:${q.x},${q.y}`;
      if (!edgeMap.has(key)) {
        const dx = q.x-p.x, dy = q.y-p.y;
        const points = [p, ...[.25,.52,.76].map((t,j) => {
          const bend = (noise(p.x + q.y + j * 92) - .5) * .19;
          return {x:p.x + dx*t - dy*bend,y:p.y + dy*t + dx*bend};
        }), q];
        edgeMap.set(key,{points,mid:points[2],owners:[],damage:0,breakAt:.85 + noise(p.x+q.y)*.22});
      }
      const edge = edgeMap.get(key);
      edge.owners.push(id);
      return {edge,forward};
    });
    const path = new Path2D();
    path.moveTo(vertices[0].x,vertices[0].y);
    for (const {edge,forward} of edges) for (const p of (forward ? edge.points : [...edge.points].reverse()).slice(1)) path.lineTo(p.x,p.y);
    path.closePath();
    return { site, id, edges, path, vertices, attached: true, grip: null };
  });
  const edges = [...edgeMap.values()].filter(edge => edge.owners.length === 2);
  const contains = (fragment, point) => ctx.isPointInPath(fragment.path, point.x * scale, point.y * scale);

  function opaquePoint(fragment) {
    if (hasStone(fragment.site) && contains(fragment, fragment.site)) return fragment.site;
    const xs = fragment.vertices.map(point => point.x);
    const ys = fragment.vertices.map(point => point.y);
    // Include a margin because the rendered edges bend outside the original polygon.
    for (let y = Math.min(...ys) - 8; y <= Math.max(...ys) + 8; y += 8) {
      for (let x = Math.min(...xs) - 8; x <= Math.max(...xs) + 8; x += 8) {
        const point = { x, y };
        if (hasStone(point) && contains(fragment, point)) return point;
      }
    }
    return null;
  }

  function supportedFrom(anchors, intactOnly) {
    const supported = new Set(anchors);
    const queue = [...anchors];
    for (const id of queue) {
      for (const { edge } of cells[id].edges) {
        if (!edge.solid || (intactOnly && edge.damage >= edge.breakAt)) continue;
        const other = edge.owners.find(owner => owner !== id);
        if (other === undefined || !cells[other].attached || supported.has(other)) continue;
        supported.add(other);
        queue.push(other);
      }
    }
    return supported;
  }

  function findAnchors() {
    for (const fragment of cells) fragment.grip = opaquePoint(fragment);
    for (const edge of edges) {
      if (!edge.owners.every(id => cells[id].grip)) continue;
      edge.solid = edge.points.slice(1).some((end, index) => {
        const start = edge.points[index];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) return false;
        return [.2, .5, .8].some(fraction => {
          const x = start.x + dx * fraction;
          const y = start.y + dy * fraction;
          const nx = dy / length * 2;
          const ny = dx / length * 2;
          return hasStone({ x: x + nx, y: y - ny }) && hasStone({ x: x - nx, y: y + ny });
        });
      });
    }
    const candidates = cells.filter(fragment => fragment.grip).sort((a, b) => b.grip.y - a.grip.y);
    const anchors = candidates.filter(fragment => fragment.grip.y > 925).map(fragment => fragment.id);
    const supported = supportedFrom(anchors, false);
    // A separate silhouette island (for example a petal) starts supported at its lowest plate.
    for (const { id } of candidates) {
      if (supported.has(id)) continue;
      anchors.push(id);
      for (const member of supportedFrom([id], false)) supported.add(member);
    }
    return anchors;
  }

  return { cells, edges, contains, anchors: findAnchors(), supportedFrom };
}
