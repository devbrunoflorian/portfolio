import * as THREE from './vendor/three-score.min.js';
import { createTravelProjector } from './score-travel-geometry.js';
import { readingFocus } from './score-focus-profile.js';
import { buildRibbonGeometry } from './score-gpu-ribbon-geometry.js';

const BACKGROUND = [6 / 255, 6 / 255, 9 / 255];
const TABLE_SIZE = 2048;
const MARKER = 'guitar-33-4-1';

/** Resample the reference's transported frames uniformly by arc length once. */
export function createRibbonFrameTable(samples) {
  const length = samples.at(-1).distance;
  const data = new Float32Array(TABLE_SIZE * 8);
  let j = 0;
  for (let i = 0; i < TABLE_SIZE; i++) {
    const d = i / (TABLE_SIZE - 1) * length;
    while (j < samples.length - 2 && samples[j + 1].distance < d) j++;
    const a = samples[j], b = samples[j + 1], t = (d - a.distance) / (b.distance - a.distance);
    for (let axis = 0; axis < 3; axis++) {
      data[i * 4 + axis] = a.position[axis] + (b.position[axis] - a.position[axis]) * t;
      data[TABLE_SIZE * 4 + i * 4 + axis] = a.normal[axis] + (b.normal[axis] - a.normal[axis]) * t;
    }
  }
  return { data, length, size: TABLE_SIZE };
}

const vertexShader = `
  uniform sampler2D frames;
  uniform float ribbonLength, arcStart, arcSpan, unit, aspect, middle, focal, viewportWidth;
  uniform vec2 sourceRange, viewport;
  attribute vec2 sourceUV, glyphOffset, segmentEnd, stroke;
  attribute float remap, segmentRemap, kind, gold, frontHead, arrivalBar;
  varying float vDistance, vGold, vHead, vKind, vArrival;
  vec3 frameAt(float f, float row){
    float lo=floor(f),hi=min(${TABLE_SIZE - 1}.,lo+1.);
    return mix(texture2D(frames,vec2((lo+.5)/${TABLE_SIZE}.,row)).xyz,
      texture2D(frames,vec2((hi+.5)/${TABLE_SIZE}.,row)).xyz,fract(f));
  }
  vec4 projectUV(vec2 uv, float correction){
    uv.x+=correction*aspect;
    float u=clamp((uv.x-sourceRange.x)/(sourceRange.y-sourceRange.x),0.,1.);
    float f=clamp((arcStart+u*arcSpan)/ribbonLength,0.,1.)*${TABLE_SIZE - 1}.;
    vec3 world=frameAt(f,.25)+normalize(frameAt(f,.75))*(uv.y-middle)*unit;
    return modelViewMatrix*vec4(world,1.);
  }
  vec4 screenOffset(vec4 clip, vec2 offset, float scale){
    clip.xy+=offset*scale*vec2(2.,-2.)/viewport*clip.w;return clip;
  }
  void main(){
    vec4 view=projectUV(sourceUV,remap);
    float scale=unit*focal/(-view.z);
    vDistance=-view.z;vGold=gold;vHead=frontHead;vKind=kind;vArrival=arrivalBar;
    if(kind<3.5)view.xyz*=(-view.z-1.)/(-view.z);
    vec4 clip=projectionMatrix*view;
    if(kind>.5&&kind<1.5)clip=screenOffset(clip,glyphOffset,scale);
    if(kind>1.5&&kind<3.5){
      vec4 endView=projectUV(segmentEnd,segmentRemap);endView.xyz*=(-endView.z-1.)/(-endView.z);
      vec4 endClip=projectionMatrix*endView;
      if(kind>2.5)clip=screenOffset(clip,glyphOffset,scale);
      vec2 delta=(endClip.xy/endClip.w-clip.xy/clip.w)*viewport;
      vec2 normal=length(delta)>1.e-5?normalize(vec2(-delta.y,delta.x)):vec2(1.,0.);
      float t=position.z;
      vec4 startClip=clip;
      clip=mix(startClip,endClip,t);
      float depth=mix(-view.z,-endView.z,t);
      vDistance=depth+1.;
      clip.xy+=normal*stroke.x*stroke.y*.5*(unit*focal/depth)*2./viewport*clip.w;
    }
    gl_Position=clip;
  }`;

const fragmentShader = `
  uniform float focus, viewportWidth, fade, halo, pose;
  varying float vDistance,vGold,vHead,vKind,vArrival;
  void main(){
    if(vArrival>.5&&pose<.85)discard;
    if(vKind>3.5){if(halo<.5)discard;gl_FragColor=vec4(${BACKGROUND.join(',')},0.);return;}
    vec3 source=mix(vec3(.811764706,.760784314,.886274510),vec3(1.,.862745098,.513725490),vGold);
    float protect=max(vGold,vHead*step(vDistance/viewportWidth,focus+.001));
    float t=smoothstep(.04,.70,vDistance/viewportWidth-focus)*fade*(1.-protect);
    float gray=dot(source,vec3(.2126,.7152,.0722));
    vec3 ink=mix(vec3(gray),source,mix(1.,.20,t))*mix(1.,.72,t);
    // Alpha is an explicit gold mask, independent of the RGB ink color.
    gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),ink,mix(1.,.32,t)),vGold);
  }`;

const postFragment = `
  uniform sampler2D image,depths;
  uniform vec2 texel;
  uniform float focus,viewportWidth,blur,near,far,pixelRatio;
  varying vec2 vUv;
  float distanceAt(vec2 uv){float z=texture2D(depths,uv).x;return near*far/(far-z*(far-near));}
  void main(){
    vec4 original=texture2D(image,vUv);float d=distanceAt(vUv)/viewportWidth;
    float radius=clamp((d-focus-.05)/.2,0.,3.)/3.*2.8*pixelRatio*blur;
    if(original.a>0.||d<=focus+.05||radius<.01){gl_FragColor=vec4(original.rgb,1.);return;}
    vec3 total=vec3(0.);float weights=0.;
    for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
      vec2 offset=vec2(float(x),float(y));float weight=exp(-dot(offset,offset)/2.);
      vec2 uv=vUv+offset*radius*texel;
      vec4 sampleInk=texture2D(image,uv);
      if(distanceAt(uv)/viewportWidth<=focus+.05||sampleInk.a>0.)sampleInk=original;
      total+=sampleInk.rgb*weight;weights+=weight;
    }
    gl_FragColor=vec4(total/weights,1.);
  }`;

export async function mountGpuRibbon(host, { score, view, points, groups, engraving, width, height, pixelRatio = 1, diagnostics = true }) {
  width ||= host.clientWidth;
  height ||= width / 1.8;
  if (!(width > 0 && height > 0)) throw new RangeError('GPU ribbon requires a positive viewport.');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Estudo de partitura vetorial com projeção GPU');
  host.append(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, premultipliedAlpha:false }); }
  catch (error) { canvas.remove(); throw error; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(new THREE.Color(...BACKGROUND), 0);
  renderer.info.autoReset = false;
  const initial = createTravelProjector(width, height, score, 0, view, .2);
  const table = createRibbonFrameTable(initial.samples);
  const frames = new THREE.DataTexture(table.data, TABLE_SIZE, 2, THREE.RGBAFormat, THREE.FloatType);
  frames.needsUpdate = true;
  const geometry = buildRibbonGeometry(score, view, groups, engraving);
  const focal = width * 1.45, near = width * .01, far = width * 20;
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(height / (2 * focal)) * 180 / Math.PI, width / height, near, far);
  // The reference's world uses screen-down Y. Flip only the projection Y so
  // camera right, world positions and transported normals retain their signs.
  camera.projectionMatrix.elements[5] *= -1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const uniforms = {
    frames: { value: frames }, ribbonLength: { value: table.length }, arcStart: { value: 0 }, arcSpan: { value: 0 },
    unit: { value: 0 }, aspect: { value: 1 }, middle: { value: (score.staffLines[0] + score.staffLines.at(-1)) / 2 },
    focal: { value: focal }, viewportWidth: { value: width }, viewport: { value: new THREE.Vector2(width, height) },
    sourceRange: { value: new THREE.Vector2(view.x0, view.x1) }, focus: { value: 0 },
    fade: { value: 0 }, halo: { value: 0 }, pose: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader,
    side: THREE.DoubleSide, blending: THREE.NoBlending, depthTest: true, depthWrite: true });
  const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const output = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  output.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { image: { value: target.texture }, depths: { value: target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) },
      focus: uniforms.focus, viewportWidth: uniforms.viewportWidth, blur: { value: 0 }, near: { value: near },
      far: { value: far }, pixelRatio: { value: pixelRatio } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: postFragment });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);postScene.add(quad);
  const gl = renderer.getContext();
  let timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const pending = [], metrics = { samples: [], gpuTimer: Boolean(timer), revision: THREE.REVISION,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    geometryPolicy: 'Source UV geometry and 2048 Float32 frames uploaded once; poses update camera and uniforms only.',
    maskPolicy: 'RGBA alpha stores gold coverage; no RGB threshold.',
    geometryBuilds: 1, triangulationPasses: 1, geometryUploads: 0, frameTextureUploads: 0,
    geometryBytes: Object.values(geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0),
    frameTextureBytes: table.data.byteLength, vertices: geometry.attributes.position.count,
    hardwareAcceleration: 'Unknown; renderer string does not prove hardware acceleration.',
    presentation: 'Not measured; next RAF is scheduling latency only.', contextLost: false };
  let disposed = false, cachedPose = null, lastVariant = 'C';
  const projectorScratch = {}, focusScratch = {}, reusableSample = {};
  let lastSample = null;
  const originalGL=new Map();metrics.bufferUploadCalls=0;metrics.bufferUploadBytes=0;metrics.actualFrameUploads=0;
  if (diagnostics) for(const method of ['bufferData','bufferSubData','texImage2D','texSubImage2D']){
    const original=gl[method];originalGL.set(method,original);
    gl[method]=function(...args){
      if(method.startsWith('buffer')){metrics.bufferUploadCalls++;const data=args[method==='bufferData'?1:2];metrics.bufferUploadBytes+=typeof data==='number'?data:data?.byteLength??0;}
      else if(args.some(arg=>arg===table.data))metrics.actualFrameUploads++;
      return original.apply(this,args);
    };
  }
  const marker = points.find(p => p.id === MARKER);
  const targetPosition = new THREE.Vector3();
  let pixelRatioInitialized = false;

  function setPixelRatio(value) {
    if (!Number.isFinite(value) || value <= 0 || value > 4) throw new RangeError('Pixel ratio must be in (0,4].');
    if (pixelRatioInitialized && value === pixelRatio) return;
    pixelRatio = value;renderer.setPixelRatio(value);
    const w = Math.round(width * value), h = Math.round(height * value);
    renderer.setSize(w / value, h / value, false);
    target.setSize(w, h);output.setSize(w, h);
    postMaterial.uniforms.texel.value.set(1 / w, 1 / h);
    postMaterial.uniforms.pixelRatio.value = value;metrics.pixelRatio = value;pixelRatioInitialized = true;lastSample = null;
  }
  setPixelRatio(pixelRatio);

  function updatePose(pose) {
    const project = createTravelProjector(width, height, score, pose, view, .2, true, projectorScratch);
    uniforms.arcStart.value = pose * .65 * table.length;
    uniforms.arcSpan.value = project.arcLength;
    const arrive = Math.max(0, Math.min(1, (pose - .65) / .2));
    uniforms.unit.value = (width * 1.5 * (1 - arrive) + project.arcLength * arrive) / (view.x1 - view.x0);
    uniforms.aspect.value = project.uvAspect;
    uniforms.focus.value = readingFocus(project, view, width, height, marker, pose, focusScratch).distance;
    uniforms.pose.value = pose;
    camera.position.fromArray(project.camera.position);
    targetPosition.fromArray(project.camera.target);camera.lookAt(targetPosition);camera.updateMatrixWorld();
    if (diagnostics) {
      canvas.dataset.camera = JSON.stringify(project.camera);
      canvas.dataset.marker = JSON.stringify(project(marker.x, marker.y));
    }
    cachedPose = pose;
  }

  function pollGPU() {
    if (disposed || metrics.contextLost) return;
    const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const { query, sample } = pending[i];
      if (!disjoint && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      sample.gpuMs = disjoint ? null : gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      sample.gpuStatus = disjoint ? 'disjoint' : 'available';
      gl.deleteQuery(query);pending.splice(i, 1);
    }
  }

  function draw(pose, variant = 'C', captureSample = diagnostics) {
    if (disposed) throw new Error('GPU ribbon is disposed.');
    if (metrics.contextLost) return { pose, variant, cpuMs: 0, gpuMs: null, gpuStatus: 'context-lost' };
    if (!Number.isFinite(pose) || pose < 0 || pose > 1) throw new RangeError('Pose must be in [0,1].');
    if (cachedPose === pose && lastVariant === variant && lastSample) return lastSample;
    const started = performance.now();
    if (diagnostics || pending.length) pollGPU();
    const uploadStart=metrics.bufferUploadCalls,textureStart=metrics.actualFrameUploads;
    const poseCached = cachedPose === pose;
    if (!poseCached) updatePose(pose);
    uniforms.halo.value = pose < .85 && variant !== 'A' ? 1 : 0;
    uniforms.fade.value = pose < .4 && variant !== 'A' ? 1 : 0;
    postMaterial.uniforms.blur.value = variant === 'C' && pose < .85 ? 1 : 0;
    lastVariant = variant;
    const prepared = performance.now();
    const sample = captureSample ? {} : reusableSample;
    Object.assign(sample, { pose, variant, geometryCached:true,poseCached, geometryMs: 0, poseMs: prepared - started,
      submissionMs: 0, cpuMs: 0, gpuMs: null, gpuStatus: timer && (diagnostics || captureSample) ? 'pending' : timer ? 'not-captured' : 'unsupported' });
    const query = timer && (diagnostics || captureSample) && pending.length < 128 ? gl.createQuery() : null;
    if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    if (diagnostics || captureSample) renderer.info.reset();
    renderer.setRenderTarget(target);renderer.render(scene, camera);
    if (metrics.geometryUploads === 0) { metrics.geometryUploads = 1;metrics.frameTextureUploads = 1; }
    renderer.setRenderTarget(null);renderer.render(postScene, postCamera);
    if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({ query, sample }); }
    else if (timer && (diagnostics || captureSample)) sample.gpuStatus = 'queue-full';
    sample.submissionMs = performance.now() - prepared;sample.cpuMs = performance.now() - started;
    if (diagnostics || captureSample) {
      sample.bufferUploadCalls=metrics.bufferUploadCalls-uploadStart;sample.frameTextureUploads=metrics.actualFrameUploads-textureStart;
      sample.triangles = renderer.info.render.triangles;
    }
    if (diagnostics) {
      metrics.samples.push(sample);
      if (metrics.samples.length > 1024) metrics.samples.shift();
      Object.assign(canvas.dataset, { pose: String(pose), variant, fadeEnabled: String(Boolean(uniforms.fade.value)),
        blurEnabled: String(Boolean(postMaterial.uniforms.blur.value)), depthEnabled: String(Boolean(uniforms.halo.value)),
        focusBackend: variant === 'C' ? 'gpu-depth-gather-alpha-mask' : 'none', focusDistance: String(uniforms.focus.value),
        geometryBuilds: '1', background: '#060609' });
    }
    lastSample = sample;
    return sample;
  }

  // Explicit diagnostic readback is outside draw/timing. Returned rows are screen-down.
  function readPixels({ mask = false } = {}) {
    if (disposed || metrics.contextLost || cachedPose === null) throw new Error('Draw an available GPU frame before readback.');
    const source = mask ? target : output;
    if (!mask) { renderer.setRenderTarget(output);renderer.render(postScene, postCamera);renderer.setRenderTarget(null); }
    const raw = new Uint8Array(source.width * source.height * 4);
    renderer.readRenderTargetPixels(source, 0, 0, source.width, source.height, raw);
    const data = new Uint8Array(raw.length), stride = source.width * 4;
    for (let y = 0; y < source.height; y++) data.set(raw.subarray(y * stride, (y + 1) * stride), (source.height - y - 1) * stride);
    return { data, width: source.width, height: source.height, pixelRatio, maskChannel: mask ? 'alpha' : null };
  }

  function onLost(event) {
    event.preventDefault();metrics.contextLost = true;
    for (const { sample } of pending) { sample.gpuStatus = 'context-lost';sample.gpuMs = null; }
    pending.length = 0;canvas.dataset.contextLost = 'true';
  }
  function onRestored() {
    if (disposed) return;
    timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');metrics.gpuTimer = Boolean(timer);
    metrics.contextLost = false;frames.needsUpdate = true;lastSample = null;
    metrics.frameTextureUploads++;metrics.geometryUploads++;
    canvas.dataset.contextLost = 'false';
    if (cachedPose !== null) draw(cachedPose, lastVariant);
  }
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  const contextControl=gl.getExtension('WEBGL_lose_context');
  function loseContext(){if(!contextControl)return false;contextControl.loseContext();return true;}
  function restoreContext(){if(!contextControl)return false;contextControl.restoreContext();return true;}
  function dispose() {
    if (disposed) return;disposed = true;
    canvas.removeEventListener('webglcontextlost', onLost);canvas.removeEventListener('webglcontextrestored', onRestored);
    for (const { query } of pending) gl.deleteQuery(query);pending.length = 0;
    geometry.dispose();frames.dispose();material.dispose();quad.geometry.dispose();postMaterial.dispose();
    target.depthTexture.dispose();target.dispose();output.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    for(const [method,original] of originalGL)gl[method]=original;
  }
  return { canvas, draw, pollGPU, metrics, dispose, setPixelRatio, readPixels,loseContext,restoreContext };
}
