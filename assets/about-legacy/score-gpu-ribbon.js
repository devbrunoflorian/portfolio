import * as THREE from './vendor/three-score.min.js';
import { createTravelProjector } from './score-travel-geometry.js';
import { readingFocus } from './score-focus-profile.js';
import { buildRibbonGeometry, scoreSourceRange, trebleClefFromTimeline } from './score-gpu-ribbon-geometry.js?v=chapter-materials-1';
import { createPixelSpriteAtlas, SCORE_MATERIAL, scoreMaterialShader } from './score-gpu-materials.js?v=watercolor-journey-5';
import { resolutionShader } from './score-resolution.js?v=journey-resolution-1';

const BACKGROUND = [6 / 255, 6 / 255, 9 / 255];
const TABLE_SIZE = 2048;
const DEFAULT_MARKER = 'guitar-33-4-1';

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
  uniform vec4 staffLinesA;
  uniform float staffLineE;
  uniform float ribbonLength, arcStart, arcSpan, unit, aspect, middle, focal, viewportWidth, journey;
  uniform vec2 sourceRange, viewport, frameOffset;
  attribute vec2 sourceUV, glyphOffset, spriteUV, segmentEnd, stroke, feature, protection, role;
  attribute float remap, segmentRemap, beat, segmentBeat, noteDuration;
  varying float vDistance, vGold, vHead, vKind, vArrival, vVoice, vSourceX, vSourceY;
  varying float vMaterialType, vBeat, vDuration, vSegmentProgress;
  varying vec2 vSpriteUV, vGlyphOffset;
  ${resolutionShader}
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
    return resolutionView(modelViewMatrix*vec4(world,1.),u,(uv.y-middle)*unit,journey,viewport,focal);
  }
  vec4 screenOffset(vec4 clip, vec2 offset, float scale){
    clip.xy+=offset*scale*vec2(2.,-2.)/viewport*clip.w;return clip;
  }
  void main(){
    float kind=feature.x,materialType=feature.y;
    float gold=protection.x,frontHead=protection.y;
    float arrivalBar=role.x,voice=role.y;
    vec2 source=sourceUV;
    if(kind>4.5&&kind<5.5)source+=glyphOffset*vec2(aspect,1.);
    vec4 view=projectUV(source,remap);
    vSourceX=source.x+remap*aspect;
    vSourceY=source.y;
    float scale=unit*focal/(-view.z);
    vDistance=-view.z;vGold=gold;vHead=frontHead;vKind=kind;vArrival=arrivalBar;vVoice=voice;
    vMaterialType=materialType;vBeat=beat;vDuration=noteDuration;vSegmentProgress=position.z;
    vSpriteUV=materialType>5.5&&materialType<6.5?vec2(position.z,.5+stroke.x*.45):spriteUV;vGlyphOffset=glyphOffset;
    if(kind<3.5||(kind>4.5&&kind<5.5))view.xyz*=(-view.z-1.)/(-view.z);
    vec4 clip=projectionMatrix*view;
    if(kind>.5&&kind<1.5)clip=screenOffset(clip,glyphOffset,scale);
    if(kind>1.5&&kind<3.5){
      vec4 endView=projectUV(segmentEnd,segmentRemap);endView.xyz*=(-endView.z-1.)/(-endView.z);
      vec4 endClip=projectionMatrix*endView;
      if(kind>2.5)clip=screenOffset(clip,vec2(glyphOffset.x*aspect,glyphOffset.y),scale);
      vec2 delta=(endClip.xy/endClip.w-clip.xy/clip.w)*viewport;
      vec2 normal=length(delta)>1.e-5?normalize(vec2(-delta.y,delta.x)):vec2(1.,0.);
      float t=position.z;
      vec4 startClip=clip;
      clip=mix(startClip,endClip,t);
      float depth=mix(-view.z,-endView.z,t);
      vSourceX=mix(sourceUV.x+remap*aspect,segmentEnd.x+segmentRemap*aspect,t);
      vSourceY=mix(source.y,segmentEnd.y,t);
      vBeat=mix(beat,segmentBeat,t);
      vDistance=depth+1.;
      clip.xy+=normal*stroke.x*stroke.y*.5*(unit*focal/depth)*2./viewport*clip.w;
    }
    clip.xy+=frameOffset*vec2(2.,-2.)/viewport*clip.w;
    gl_Position=clip;
  }`;

const fragmentShader = `
  uniform sampler2D spriteAtlas, pigmentAtlas;
  uniform float pigmentReady;
  uniform float focus, viewportWidth, fade, halo, pose, pixelRatio, lighting, musicScene, glowPass, flowPhase;
  uniform float journey, playbackBeat, playbackActive;
  uniform vec4 staffLinesA;
  uniform float staffLineE;
  uniform vec2 viewport, sourceRange;
  varying float vDistance,vGold,vHead,vKind,vArrival,vVoice,vSourceX,vSourceY;
  varying float vMaterialType,vBeat,vDuration,vSegmentProgress;
  varying vec2 vSpriteUV,vGlyphOffset;
  ${scoreMaterialShader}
  void main(){
    if(vSourceX<sourceRange.x||vSourceX>sourceRange.y)discard;
    if(vArrival>.5&&pose<.85)discard;
    if(vKind>3.5&&vKind<4.5){if(halo<.5)discard;gl_FragColor=vec4(${BACKGROUND.join(',')},0.);return;}
    float along=clamp((vSourceX-sourceRange.x)/(sourceRange.y-sourceRange.x),0.,1.);
    vec4 chapters=scoreChapterWeights(scorePigmentJourney(journey,along));
    float codeWeight=chapters.x,musicWeight=chapters.y,artWeight=chapters.z,gameWeight=chapters.w;
    float chapterGlow=clamp(1.-artWeight*.68-gameWeight*.82,.18,1.);
    float clef=step(${(SCORE_MATERIAL.CLEF - 0.5).toFixed(1)},vMaterialType)*(1.-step(${(SCORE_MATERIAL.CLEF + 0.5).toFixed(1)},vMaterialType));
    float triplet=step(${(SCORE_MATERIAL.TRIPLET - 0.5).toFixed(1)},vMaterialType)*(1.-step(${(SCORE_MATERIAL.TRIPLET + 0.5).toFixed(1)},vMaterialType));
    float splatter=(1.-step(9.5,vMaterialType))*step(${(SCORE_MATERIAL.SPATTER - 0.5).toFixed(1)},vMaterialType);
    if(vMaterialType>11.5){
      if(codeWeight<.001||glowPass>.5)discard;
      vec2 local=clamp(vSpriteUV,vec2(0.),vec2(1.));
      float rim=smoothstep(.55,.87,max(abs(local.x-.5),abs(local.y-.5))*2.);
      vec3 circuit=mix(vec3(.045,.065,.13),vec3(.30,.68,.94),rim);
      if(vMaterialType>12.5)circuit=vec3(.22,.52,.78);
      if(vMaterialType>13.5)circuit=mix(vec3(.12,.22,.40),vec3(.61,.44,.92),rim);
      vec2 screen=gl_FragCoord.xy/pixelRatio;
      float edge=smoothstep(0.,min(viewport.x*.16,180.),min(screen.x,viewport.x-screen.x));
      gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),circuit,codeWeight*edge),0.);return;
    }
    if(vMaterialType>9.5){
      if(artWeight<.001||pigmentReady<.5||glowPass>.5)discard;
      vec2 paintUV=clamp(vSpriteUV,vec2(.015),vec2(.985));
      bool headWash=vMaterialType<10.5;
      vec4 wash=texture2D(pigmentAtlas,vec2(paintUV.x*.5,paintUV.y*.5+(headWash?.5:0.)));
      if(wash.a<.10)discard;
      vec2 screen=gl_FragCoord.xy/pixelRatio;
      float edge=smoothstep(0.,min(viewport.x*.16,180.),min(screen.x,viewport.x-screen.x));
      float opacity=artWeight*wash.a*.70*edge;
      gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),wash.rgb,opacity),0.);return;
    }
    if(splatter>.5){
      if(artWeight<.001||scoreHash(floor(vGlyphOffset*42.))<.18)discard;
      vec3 pigment=mix(vec3(.20,.12,.48),vec3(.47,.31,.82),scoreHash(floor(vGlyphOffset*27.)));
      gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),pigment,artWeight),0.);return;
    }
    vec3 source=mix(vec3(.811764706,.760784314,.886274510),vec3(1.,.862745098,.513725490),vGold);
    if(vVoice>.5)source=vVoice<1.5?vec3(.439215686,.658823529,1.):vec3(.764705882,.603921569,1.);
    float staffDistance=min(min(min(abs(vSourceY-staffLinesA.x),abs(vSourceY-staffLinesA.y)),
      min(abs(vSourceY-staffLinesA.z),abs(vSourceY-staffLinesA.w))),abs(vSourceY-staffLineE));
    float staffLine=(1.-step(.5,vVoice))*step(1.5,vKind)*(1.-step(2.5,vKind))
      *(1.-smoothstep(.0001,.008,staffDistance));
    float scoreHead=step(.5,vHead)*(1.-step(1.5,vKind));
    float voiceInk=step(.5,vVoice);
    float lightMask=max(max(staffLine,scoreHead),voiceInk);
    float sourceProgress=clamp((vSourceX-sourceRange.x)/(sourceRange.y-sourceRange.x),0.,1.);
    float pulseDistance=abs(sourceProgress-flowPhase);
    float voicePhase=fract(flowPhase+(vVoice>1.5 ? .37 : 0.));
    float voiceDistance=abs(sourceProgress-voicePhase);
    float flowPulse=max(exp(-pow(pulseDistance*28.,2.)),exp(-pow(voiceDistance*28.,2.)));
    float flowAura=max(exp(-pow(pulseDistance*9.,2.)),exp(-pow(voiceDistance*9.,2.)));
    float noteAge=playbackBeat-vBeat;
    float noteActive=playbackActive*step(0.,noteAge)*(1.-step(max(.04,vDuration),noteAge));
    float beatAttack=noteActive*(1.-smoothstep(.06,.22,noteAge));
    vec3 staffGradient=mix(vec3(.35,.58,1.),vec3(.73,.43,1.),smoothstep(.04,.96,sourceProgress));
    source=mix(source,staffGradient,staffLine);
    vec2 local=clamp(vSpriteUV,vec2(0.),vec2(1.));
    float trace=scoreCodeTrace(local);
    if(vMaterialType>5.5){
      float grid=1.-smoothstep(.025,.07,abs(fract(vSourceY*5.)-.5));
      trace=max(trace,grid*.48);
      if(vMaterialType>5.5&&vMaterialType<6.5)trace=max(trace,1.-smoothstep(.025,.07,abs(fract(vSegmentProgress*8.)-.5)));
    }
    vec3 codeInk=mix(vec3(.15,.24,.46),vec3(.24,.88,1.),trace);
    source=mix(source,codeInk,codeWeight*.88);
    // Pigment overlays the same score geometry. Preserve enough value and hue
    // separation for the notation to stay readable on the dark page.
    // Texture coordinates belong to the engraved piece, so pigment bends with it.
    vec2 paint=vec2(vSourceX*.065,vSourceY*.48);
    float grain=scoreBrushNoise(paint)+.32*scoreBrushNoise(paint*2.7);
    float rim=1.-smoothstep(.66,.96,length((local-.5)*2.));
    float pool=clamp(grain*.72+(1.-rim)*.28,0.,1.);
    vec3 pigment=mix(vec3(.27,.30,.63),vec3(.77,.49,.85),pool);
    if(vVoice>.5){
      pigment=vVoice<1.5?mix(vec3(.22,.39,.74),vec3(.53,.76,1.),pool)
        :mix(vec3(.46,.25,.69),vec3(.86,.60,.96),pool);
    }
    float dry=0.;
    if(vMaterialType>5.5&&vMaterialType<7.5){
      // Longitudinal fibers: stems run in v, beams run in u.
      float across=vMaterialType<6.5?vSourceX*8.:vSourceY*8.;
      float lengthwise=vMaterialType<6.5?vSourceY*.14:vSourceX*.025;
      float bristle=scoreBrushNoise(vec2(across,lengthwise));
      dry=smoothstep(.58,.83,bristle)*.42;
      pigment=mix(pigment,vec3(.80,.72,.92),dry);
    }
    float paintedCoverage=1.;
    if(pigmentReady>.5 && ((vMaterialType>.5&&vMaterialType<1.5)||(vMaterialType>5.5&&vMaterialType<7.5))){
      bool brush=vMaterialType>5.5;
      vec2 cell=vec2(vVoice>1.5?1.:0.,brush?0.:1.);
      vec4 paintSample=texture2D(pigmentAtlas,(cell+clamp(local,vec2(.02),vec2(.98)))*.5);
      pigment=mix(pigment,paintSample.rgb*1.35,.78);
      paintedCoverage=mix(.38,1.,paintSample.a);
    }
    source=mix(source,pigment,artWeight*.96);
    source*=mix(1.,mix(.68,1.16,pool),artWeight*.65);
    vec4 sprite=scorePixelSprite(spriteAtlas,vMaterialType,local);
    if(scoreSpriteSlot(vMaterialType)>=0.&&sprite.a<.5&&gameWeight>.999)discard;
    source=mix(source,sprite.rgb,gameWeight*sprite.a);
    float nearFocus=1.-smoothstep(focus+.02,focus+.34,vDistance/viewportWidth);
    if(glowPass>.5){
      if(lighting<.5||lightMask<.5){gl_FragColor=vec4(0.);return;}
      float depthLight=(mix(.28,.58,nearFocus)*(1.+.42*musicScene)+flowAura*.18+flowPulse*.48+beatAttack*.92)*chapterGlow;
      gl_FragColor=vec4(source*depthLight,1.);return;
    }
    float protect=max(max(vGold,vHead*step(vDistance/viewportWidth,focus+.001)),clef);
    float t=smoothstep(.04,.70,vDistance/viewportWidth-focus)*fade*(1.-protect);
    float gray=dot(source,vec3(.2126,.7152,.0722));
    vec3 ink=mix(vec3(gray),source,mix(1.,.20,t))*mix(1.,.72,t);
    ink=min(vec3(1.),ink+source*lightMask*lighting*(.05+.13*nearFocus+flowAura*.22+flowPulse*.48)*(1.+.5*musicScene)*chapterGlow);
    vec2 pixel=gl_FragCoord.xy/pixelRatio;
    float edgeX=min(pixel.x,viewport.x-pixel.x);
    float edgeY=min(pixel.y,viewport.y-pixel.y);
    float edgeOpacity=smoothstep(0.,min(viewport.x*.16,180.),edgeX)*smoothstep(0.,min(viewport.y*.09,72.),edgeY);
    float ribbonFade=smoothstep(0.,.095,sourceProgress)*(1.-smoothstep(.91,1.,sourceProgress));
    edgeOpacity*=ribbonFade;
    // The same note mesh gets uneven pigment coverage instead of a separate
    // painted score image; the source geometry and event anchors stay intact.
    edgeOpacity*=mix(1.,clamp((.74+.26*grain-dry)*paintedCoverage,.24,1.),artWeight*.82);
    edgeOpacity=mix(edgeOpacity,1.,clef);
    ink=mix(vec3(${BACKGROUND.join(',')}),ink,edgeOpacity);
    ink=min(vec3(1.),ink+source*beatAttack*musicWeight*.72);
    // Clef and tuplet use separate semantic masks even though both deform as glyphs.
    gl_FragColor=vec4(mix(vec3(${BACKGROUND.join(',')}),ink,mix(1.,.32,t)),max(vGold,clef));
  }`;
const completeFragmentShader = `${scoreMaterialShader}\n${fragmentShader}`;

const postFragment = `
  uniform sampler2D image,depths,glowImage;
  uniform vec2 texel;
  uniform float focus,viewportWidth,blur,near,far,pixelRatio,glowStrength;
  varying vec2 vUv;
  float distanceAt(vec2 uv){float z=texture2D(depths,uv).x;return near*far/(far-z*(far-near));}
  vec3 glowAt(vec2 uv){
    vec2 spread=texel*2.2*pixelRatio;
    return texture2D(glowImage,uv).rgb*.28
      +(texture2D(glowImage,uv+vec2(spread.x,0.)).rgb
       +texture2D(glowImage,uv-vec2(spread.x,0.)).rgb
       +texture2D(glowImage,uv+vec2(0.,spread.y)).rgb
       +texture2D(glowImage,uv-vec2(0.,spread.y)).rgb)*.18;
  }
  void main(){
    vec4 original=texture2D(image,vUv);float d=distanceAt(vUv)/viewportWidth;
    float radius=clamp((d-focus-.05)/.2,0.,3.)/3.*2.8*pixelRatio*blur;
    vec3 glow=glowAt(vUv)*glowStrength;
    if(original.a>0.||d<=focus+.05||radius<.01){gl_FragColor=vec4(original.rgb+glow,1.);return;}
    vec3 total=vec3(0.);float weights=0.;
    for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
      vec2 offset=vec2(float(x),float(y));float weight=exp(-dot(offset,offset)/2.);
      vec2 uv=vUv+offset*radius*texel;
      vec4 sampleInk=texture2D(image,uv);
      if(distanceAt(uv)/viewportWidth<=focus+.05||sampleInk.a>0.)sampleInk=original;
      total+=sampleInk.rgb*weight;weights+=weight;
    }
    gl_FragColor=vec4(total/weights+glow,1.);
  }`;

export async function mountGpuRibbon(host, { score, view, points, groups, engraving, voicePaths = [], width, height, pixelRatio = 1, diagnostics = true, markerId = DEFAULT_MARKER }) {
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
  const trebleClefContours = trebleClefFromTimeline(score);
  const frames = new THREE.DataTexture(table.data, TABLE_SIZE, 2, THREE.RGBAFormat, THREE.FloatType);
  frames.needsUpdate = true;
  let geometry = buildRibbonGeometry(score, view, groups, engraving, voicePaths, markerId, trebleClefContours);
  const focal = width * 1.45, near = width * .01, far = width * 20;
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(height / (2 * focal)) * 180 / Math.PI, width / height, near, far);
  // The reference's world uses screen-down Y. Flip only the projection Y so
  // camera right, world positions and transported normals retain their signs.
  camera.projectionMatrix.elements[5] *= -1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const spriteAtlas = createPixelSpriteAtlas(THREE);
  const pigmentImage = new Image();
  pigmentImage.src = new URL('../about/materials/pigment-atlas.png', import.meta.url).href;
  let pigmentPixels = new Uint8Array([255,255,255,255]), pigmentWidth = 1, pigmentHeight = 1;
  let pigmentLoaded = false;
  try {
    await pigmentImage.decode();
    const surface = document.createElement('canvas');
    surface.width = pigmentImage.naturalWidth; surface.height = pigmentImage.naturalHeight;
    const context = surface.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2D context for the pigment atlas.');
    context.drawImage(pigmentImage, 0, 0);
    pigmentPixels = new Uint8Array(context.getImageData(0,0,surface.width,surface.height).data);
    pigmentWidth = surface.width; pigmentHeight = surface.height; pigmentLoaded = true;
  } catch (error) {
    console.warn('The pigment atlas is unavailable; using the procedural material.', error);
  }
  const pigmentAtlas = new THREE.DataTexture(pigmentPixels, pigmentWidth, pigmentHeight);
  pigmentAtlas.flipY = true;
  pigmentAtlas.colorSpace = THREE.LinearSRGBColorSpace;
  pigmentAtlas.needsUpdate = true;
  const uniforms = {
    spriteAtlas: { value: spriteAtlas }, pigmentAtlas: { value: pigmentAtlas }, pigmentReady: { value: pigmentLoaded ? 1 : 0 },
    frames: { value: frames }, ribbonLength: { value: table.length }, arcStart: { value: 0 }, arcSpan: { value: 0 },
    unit: { value: 0 }, aspect: { value: 1 }, middle: { value: (score.staffLines[0] + score.staffLines.at(-1)) / 2 },
    focal: { value: focal }, viewportWidth: { value: width }, viewport: { value: new THREE.Vector2(width, height) },
    frameOffset: { value: new THREE.Vector2(0, 0) },
    pixelRatio: { value: pixelRatio },
    sourceRange: { value: new THREE.Vector2(...Object.values(scoreSourceRange(view, score.bars, score.staffLines, true, trebleClefFromTimeline(score).glyph))) }, focus: { value: 0 },
    staffLinesA: { value: new Float32Array(score.staffLines.slice(0, 4)) },
    staffLineE: { value: score.staffLines[4] },
    fade: { value: 0 }, halo: { value: 0 }, pose: { value: 0 },
    lighting: { value: 1 }, musicScene: { value: 0 }, glowPass: { value: 0 }, flowPhase: { value: 0 },
    journey: { value: 0 }, playbackBeat: { value: -1 }, playbackActive: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader,
    side: THREE.DoubleSide, blending: THREE.NoBlending, depthTest: true, depthWrite: true });
  const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const glowTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  glowTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const output = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  output.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { image: { value: target.texture }, depths: { value: target.depthTexture }, glowImage: { value: glowTarget.texture },
      texel: { value: new THREE.Vector2(1, 1) },
      focus: uniforms.focus, viewportWidth: uniforms.viewportWidth, blur: { value: 0 }, near: { value: near },
      far: { value: far }, pixelRatio: { value: pixelRatio }, glowStrength: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: postFragment });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);postScene.add(quad);
  const gl = renderer.getContext();
  let timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const pending = [], metrics = { pigmentReady: pigmentLoaded, samples: [], gpuTimer: Boolean(timer), revision: THREE.REVISION,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    geometryPolicy: 'Source UV geometry and 2048 Float32 frames uploaded once; poses update camera and uniforms only.',
    maskPolicy: 'RGBA alpha stores gold coverage; no RGB threshold.',
    geometryBuilds: 1, triangulationPasses: 1, geometryUploads: 0, frameTextureUploads: 0,
    geometryBytes: Object.values(geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0),
    frameTextureBytes: table.data.byteLength, vertices: geometry.attributes.position.count,
    hardwareAcceleration: 'Unknown; renderer string does not prove hardware acceleration.',
    presentation: 'Not measured; next RAF is scheduling latency only.', contextLost: false };
  let disposed = false, cachedPose = null, cachedZoom = null, cachedJourney = null, cachedFrameX = 0, cachedFrameY = 0,
    cachedMusicScene = false, cachedLighting = true, cachedFlowPhase = null, cachedPlaybackBeat = -1,
    cachedPlaybackActive = false, lastVariant = 'C';
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
  const marker = points.find(p => p.id === markerId) ?? points[0];
  const targetPosition = new THREE.Vector3();
  let pixelRatioInitialized = false;

  function setPixelRatio(value) {
    if (!Number.isFinite(value) || value <= 0 || value > 4) throw new RangeError('Pixel ratio must be in (0,4].');
    if (pixelRatioInitialized && value === pixelRatio) return;
    pixelRatio = value;renderer.setPixelRatio(value);
    const w = Math.round(width * value), h = Math.round(height * value);
    renderer.setSize(w / value, h / value, false);
    target.setSize(w, h);glowTarget.setSize(w, h);output.setSize(w, h);
    postMaterial.uniforms.texel.value.set(1 / w, 1 / h);
    uniforms.pixelRatio.value = value;postMaterial.uniforms.pixelRatio.value = value;
    metrics.pixelRatio = value;pixelRatioInitialized = true;lastSample = null;
  }
  setPixelRatio(pixelRatio);

  function updatePose(pose, cameraZoom = 1, frameOffset = { x: 0, y: 0 }) {
    const range = uniforms.sourceRange.value;
    const readingView = { x0: range.x, x1: range.y };
    const project = createTravelProjector(width, height, score, pose, readingView, .2, true, projectorScratch, cameraZoom);
    uniforms.arcStart.value = pose * .65 * table.length;
    uniforms.arcSpan.value = project.arcLength;
    const arrive = Math.max(0, Math.min(1, (pose - .65) / .2));
    const sourceWidth = readingView.x1 - readingView.x0;
    const mobileStaffScale = width <= 700 ? Math.min(1.8, 1 + Math.max(0, cameraZoom - 1) * .32) : 1;
    uniforms.unit.value = (width * 1.5 * (1 - arrive) + project.arcLength * arrive) / sourceWidth * mobileStaffScale;
    uniforms.aspect.value = project.uvAspect;
    uniforms.focus.value = readingFocus(project, readingView, width, height, marker, pose, focusScratch).distance;
    uniforms.pose.value = pose;
    uniforms.frameOffset.value.set(frameOffset.x, frameOffset.y);
    camera.position.fromArray(project.camera.position);
    targetPosition.fromArray(project.camera.target);camera.lookAt(targetPosition);camera.updateMatrixWorld();
    if (diagnostics) {
      canvas.dataset.camera = JSON.stringify(project.camera);
      canvas.dataset.marker = JSON.stringify(project(marker.x, marker.y));
    }
    cachedPose = pose;
    cachedZoom = cameraZoom;
    cachedFrameX = frameOffset.x;
    cachedFrameY = frameOffset.y;
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

  function setNotation(notation) {
    if (disposed) throw new Error('GPU ribbon is disposed.');
    const next = buildRibbonGeometry(score, notation.view, notation.groups, notation.engraving,
      notation.voicePaths ?? [], markerId, trebleClefContours);
    const previous = geometry;
    geometry = next;
    mesh.geometry = next;
    previous.dispose();
    metrics.geometryBuilds++;
    metrics.geometryBytes = Object.values(next.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
    metrics.vertices = next.attributes.position.count;
    lastSample = null;
  }

  function setSourceRange(startX, endX) {
    if (!Number.isFinite(startX) || !Number.isFinite(endX) || endX <= startX) throw new RangeError('Source range must be finite and increasing.');
    const range = uniforms.sourceRange.value;
    if (range.x === startX && range.y === endX) return false;
    range.set(startX, endX);
    lastSample = null;
    return true;
  }

  function draw(pose, variant = 'C', captureSample = diagnostics, cameraZoom = 1, frameOffset = { x: 0, y: 0 }, musicScene = false, lighting = true, flowPhase = 0, journey = 0, playback = null) {
    if (disposed) throw new Error('GPU ribbon is disposed.');
    if (metrics.contextLost) return { pose, variant, cpuMs: 0, gpuMs: null, gpuStatus: 'context-lost' };
    if (!Number.isFinite(pose) || pose < 0 || pose > 1) throw new RangeError('Pose must be in [0,1].');
    if (!Number.isFinite(cameraZoom) || cameraZoom <= 0) throw new RangeError('Camera zoom must be a positive finite number.');
    const frameX = Number.isFinite(frameOffset?.x) ? frameOffset.x : 0;
    const frameY = Number.isFinite(frameOffset?.y) ? frameOffset.y : 0;
    const wrappedFlowPhase = ((Number.isFinite(flowPhase) ? flowPhase : 0) % 1 + 1) % 1;
    const chapterJourney = Number.isFinite(journey) ? Math.max(0, Math.min(5, journey)) : 0;
    const playbackBeat = Number.isFinite(playback?.beat) ? playback.beat : -1;
    const playbackActive = Boolean(playback?.active && playbackBeat >= 0);
    if (cachedPose === pose && cachedZoom === cameraZoom && cachedFrameX === frameX && cachedFrameY === frameY
      && cachedMusicScene === Boolean(musicScene) && cachedLighting === Boolean(lighting)
      && cachedJourney === chapterJourney && cachedFlowPhase === wrappedFlowPhase
      && cachedPlaybackBeat === playbackBeat && cachedPlaybackActive === playbackActive
      && lastVariant === variant && lastSample) return lastSample;
    const started = performance.now();
    if (diagnostics || pending.length) pollGPU();
    const uploadStart=metrics.bufferUploadCalls,textureStart=metrics.actualFrameUploads;
    const poseCached = cachedPose === pose && cachedZoom === cameraZoom && cachedFrameX === frameX && cachedFrameY === frameY;
    if (!poseCached) updatePose(pose, cameraZoom, { x: frameX, y: frameY });
    uniforms.halo.value = pose < .85 && variant !== 'A' ? 1 : 0;
    uniforms.fade.value = pose < .4 && variant !== 'A' ? 1 : 0;
    uniforms.musicScene.value = musicScene ? 1 : 0;
    uniforms.journey.value = chapterJourney;
    uniforms.playbackBeat.value = playbackBeat;
    uniforms.playbackActive.value = playbackActive ? 1 : 0;
    uniforms.lighting.value = lighting ? 1 : 0;
    uniforms.flowPhase.value = wrappedFlowPhase;
    uniforms.glowPass.value = 0;
    postMaterial.uniforms.blur.value = variant === 'C' && pose < .85 ? 1 : 0;
    postMaterial.uniforms.glowStrength.value = lighting ? (musicScene ? .92 : .72) : 0;
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
    if(lighting){
      uniforms.glowPass.value=1;renderer.setClearColor(0x000000,0);
      renderer.setRenderTarget(glowTarget);renderer.render(scene,camera);
      uniforms.glowPass.value=0;
    }
    renderer.setClearColor(new THREE.Color(...BACKGROUND),0);
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
    cachedMusicScene = Boolean(musicScene);
    cachedLighting = Boolean(lighting);
    cachedJourney = chapterJourney;
    cachedFlowPhase = wrappedFlowPhase;
    cachedPlaybackBeat = playbackBeat;
    cachedPlaybackActive = playbackActive;
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
    if (cachedPose !== null) {
      draw(cachedPose, lastVariant, false, cachedZoom ?? 1, { x: cachedFrameX, y: cachedFrameY },
        cachedMusicScene, cachedLighting, cachedFlowPhase ?? 0, cachedJourney ?? 0,
        { beat: cachedPlaybackBeat, active: cachedPlaybackActive });
    }
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
    geometry.dispose();frames.dispose();spriteAtlas.dispose();pigmentAtlas.dispose();material.dispose();quad.geometry.dispose();postMaterial.dispose();
    target.depthTexture.dispose();target.dispose();glowTarget.dispose();output.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    for(const [method,original] of originalGL)gl[method]=original;
  }
  return { canvas, draw, pollGPU, metrics, dispose, setPixelRatio, setNotation, setSourceRange, readPixels,loseContext,restoreContext };
}
