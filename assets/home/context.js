import * as THREE from "three";

export const FRONTAL_MODEL_YAW = THREE.MathUtils.degToRad(90);
export const MAX_YAW = THREE.MathUtils.degToRad(90);
export const RESTING_LEFT_YAW = -MAX_YAW;
export const MOBILE_RESTING_YAW = THREE.MathUtils.degToRad(-68);
export const RESTING_PITCH = THREE.MathUtils.degToRad(2);
export const LOOK_UP_LIMIT = THREE.MathUtils.degToRad(15);
export const LOOK_DOWN_LIMIT = THREE.MathUtils.degToRad(20);
export const TRACKING_FULL_TILT_AT = 0.75;
export const MODEL_SCALE_FACTOR = 0.8;
export const BASE_MODEL_SIZE = 1.85;
export const FLOOR_Y = -0.865;

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

export function createHomeContext({ homeCapture, homeEnvironment, mobileViewport }) {
  const frame = document.querySelector("#scene-frame");
  const canvas = document.querySelector("#scene-canvas");

  return {
    homeCapture,
    homeEnvironment,
    mobileViewport,
    frame,
    canvas,
    fallback: document.querySelector("#scene-fallback"),
    track: document.querySelector("#hero-track"),
    heroScreen: document.querySelector(".hero-screen"),
    heroCopy: document.querySelector(".hero-copy"),
    status: document.querySelector("#scene-status"),
    stageLabel: document.querySelector("#scene-stage"),
    poster: document.querySelector("#hero-poster"),
    posterImage: document.querySelector("#hero-poster-image"),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)"),
    pointerQuery: matchMedia("(pointer: fine)"),
    stageNames: document.documentElement.lang.startsWith("pt")
      ? ["IDEIA", "ESTRUTURA", "FORMA"]
      : ["IDEA", "STRUCTURE", "FORM"],
    debugMode: new URLSearchParams(location.search).has("knight-debug"),
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(32, 1, 0.1, 40),
    raycaster: new THREE.Raycaster(),
    pointerNdc: new THREE.Vector2(),
    pointerWorld: new THREE.Vector3(),
    pointerTarget: new THREE.Vector3(),
    modelPivot: new THREE.Group(),
    trackingCenterLocal: new THREE.Vector3(),
    trackingCenterWorld: new THREE.Vector3(),
    trackingRestQuaternion: new THREE.Quaternion(),
    trackingRestMatrix: new THREE.Matrix4(),
    verticalAxis: new THREE.Vector3(0, 1, 0),
    studioLights: [],
    surfaceMaterials: [],
    wireframes: [],
    revealMaterials: [],
    rimStrengthUniforms: [],
    assemblyUniform: { value: 1 },
    fragmentSpreadUniform: { value: 0.24 },
    fragmentOriginUniform: { value: new THREE.Vector3() },
    rimAssemblyUniform: { value: 0 },
    reflectorOpacityUniform: { value: 1 },
    whiteRevealLight: null,
    whiteRevealIntensity: 0.65,
    fragmentStats: null,
    renderer: null,
    knight: null,
    reflectiveFloor: null,
    spatialEnvironment: null,
    lightingDisposed: false,
    frameRequest: 0,
    sceneVisible: true,
    targetYaw: RESTING_LEFT_YAW,
    targetPitch: RESTING_PITCH,
    targetReveal: 0,
    yaw: RESTING_LEFT_YAW,
    pitch: RESTING_PITCH,
    revealAmount: 0,
    progress: 0,
    lastFrameAt: 0,
    disposed: false,
  };
}
