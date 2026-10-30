import { createLabsCamera } from './camera.js';
import { createLabsContext } from './core/ctx.js';
import { createLabsLighting } from './lighting.js';
import { createStaticFolder } from './static-folder.js';
import { createBinaryRenderer } from './binary.js';
import { createFireflies } from './fireflies.js';
import { createLabsBackground } from './background.js';
import { createLabsTransitions } from './transitions.js';
import { createGeometryDebug } from './geometry-debug.js';
import { createLabsPointer } from './pointer.js';

export async function mountLabsFolderScene(stage) {
const ctx = createLabsContext(stage);
const {
  canvas,
  stageSize,
  renderer,
  scene,
  folderRoot,
  reducedMotion,
} = ctx;
const cameraRig = createLabsCamera(ctx);
const { camera, cameraTarget } = cameraRig;
const lighting = createLabsLighting(ctx, camera);
const composer = lighting.composer;
const staticFolder = createStaticFolder(ctx);
const { glyphs } = staticFolder;
const geometryDebugScaffolds = staticFolder.debugScaffolds;
const binary = createBinaryRenderer(ctx, glyphs);
const {
  geometryDebugEnabled,
  captureEnabled,
  orbitEnabled,
  glyphSpacing,
  requestedGlowProfile,
  randomSeed: RANDOM_SEED,
} = ctx.config;
let resizeObserver = null;
let stageObserver = null;
let resourcesDisposed = false;
let orbitControls = null;
let background = null;
let folderRoots = [];
let fireflyField = null;
let pointerController = null;
let geometryDebug = null;
let transitions = null;
let idleFrame = 0;
let previousIdleTime = 0;
let frozenTime = captureEnabled ? 0 : null;

function disposeSceneResources() {
  if (resourcesDisposed) return;
  resourcesDisposed = true;
  orbitControls?.dispose();
  orbitControls = null;

  background?.dispose();
  fireflyField?.dispose();
  staticFolder.dispose();
  const geometries = new Set();
  const materials = new Set();

  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  binary.dispose();
  composer.dispose();
  renderer.dispose();
}

function resizeScene() {
  const size = stageSize();
  cameraRig.resize(size.width, size.height);
  lighting.resize(size.width, size.height);
  if (folderRoots.length === 2) applyProgress(transitions.progress);
  composer.render();
}

function applyProgress(position) {
  const state = transitions.setProgress(position);
  fireflyField?.setTransitionState(state);
  return state;
}

function setIdleTime(seconds) {
  binary.setIdleTime(seconds);
  fireflyField?.setIdleTime(seconds);
}

function setTime(seconds) {
  const nextTime = Number(seconds);
  if (!Number.isFinite(nextTime)) throw new TypeError('Labs capture time must be a finite number.');
  frozenTime = nextTime;
  setIdleTime(nextTime);
  pointerController?.resetCaptureRecoil(nextTime);
  canvas.dataset.captureTime = nextTime.toFixed(3);
  if (captureEnabled) {
    canvas.dataset.glyphMutationFraction = binary.measureGlyphMutationFraction(nextTime).toFixed(4);
  }
  composer.render();
}

function animateIdle(timestamp) {
  idleFrame = 0;
  if (document.hidden || reducedMotion.matches) {
    canvas.dataset.idleRunning = 'false';
    return;
  }
  const seconds = frozenTime ?? timestamp * 0.001;
  const delta = frozenTime === null && previousIdleTime
    ? Math.min((timestamp - previousIdleTime) * 0.001, 0.05)
    : 0;
  previousIdleTime = timestamp;
  setIdleTime(seconds);
  pointerController.update(delta);
  fireflyField?.updateRecoil(delta, seconds);
  composer.render();
  if (frozenTime === null) idleFrame = requestAnimationFrame(animateIdle);
}

function startIdle() {
  if (!geometryDebugEnabled && !captureEnabled && !idleFrame && !document.hidden && !reducedMotion.matches) {
    previousIdleTime = 0;
    canvas.dataset.idleRunning = 'true';
    idleFrame = requestAnimationFrame(animateIdle);
  }
}

function stopIdle() {
  if (idleFrame) {
    cancelAnimationFrame(idleFrame);
    idleFrame = 0;
  }
  canvas.dataset.idleRunning = 'false';
}

function onVisibilityChange() {
  if (document.hidden) stopIdle();
  else startIdle();
}

function onMotionPreferenceChange() {
  if (reducedMotion.matches) {
    stopIdle();
    pointerController?.clear();
    binary.setIdleStrength(0);
    fireflyField?.setIdleStrength(0);
    composer.render();
  }
  else startIdle();
}

function addNextFolderDepth() {
  staticFolder.configurePreviewFrame();
  const { previewPosition, previewScale } = ctx.layout;
  return binary.addNextFolderDepth({
    previewPosition,
    previewScale,
    getProjectedPreviewPosition: cameraRig.getProjectedPreviewPosition,
    geometryDebugScaffolds,
  });
}

try {
  if (orbitEnabled) {
    orbitControls = await cameraRig.createOrbitControls(() => composer.render());
  }
  const meshes = await staticFolder.loadFolderScaffold();
  staticFolder.addShellOccluder(meshes);
  staticFolder.addGeometryDebugScaffold(meshes);
  const frontCounts = staticFolder.makeFrontGlyphs(meshes);
  const depthCount = staticFolder.makeRearGlyphs(meshes);
  const sideCount = staticFolder.makeSideGlyphs(meshes);
  const sheetCount = 0; // Sheets are deferred until the binary folder is approved.
  const { renderGroups: glyphRenderGroups } = binary.addGlyphInstances();
  const nextRoot = addNextFolderDepth();
  folderRoots = [folderRoot, nextRoot];
  transitions = createLabsTransitions(ctx, { binary, cameraRig, folderRoots });
  fireflyField = createFireflies(ctx, { glyphs, nextRoot, glyphAtlas: binary.glyphAtlas });
  pointerController = createLabsPointer(ctx, {
    binary,
    fireflies: fireflyField,
    render: () => composer.render(),
    getCaptureTime: () => frozenTime ?? 0,
  });
  background = createLabsBackground(ctx, glyphs);
  const floor = background.floor;
  geometryDebug = createGeometryDebug(ctx, {
    folderRoots,
    scaffolds: geometryDebugScaffolds,
    fireflies: fireflyField,
    floor,
    render: () => composer.render(),
  });
  applyProgress(0);
  if (geometryDebugEnabled) {
    geometryDebug.mount();
    stopIdle();
    geometryDebug.setMode('solid');
  }
  composer.render();
  if (captureEnabled) setTime(0);
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resizeScene);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener('resize', resizeScene, { passive: true });
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.addEventListener('change', onMotionPreferenceChange);
  pointerController.mount();
  if ('IntersectionObserver' in window) {
    stageObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) startIdle();
      else stopIdle();
    }, { threshold: 0.01 });
    stageObserver.observe(stage);
  } else {
    startIdle();
  }

  canvas.dataset.proofReady = 'true';
  canvas.dataset.captureReady = String(captureEnabled);
  if (captureEnabled) canvas.dataset.captureSeed = `0x${RANDOM_SEED.toString(16)}`;
  stage.classList.add('labs-webgl-static');
  canvas.dataset.glyphCount = String(glyphs.length);
  canvas.dataset.frontGlyphCount = String(frontCounts.accepted);
  canvas.dataset.frontEdgeGlyphCount = String(frontCounts.edgeAccepted);
  canvas.dataset.glyphSpacing = glyphSpacing.toFixed(3);
  canvas.dataset.glowProfile = requestedGlowProfile;
  canvas.dataset.rendererPixelRatio = String(renderer.getPixelRatio());
  canvas.dataset.depthGlyphCount = String(depthCount);
  canvas.dataset.sideGlyphCount = String(sideCount);
  canvas.dataset.sheetCount = String(sheetCount);
  canvas.dataset.glyphRenderGroups = String(glyphRenderGroups);
  canvas.dataset.nextFolderRenderGroups = String(nextRoot.userData.glyphGroupCount);
  canvas.dataset.fireflyCount = String(fireflyField.total);
  canvas.dataset.fireflyDistribution = Object.values(fireflyField.countByRegion).join(',');
  canvas.dataset.fireflyBinaryCount = String(fireflyField.binaryCount);
  canvas.dataset.fireflyHeaderCount = String(fireflyField.headerCount);
  canvas.dataset.idleRunning = 'false';
  canvas.dataset.pointerActive = 'false';
  canvas.dataset.pointerResponse = 'fireflies+front-glyphs';
  canvas.dataset.scrollPosition = '0.000';
  return {
    ready: Promise.resolve(true),
    setTime,
    setPointer: pointerController.setCapture,
    setProgress(position) {
      if (geometryDebugEnabled) return;
      applyProgress(position);
      if (captureEnabled || reducedMotion.matches) composer.render();
    },
    dispose() {
      resizeObserver?.disconnect();
      stageObserver?.disconnect();
      stopIdle();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      pointerController?.dispose();
      window.removeEventListener('resize', resizeScene);
      geometryDebug?.dispose();
      disposeSceneResources();
      canvas.remove();
      stage.classList.remove('labs-webgl-static');
    },
  };
} catch (error) {
  canvas.dataset.proofError = error instanceof Error ? error.message : String(error);
  resizeObserver?.disconnect();
  stageObserver?.disconnect();
  stopIdle();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.removeEventListener('change', onMotionPreferenceChange);
  pointerController?.dispose();
  geometryDebug?.dispose();
  disposeSceneResources();
  canvas.remove();
  throw error;
}
}
