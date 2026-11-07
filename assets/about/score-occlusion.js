export const SCORE_BACKGROUND = '#060609';
// Camera distance / viewport width, independent of device pixel ratio.
export const DEPTH_BANDS = { near: 1.35, far: 2.3, farOpacity: .32, farBrightness: .72, farSaturation: .2 };
export function depthAppearance(depth, viewportWidth) {
  const t=Math.max(0,Math.min(1,(-depth/viewportWidth-DEPTH_BANDS.near)/(DEPTH_BANDS.far-DEPTH_BANDS.near)));
  const ease=t*t*(3-2*t);
  return {opacity:1+(DEPTH_BANDS.farOpacity-1)*ease,brightness:1+(DEPTH_BANDS.farBrightness-1)*ease,saturation:1+(DEPTH_BANDS.farSaturation-1)*ease};
}

/** Depth is negative camera distance: the larger value is closer. No surface ink is painted. */
export function rasterDepth(buffer, width, height, triangle, scale = 1, originX = 0, originY = 0, owners = null) {
  const [a, b, c] = triangle.map(p => ({ x: p.x * scale - originX, y: p.y * scale - originY, depth: p.depth, u: p.u }));
  const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(area) < 1e-8) return;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const wa = ((b.y - c.y) * (x + .5 - c.x) + (c.x - b.x) * (y + .5 - c.y)) / area;
    const wb = ((c.y - a.y) * (x + .5 - c.x) + (a.x - c.x) * (y + .5 - c.y)) / area;
    const wc = 1 - wa - wb;
    if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
    const depth = 1 / (wa / a.depth + wb / b.depth + wc / c.depth);
    const index = y * width + x;
    if (depth > buffer[index]) { buffer[index] = depth; if(owners)owners[index]=wa*a.u+wb*b.u+wc*c.u; }
  }
}

export function quadTriangles([a, b, c, d]) { return [[a, b, c], [a, c, d]]; }

export function polygonBounds(points, padding = 2) {
  return { x0: Math.min(...points.map(p => p.x)) - padding, y0: Math.min(...points.map(p => p.y)) - padding,
    x1: Math.max(...points.map(p => p.x)) + padding, y1: Math.max(...points.map(p => p.y)) + padding };
}

/** Canvas paints each beam once. Coverage is depth-tested afterwards, not drawn as strips. */
export function paintDepthQueue(context, queue, surfaces, cssWidth, cssHeight, fade = false) {
  const width = context.canvas.width, height = context.canvas.height;
  const scale = width / cssWidth;
  const depth = new Float32Array(width * height).fill(-Infinity);
  const owners = new Float32Array(width * height).fill(-1);
  const inkDepth = new Float32Array(width * height).fill(-Infinity);
  for (const surface of surfaces) for (const triangle of quadTriangles(surface)) rasterDepth(depth, width, height, triangle, scale, 0, 0, owners);
  const output = context.createImageData(width, height);
  for (let i = 0; i < output.data.length; i += 4) {output.data[i]=6;output.data[i+1]=6;output.data[i+2]=9;output.data[i+3]=255;}
  context.clearRect(0, 0, cssWidth, cssHeight);
  for (const item of queue.sort((a, b) => a.depth - b.depth)) {
    const bounds = item.bounds ?? { x0: 0, y0: 0, x1: cssWidth, y1: cssHeight };
    const x0 = Math.max(0, Math.floor(bounds.x0 * scale)), y0 = Math.max(0, Math.floor(bounds.y0 * scale));
    const x1 = Math.min(width, Math.ceil(bounds.x1 * scale)), y1 = Math.min(height, Math.ceil(bounds.y1 * scale));
    if (x1 <= x0 || y1 <= y0) continue;
    item.paint();
    const pixels = context.getImageData(x0, y0, x1 - x0, y1 - y0);
    const localDepth = item.depthTriangles ? new Float32Array(pixels.width * pixels.height).fill(-Infinity) : null;
    const localOwners = item.kind==='staff-line'?new Float32Array(pixels.width*pixels.height).fill(-1):null;
    if (localDepth) for (const triangle of item.depthTriangles) rasterDepth(localDepth, pixels.width, pixels.height, triangle, scale, x0, y0,localOwners);
    for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
      const local = y * pixels.width + x, from = local * 4;
      let alpha = pixels.data[from + 3] / 255;
      if (!alpha) continue;
      const index = (y0 + y) * width + x0 + x;
      const fallback=localDepth&&!Number.isFinite(localDepth[local])&&item.sampleAt?item.sampleAt((x0+x+.5)/scale,(y0+y+.5)/scale):null;
      const z = localDepth && Number.isFinite(localDepth[local]) ? localDepth[local] + 1 : fallback?fallback.depth+1
        : item.depthAt ? item.depthAt((x0+x+.5)/scale,(y0+y+.5)/scale) : item.depth;
      const ownSurface=localOwners?Math.abs((fallback?.u??localOwners[local])-owners[index])<.01:item.range&&owners[index]>=item.range[0]&&owners[index]<=item.range[1];
      if ((!ownSurface&&z < depth[index] - 1)||z<inkDepth[index]-1) continue;
      const appearance = fade ? depthAppearance(item.kind==='notation-group'?item.depth:z,cssWidth) : {opacity:1,brightness:1,saturation:1};
      alpha *= appearance.opacity;
      const luminance = pixels.data[from]*.2126+pixels.data[from+1]*.7152+pixels.data[from+2]*.0722;
      const to = index * 4;
      for (let channel = 0; channel < 3; channel++) output.data[to + channel] =
        (luminance+(pixels.data[from+channel]-luminance)*appearance.saturation)*appearance.brightness*alpha + output.data[to + channel] * (1 - alpha);
      if (pixels.data[from+3] > 127) inkDepth[index] = Math.max(inkDepth[index], z);
    }
    context.clearRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  }
  context.putImageData(output, 0, 0);
}
