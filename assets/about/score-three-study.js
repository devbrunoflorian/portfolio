import * as THREE from '../vendor/three/build/three.module.js';
import { createTravelProjector } from './score-travel-geometry.js';
import { projectCompoundGroup, glyphContours } from './score-compound-groups.js';
import { projectedRest } from './score-engraving.js';
import { readingFocus } from './score-focus-profile.js';
import { HALO_HALF_WIDTH } from './score-depth-cues.js';

const BACKGROUND = [6 / 255, 6 / 255, 9 / 255];
const INK = [207 / 255, 194 / 255, 226 / 255];
const GOLD = [1, 220 / 255, 131 / 255];
const MARKER = 'guitar-33-4-1';
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

function contains(polygon, point) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Earcut runs on vector contours; no Canvas raster or score texture is uploaded.
function fillContours(contours, triangle) {
  const rings = contours.filter(points => points.length >= 3).map(points => {
    const ring = points.slice();
    if (ring[0].x === ring.at(-1).x && ring[0].y === ring.at(-1).y) ring.pop();
    return ring;
  });
  const levels = rings.map((ring, i) => rings.filter((other, j) => i !== j && contains(other, ring[0])).length);
  rings.forEach((outer, i) => {
    if (levels[i] % 2) return;
    const holes = rings.filter((ring, j) => levels[j] === levels[i] + 1 && contains(outer, ring[0]));
    const flat = [outer, ...holes].flat();
    const indices = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p.x, p.y)),
      holes.map(ring => ring.map(p => new THREE.Vector2(p.x, p.y))));
    for (const face of indices) triangle(...face.map(index => flat[index]));
  });
}

function stroke(points, width, triangle) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-8) continue;
    const dx = -(b.y - a.y) / length * width / 2, dy = (b.x - a.x) / length * width / 2;
    const p = { ...a, x: a.x + dx, y: a.y + dy }, q = { ...a, x: a.x - dx, y: a.y - dy };
    const r = { ...b, x: b.x - dx, y: b.y - dy }, s = { ...b, x: b.x + dx, y: b.y + dy };
    triangle(p, q, r); triangle(p, r, s);
  }
}

export async function mountThreeStudy(host, { score, view, points, groups, engraving, width, height, details = true }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Comparação experimental Three.js, mesmos compassos 31–33');
  host.append(canvas);
  width ||= host.clientWidth;
  height ||= width / 1.8;
  if (!(width > 0 && height > 0)) { canvas.remove(); throw new Error('Three study requires a visible positive viewport.'); }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
  catch (error) { canvas.remove(); throw error; }
  renderer.setPixelRatio(2);
  renderer.setSize(Math.round(width * 2) / 2, Math.round(height * 2) / 2, false);
  renderer.setClearColor(new THREE.Color(...BACKGROUND));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  // Canvas has no clip planes. This study bounds GPU depth precision while
  // retaining the source focal length; ink is biased one camera unit toward us.
  const focal = width * 1.45, near = width * .01, far = width * 20;
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(height / (2 * focal)) * 180 / Math.PI, width / height, near, far);
  const scene = new THREE.Scene();
  const uniforms = { focus: { value: 0 }, viewportWidth: { value: width }, fade: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, depthTest: true, depthWrite: true,
    vertexShader: `attribute vec3 ink; attribute float protectedInk;
      varying vec3 vInk; varying float vDistance; varying float vProtected;
      void main(){vInk=ink;vDistance=-position.z;vProtected=protectedInk;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float focus; uniform float viewportWidth; uniform float fade;
      varying vec3 vInk; varying float vDistance; varying float vProtected;
      void main(){float t=smoothstep(.04,.70,vDistance/viewportWidth-focus)*fade*(1.-vProtected);
        float brightness=mix(1.,.72,t), saturation=mix(1.,.20,t), opacity=mix(1.,.32,t);
        float gray=dot(vInk,vec3(.2126,.7152,.0722));
        vec3 ink=mix(vec3(gray),vInk,saturation)*brightness;
        gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),ink,opacity),1.);}`,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(...BACKGROUND), side: THREE.DoubleSide });
  const inkMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  const haloMesh = new THREE.Mesh(new THREE.BufferGeometry(), haloMaterial);
  haloMesh.renderOrder = -1;
  inkMesh.frustumCulled = haloMesh.frustumCulled = false;
  scene.add(haloMesh, inkMesh);
  const target = new THREE.WebGLRenderTarget(Math.round(width * 2), Math.round(height * 2));
  target.samples = 4;
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.depthTexture = new THREE.DepthTexture(target.width, target.height, THREE.UnsignedIntType);
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { image: { value: target.texture }, depths: { value: target.depthTexture },
      texel: { value: new THREE.Vector2(1 / target.width, 1 / target.height) },
      focus: uniforms.focus, viewportWidth: uniforms.viewportWidth, blur: { value: 0 }, near: { value: near }, far: { value: far } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D image;uniform sampler2D depths;uniform vec2 texel;
      uniform float focus;uniform float viewportWidth;uniform float blur;uniform float near;uniform float far;varying vec2 vUv;
      float distanceAt(vec2 uv){float z=texture2D(depths,uv).x;return near*far/(far-z*(far-near));}
      void main(){vec3 original=texture2D(image,vUv).rgb;float d=distanceAt(vUv)/viewportWidth;
        bool gold=original.r>original.b*1.35&&original.g>original.b*1.2;
        float radius=clamp((d-focus-.05)/.2,0.,3.)/3.*2.8*2.*blur;
        if(gold||d<=focus+.05||radius<.01){gl_FragColor=vec4(original,1.);return;}
        vec3 total=vec3(0.);float weights=0.;
        for(int y=-2;y<=2;y++){for(int x=-2;x<=2;x++){
          vec2 offset=vec2(float(x),float(y));float weight=exp(-dot(offset,offset)/2.);
          vec2 uv=vUv+offset*radius*texel;float sampleDistance=distanceAt(uv)/viewportWidth;
          vec3 sampleInk=texture2D(image,uv).rgb;
          bool sampleGold=sampleInk.r>sampleInk.b*1.35&&sampleInk.g>sampleInk.b*1.2;
          if(sampleDistance<=focus+.05||sampleGold)sampleInk=original;
          total+=sampleInk*weight;weights+=weight;
        }}gl_FragColor=vec4(total/weights,1.);}`,
  });
  const postMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
  postScene.add(postMesh);
  const gl = renderer.getContext(), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
  const pending = [], metrics = { gpuTimer: Boolean(timer), samples: [],
    renderer: debugRenderer ? gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    hardwareAcceleration: 'Unknown; a WebGL context does not establish hardware acceleration.',
    presentation: 'Not measured; next-RAF latency is scheduling only.' };
  let disposed = false, cachedPose = null;

  function build(pose) {
    const project = createTravelProjector(width, height, score, pose, view, .2);
    const focus = readingFocus(project, view, width, height, points.find(p => p.id === MARKER), pose);
    uniforms.focus.value = focus.distance;
    const positions = [], colors = [], protectedValues = [], halo = [];
    // Invert the exact existing screen projection to camera coordinates. Three's
    // perspective camera projects these vector vertices back to the identical pixels.
    const vertex = (out, p, bias = 0) => {
      const z = Math.max(near * 1.01, -p.depth - bias);
      out.push((p.x - width / 2) * z / focal, (height / 2 - p.y) * z / focal, -z);
    };
    const emit = (color = INK, protect = false) => (a, b, c) => {
      for (const p of [a, b, c]) {
        vertex(positions, p, 1); colors.push(...color); protectedValues.push(protect ? 1 : 0);
      }
    };
    const haloTriangle = (a, b, c) => { for (const p of [a, b, c]) vertex(halo, p); };
    for (let i = 0; i < 280; i++) {
      const a = view.x0 + (view.x1 - view.x0) * i / 280, b = view.x0 + (view.x1 - view.x0) * (i + 1) / 280;
      const p = project(a, -4 - HALO_HALF_WIDTH), q = project(b, -4 - HALO_HALF_WIDTH);
      const r = project(b, -4 + HALO_HALF_WIDTH), s = project(a, -4 + HALO_HALF_WIDTH);
      haloTriangle(p, q, r); haloTriangle(p, r, s);
      for (const y of score.staffLines) {
        const p = project(a, y - engraving.staffWidth / 2), q = project(b, y - engraving.staffWidth / 2);
        const r = project(b, y + engraving.staffWidth / 2), s = project(a, y + engraving.staffWidth / 2);
        emit()(p, q, r); emit()(p, r, s);
      }
    }
    for (const bar of engraving.barlines.filter(line => pose >= .85 || line.x > view.x0 + .01)) {
      const path = Array.from({ length: 33 }, (_, i) => project(bar.x, -8 + i / 4));
      stroke(path, engraving.staffWidth * path[0].scale, emit());
    }
    for (const group of groups) {
      const shape = projectCompoundGroup(group, project);
      fillContours([shape.beam], emit());
      for (const stem of shape.stems) stroke(stem.points, stem.width * stem.points[0].scale, emit());
      for (const line of shape.ledgers) stroke(line.points, line.width * line.points[0].scale, emit());
      for (const head of shape.heads) {
        const isGold = head.noteId === MARKER;
        const front = -project(head.anchor.u, head.anchor.v).depth / width <= focus.distance + .001;
        fillContours(head.contours, emit(isGold ? GOLD : INK, isGold || front));
      }
      if (details) {
        shape.brackets.forEach(path => stroke(path, group.bracket.width * path[0].scale, emit()));
        shape.accidents.forEach(contours => fillContours(contours, emit()));
        if (shape.number) {
          const number = group.number, anchor = shape.number;
          const contours = glyphContours(score.pdfGlyphPaths[number.glyph.glyph]).map(contour => contour.map(([x, y]) => ({
            ...anchor, x: anchor.x + (x - number.centerX) * number.glyph.scaleX * anchor.scale,
            y: anchor.y + (y - number.centerY) * number.glyph.scaleY * anchor.scale,
          })));
          fillContours(contours, emit());
        }
      }
    }
    fillContours([projectedRest(engraving.rest, project).points], emit());
    const replace = (mesh, values, ink = false) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      if (ink) {
        geometry.setAttribute('ink', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('protectedInk', new THREE.Float32BufferAttribute(protectedValues, 1));
      }
      mesh.geometry.dispose(); mesh.geometry = geometry;
    };
    replace(haloMesh, halo); replace(inkMesh, positions, true);
    canvas.dataset.camera = JSON.stringify(project.camera);
    canvas.dataset.marker = JSON.stringify(project(points.find(p => p.id === MARKER).x, points.find(p => p.id === MARKER).y));
    cachedPose = pose;
  }

  function pollGPU() {
    const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const { query, sample } = pending[i];
      if (!disjoint && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      sample.gpuMs = disjoint ? null : gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      sample.gpuStatus = disjoint ? 'disjoint' : 'available';
      gl.deleteQuery(query); pending.splice(i, 1);
    }
  }

  function draw(pose, variant = 'C') {
    if (disposed) throw new Error('Three study is disposed.');
    if (!Number.isFinite(pose) || pose < 0 || pose > 1) throw new RangeError('Pose must be between 0 and 1.');
    const started = performance.now();
    pollGPU();
    const geometryCached = cachedPose === pose;
    if (!geometryCached) build(pose);
    const prepared = performance.now();
    haloMesh.visible = pose < .85 && variant !== 'A';
    uniforms.fade.value = pose < .4 && variant !== 'A' ? 1 : 0;
    postMaterial.uniforms.blur.value = variant === 'C' && pose < .85 ? 1 : 0;
    const sample = { pose, variant, geometryCached, geometryMs: prepared - started, submissionMs: 0,
      cpuMs: 0, gpuMs: null, gpuStatus: timer ? 'pending' : 'unsupported' };
    const query = timer && gl.createQuery();
    if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    renderer.info.reset();
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCamera);
    if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push({ query, sample }); }
    sample.submissionMs = performance.now() - prepared;
    sample.cpuMs = performance.now() - started;
    sample.triangles = renderer.info.render.triangles;
    metrics.samples.push(sample);
    if (metrics.samples.length > 512) metrics.samples.shift();
    Object.assign(canvas.dataset, { pose: String(pose), variant, fadeEnabled: String(Boolean(uniforms.fade.value)),
      blurEnabled: String(Boolean(postMaterial.uniforms.blur.value)), focusBackend: variant === 'C' ? 'webgl-depth-gather' : 'none',
      depthEnabled: String(haloMesh.visible), background: '#060609', focusDistance: String(uniforms.focus.value) });
    return sample;
  }

  async function benchmark({ poses = [.13, .4, 1], variants = ['B', 'C'], warmup = 3, samples = 12 } = {}) {
    const results = [];
    for (const pose of poses) for (const variant of variants) {
      for (let i = 0; i < warmup; i++) { draw(pose, variant); await nextFrame(); }
      for (let i = 0; i < samples; i++) {
        const start = performance.now(), sample = draw(pose, variant);
        await nextFrame(); sample.nextRafMs = performance.now() - start; pollGPU(); results.push(sample);
      }
    }
    for (let i = 0; pending.length && i < 120; i++) { await nextFrame(); pollGPU(); }
    return { backend: 'Three.js vector geometry + GPU depth buffer', revision: THREE.REVISION,
      width, height, pixelRatio: 2, warmup, samples, gpuTimer: Boolean(timer), results,
      presentation: metrics.presentation, geometryPolicy: 'Identical poses reuse uploaded vector geometry; pose changes rebuild it.',
      limitation: 'Depth-gather blur approximates Canvas four-layer blur; triangulation and edge antialiasing can differ.' };
  }

  function measureSerializedCompletion(pose = .13, variant = 'C') {
    // Deliberately separate from normal frames: finish serializes CPU/GPU work
    // and changes the workload. It is completion latency, never GPU-only time.
    const started = performance.now(), sample = draw(pose, variant), submitted = performance.now();
    gl.finish();
    return { ...sample, serializedCompletionWaitMs: performance.now() - submitted,
      serializedTotalMs: performance.now() - started,
      method: 'gl.finish; includes prior queued work and driver synchronization; no presentation measurement.' };
  }

  async function benchmarkSequence({ variant = 'C', fixedPose = .13, fixedSamples = 30,
    poses = Array.from({ length: 60 }, (_, i) => i * .5 / 59), warmup = 3 } = {}) {
    const frames = [];
    for (let i = 0; i < warmup; i++) { draw(fixedPose, variant); await nextFrame(); }
    for (const [kind, sequence] of [['fixed', Array(fixedSamples).fill(fixedPose)], ['moving', poses]]) {
      for (const pose of sequence) {
        const started = performance.now(), sample = draw(pose, variant);
        await nextFrame(); sample.nextRafMs = performance.now() - started;
        sample.kind = kind; pollGPU(); frames.push(sample);
      }
    }
    for (let i = 0; pending.length && i < 120; i++) { await nextFrame(); pollGPU(); }
    return { backend: 'Three.js', revision: THREE.REVISION, width, height, pixelRatio: 2,
      variant, fixedPose, fixedSamples, movingSamples: poses.length, warmup,
      gpuTimer: metrics.gpuTimer, renderer: metrics.renderer, hardwareAcceleration: metrics.hardwareAcceleration,
      presentation: metrics.presentation, frames,
      geometryPolicy: 'Fixed poses reuse uploaded geometry; moving poses rebuild projection, triangulation and upload.' };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const { query } of pending) gl.deleteQuery(query);
    pending.length = 0;
    inkMesh.geometry.dispose(); haloMesh.geometry.dispose(); postMesh.geometry.dispose();
    material.dispose(); haloMaterial.dispose(); postMaterial.dispose();
    target.depthTexture.dispose(); target.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  }
  return { canvas, draw, benchmark, benchmarkSequence, measureSerializedCompletion, dispose, metrics, pollGPU };
}
