import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const RANDOM_SEED = 0x4c414253;

const glowProfiles = {
  baseline: { strength: 0.8, radius: 0.55, threshold: 0.2, faceEmission: 1.2, perimeterEmission: 1 },
  balanced: { strength: 1, radius: 0.8, threshold: 0.14, faceEmission: 1.5, perimeterEmission: 1.05 },
  cinematic: { strength: 1.2, radius: 0.9, threshold: 0.12, faceEmission: 1.65, perimeterEmission: 1.1 },
  'blue-matter': { strength: 1.05, radius: 0.85, threshold: 0.12, faceEmission: 2.4, perimeterEmission: 1.05 },
  'edge-emission': { strength: 1.15, radius: 0.9, threshold: 0.12, faceEmission: 2.4, perimeterEmission: 1.3 },
  'high-contrast': { strength: 1.25, radius: 0.95, threshold: 0.1, faceEmission: 3, perimeterEmission: 1.3 },
  'blue-max': { strength: 1.25, radius: 0.95, threshold: 0.1, faceEmission: 3.5, perimeterEmission: 1.3 },
  'blue-focused': { strength: 1.25, radius: 0.45, threshold: 0.26, faceEmission: 3.5, perimeterEmission: 1.3 },
  'edge-focus': { strength: 1.1, radius: 0.25, threshold: 0.32, faceEmission: 3.5, perimeterEmission: 1.45 },
  'reference-glow': { strength: 1.15, radius: 0.35, threshold: 0.28, faceEmission: 3.2, perimeterEmission: 1.4 },
  'blue-middle': { strength: 1.2, radius: 0.65, threshold: 0.17, faceEmission: 3.5, perimeterEmission: 1.4 },
  'blue-middle-edge': { strength: 1.2, radius: 0.65, threshold: 0.17, faceEmission: 3.5, perimeterEmission: 1.6 },
};

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createLabsContext(stage) {
  const canvas = document.createElement('canvas');
  canvas.className = 'lab-webgl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);

  const stageSize = () => ({
    width: Math.max(1, stage.clientWidth),
    height: Math.max(1, stage.clientHeight),
  });
  const initialSize = stageSize();
  const queryParams = new URLSearchParams(window.location.search);
  const geometryDebugEnabled = queryParams.get('folder-geometry-debug') === '1';
  const captureEnabled = queryParams.get('labs-capture') === '1';
  const orbitEnabled = queryParams.get('orbit') === '1';
  const spacingVariants = { '064': 0.064, '095': 0.095, '125': 0.125 };
  const glowProfileNames = Object.keys(glowProfiles);
  const requestedGlowProfile = captureEnabled && glowProfileNames.includes(queryParams.get('labs-glow'))
    ? queryParams.get('labs-glow')
    : 'blue-middle';
  const glyphSpacing = captureEnabled && spacingVariants[queryParams.get('labs-spacing')]
    ? spacingVariants[queryParams.get('labs-spacing')]
    : 0.125;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initialSize.width, initialSize.height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const folderRoot = new THREE.Group();
  folderRoot.position.x = 0.3;
  scene.add(folderRoot);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clock = {
    frozenTime: captureEnabled ? 0 : null,
    previousIdleTime: 0,
    idleFrame: 0,
  };

  return {
    THREE,
    GLTFLoader,
    Reflector,
    EffectComposer,
    RenderPass,
    UnrealBloomPass,
    OutputPass,
    loadOrbitControls: () => import('three/addons/controls/OrbitControls.js'),
    stage,
    canvas,
    stageSize,
    initialSize,
    config: {
      captureEnabled,
      geometryDebugEnabled,
      orbitEnabled,
      glyphSpacing,
      requestedGlowProfile,
      glowProfile: glowProfiles[requestedGlowProfile],
      randomSeed: RANDOM_SEED,
    },
    renderer,
    scene,
    folderRoot,
    layout: {
      heroPosition: new THREE.Vector3(0.3, 0, 0),
      heroScale: new THREE.Vector3(1, 1, 1),
      previewPosition: new THREE.Vector3(5.58, 0.1, 1.99),
      previewScale: new THREE.Vector3(0.62, 0.62, 0.62),
      previewCenterNdcX: 0.66,
      previewFrame: null,
    },
    random: createSeededRandom(RANDOM_SEED),
    clock,
    reducedMotion,
    pointer: { active: false, x: 0, y: 0, strength: 0 },
    camera: null,
    composer: null,
    folderRoots: [],
    disposed: false,
  };
}
