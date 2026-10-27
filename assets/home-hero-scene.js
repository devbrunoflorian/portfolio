import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";

const frame = document.querySelector("#scene-frame");
const canvas = document.querySelector("#scene-canvas");
const fallback = document.querySelector("#scene-fallback");
const track = document.querySelector("#hero-track");
const heroScreen = document.querySelector(".hero-screen");
const status = document.querySelector("#scene-status");
const stageLabel = document.querySelector("#scene-stage");
const poster = document.querySelector("#hero-poster");
const posterImage = document.querySelector("#hero-poster-image");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = matchMedia("(max-width: 640px)");
const pointerQuery = matchMedia("(pointer: fine)");
const stageNames = document.documentElement.lang.startsWith("pt")
  ? ["IDEIA", "ESTRUTURA", "FORMA"]
  : ["IDEA", "STRUCTURE", "FORM"];
const debugMode = new URLSearchParams(location.search).has("knight-debug");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerWorld = new THREE.Vector3();
const pointerTarget = new THREE.Vector3();
const modelPivot = new THREE.Group();
const trackingCenterLocal = new THREE.Vector3();
const trackingCenterWorld = new THREE.Vector3();
const trackingRestQuaternion = new THREE.Quaternion();
const trackingRestMatrix = new THREE.Matrix4();
const verticalAxis = new THREE.Vector3(0, 1, 0);
const studioLights = [];
const surfaceMaterials = [];
const wireframes = [];
const revealMaterials = [];
const rimStrengthUniforms = [];
let renderer;
let knight;
let reflectiveFloor;
let frameRequest = 0;
let sceneVisible = true;
const FRONTAL_YAW = THREE.MathUtils.degToRad(90);
const MAX_YAW = THREE.MathUtils.degToRad(35);
const RESTING_LEFT_YAW = FRONTAL_YAW - MAX_YAW;
const RESTING_PITCH = THREE.MathUtils.degToRad(2);
const LOOK_UP_LIMIT = THREE.MathUtils.degToRad(15);
const LOOK_DOWN_LIMIT = THREE.MathUtils.degToRad(20);
const TRACKING_FULL_TILT_AT = 0.75;
let targetYaw = RESTING_LEFT_YAW;
let targetPitch = RESTING_PITCH;
let targetReveal = 0;
let yaw = RESTING_LEFT_YAW;
let pitch = RESTING_PITCH;
let revealAmount = 0;
let progress = 0;
let lastFrameAt = 0;

const LOW_POLY_WIRE_VERTEX_BUDGET = 1100;
const MODEL_SCALE_FACTOR = 0.8;
const BASE_MODEL_SIZE = 1.85;
const FLOOR_Y = -0.865;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function queueFrame() {
  if (!renderer || !sceneVisible || frameRequest) return;
  frameRequest = requestAnimationFrame(renderFrame);
}

function addStudioLight(light) {
  scene.add(light);
  studioLights.push({ light, parent: scene, position: light.position.clone() });
}

function studioLightsAreFixed() {
  return studioLights.every(({ light, parent, position }) => (
    parent === scene && light.parent === scene && light.position.equals(position)
  ));
}

function updateSceneProgress() {
  if (debugMode || reducedMotion.matches) return;
  const extent = Math.max(1, track.offsetHeight - innerHeight);
  progress = clamp(-track.getBoundingClientRect().top / extent);
  const stage = Math.min(stageNames.length - 1, Math.floor(progress * stageNames.length));
  track.dataset.stage = String(stage);
  frame.dataset.progress = progress.toFixed(3);
  stageLabel.textContent = `${String(stage + 1).padStart(2, "0")} / ${stageNames[stage]}`;
  queueFrame();
}

function createRevealMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointer: { value: new THREE.Vector3() },
      uReveal: { value: 0 },
      uBaseOpacity: { value: 0.38 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vec4 viewPosition = viewMatrix * worldPosition;
        viewPosition.xyz += normalize(-viewPosition.xyz) * 0.001;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uPointer;
      uniform float uReveal;
      uniform float uBaseOpacity;
      varying vec3 vWorldPosition;
      void main() {
        float distanceToPointer = distance(vWorldPosition, uPointer);
        float falloff = 1.0 - smoothstep(0.05, 0.34, distanceToPointer);
        float localizedReveal = falloff * uReveal;
        float alpha = uBaseOpacity + localizedReveal * (0.88 - uBaseOpacity);
        if (alpha < 0.025) discard;
        vec3 color = mix(vec3(0.70, 0.73, 0.78), vec3(0.95, 0.12, 0.20), localizedReveal);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

async function prepareKnight(root) {
  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });
  const simplifier = new SimplifyModifier();

  for (const mesh of meshes) {
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sources.map(() => {
      const material = new THREE.MeshStandardMaterial({
        color: debugMode ? "#66686d" : "#121315",
        metalness: debugMode ? 0.04 : 0.3,
        roughness: debugMode ? 0.62 : 0.42,
      });
      const rimStrength = { value: 0 };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uRimColor = { value: new THREE.Color("#ff203b") };
        shader.uniforms.uRimDirectionWorld = { value: new THREE.Vector3(4, 1.5, 4).normalize() };
        shader.uniforms.uRimStrength = rimStrength;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `#include <common>
          uniform vec3 uRimColor;
          uniform vec3 uRimDirectionWorld;
          uniform float uRimStrength;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float rimEdge = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
          float rim = smoothstep(0.72, 0.94, rimEdge);
          vec3 rimDirectionView = normalize(mat3(viewMatrix) * uRimDirectionWorld);
          float redSideMask = smoothstep(0.05, 0.55, dot(normalize(normal), rimDirectionView));
          outgoingLight += uRimColor * rim * redSideMask * uRimStrength;
          #include <opaque_fragment>`,
        );
      };
      material.customProgramCacheKey = () => "knight-controlled-crimson-rim-v1";
      rimStrengthUniforms.push(rimStrength);
      return material;
    });
    surfaceMaterials.push(...materials);
    sources.forEach((material) => material.dispose());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];

    if (debugMode) continue;

    const wireSource = mesh.geometry.clone();
    wireSource.deleteAttribute("normal");
    wireSource.deleteAttribute("uv");
    const vertexCount = wireSource.getAttribute("position").count;
    const targetVertices = Math.min(LOW_POLY_WIRE_VERTEX_BUDGET, Math.max(400, Math.floor(vertexCount * 0.02)));
    let lowPolyGeometry = wireSource;

    if (vertexCount > targetVertices) {
      lowPolyGeometry = await simplifier.modify(wireSource, vertexCount - targetVertices);
      wireSource.dispose();
    }

    const wireGeometry = new THREE.WireframeGeometry(lowPolyGeometry);
    lowPolyGeometry.dispose();
    const wireframe = new THREE.LineSegments(wireGeometry, createRevealMaterial());
    wireframe.renderOrder = 1;
    wireframe.raycast = () => {};
    mesh.add(wireframe);
    wireframes.push(wireframe);
    revealMaterials.push(wireframe.material);
  }
}

function findTrackingCenter(root) {
  root.updateMatrixWorld(true);
  modelPivot.updateMatrixWorld(true);
  const pivotInverse = modelPivot.matrixWorld.clone().invert();
  const bounds = new THREE.Box3().setFromObject(root);
  return bounds.getCenter(new THREE.Vector3()).applyMatrix4(pivotInverse);
}

function projectTrackingCenter() {
  const bounds = frame.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !knight) return null;
  camera.updateMatrixWorld(true);
  trackingRestQuaternion.setFromAxisAngle(verticalAxis, FRONTAL_YAW);
  trackingRestMatrix.compose(modelPivot.position, trackingRestQuaternion, modelPivot.scale);
  trackingCenterWorld.copy(trackingCenterLocal).applyMatrix4(trackingRestMatrix).project(camera);
  return {
    x: bounds.left + ((trackingCenterWorld.x + 1) / 2) * bounds.width,
    y: bounds.top + ((1 - trackingCenterWorld.y) / 2) * bounds.height,
  };
}

function pointerMove(event) {
  if (!renderer || (reducedMotion.matches && !debugMode) || (!debugMode && (mobileViewport.matches || !pointerQuery.matches)) || event.pointerType !== "mouse") return;
  const bounds = frame.getBoundingClientRect();
  const center = projectTrackingCenter();
  if (!bounds.width || !bounds.height || !center) return;

  const dx = event.clientX - center.x;
  const horizontalSideDistance = dx < 0 ? center.x - bounds.left : bounds.right - center.x;
  const normalizedX = clamp(dx / Math.max(1, horizontalSideDistance), -1, 1);
  const trackingX = clamp(normalizedX / TRACKING_FULL_TILT_AT, -1, 1);
  const dy = event.clientY - center.y;
  const verticalSideDistance = dy < 0 ? center.y - bounds.top : bounds.bottom - center.y;
  const normalizedY = clamp(dy / Math.max(1, verticalSideDistance), -1, 1);
  targetYaw = FRONTAL_YAW + trackingX * MAX_YAW;
  targetPitch = normalizedY < 0
    ? normalizedY * LOOK_UP_LIMIT
    : normalizedY * LOOK_DOWN_LIMIT;
  frame.dataset.pointerCenterX = center.x.toFixed(1);
  frame.dataset.pointerCenterY = center.y.toFixed(1);
  frame.dataset.pointerNormalizedX = normalizedX.toFixed(3);
  frame.dataset.pointerNormalizedY = normalizedY.toFixed(3);
  frame.dataset.pointerTracking = trackingX.toFixed(3);
  frame.dataset.pointerTargetYaw = targetYaw.toFixed(4);
  frame.dataset.pointerTargetPitch = targetPitch.toFixed(4);

  if (!debugMode) {
    const canvasBounds = canvas.getBoundingClientRect();
    const insideCanvas = event.clientX >= canvasBounds.left
      && event.clientX <= canvasBounds.right
      && event.clientY >= canvasBounds.top
      && event.clientY <= canvasBounds.bottom;
    let hit;
    if (insideCanvas) {
      pointerNdc.set(((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1, 1 - ((event.clientY - canvasBounds.top) / canvasBounds.height) * 2);
      raycaster.setFromCamera(pointerNdc, camera);
      hit = raycaster.intersectObject(knight, true)[0];
    }
    if (hit) {
      pointerTarget.copy(hit.point);
      targetReveal = 0.9;
    } else {
      pointerTarget.set(0, 0, 0);
      targetReveal = 0;
    }
    frame.dataset.pointerHit = String(Boolean(hit));
  }
  queueFrame();
}

function pointerLeave() {
  targetYaw = RESTING_LEFT_YAW;
  targetPitch = RESTING_PITCH;
  targetReveal = 0;
  pointerTarget.set(0, 0, 0);
  frame.dataset.pointerHit = "false";
  frame.dataset.pointerTracking = "0.000";
  frame.dataset.pointerTargetYaw = targetYaw.toFixed(4);
  frame.dataset.pointerTargetPitch = targetPitch.toFixed(4);
  frame.dataset.pointerNormalizedX = "0.000";
  frame.dataset.pointerNormalizedY = "0.000";
  queueFrame();
}

posterImage?.addEventListener("error", () => {
  poster.hidden = true;
  fallback.src = "/assets/models/chess-knight-006-preview.png";
  fallback.hidden = false;
});

function resizeScene() {
  if (!renderer) return;
  const width = Math.max(1, frame.clientWidth);
  const height = Math.max(1, frame.clientHeight);
  const maxPixelRatio = Math.sqrt(1_800_000 / (width * height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, maxPixelRatio);
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio), false);
  camera.aspect = width / height;
  const isMobile = width <= 640;
  camera.position.set(0, isMobile ? 0.95 : 0.12, isMobile ? 7.5 : 4.55);
  camera.lookAt(0, isMobile ? 0.92 : -0.2, 0);
  camera.updateProjectionMatrix();
  frame.dataset.bufferWidth = String(canvas.width);
  frame.dataset.bufferHeight = String(canvas.height);
  queueFrame();
}

function updateMaterialProgress() {
  if (debugMode || mobileViewport.matches) return;
  const structure = Math.sin(progress * Math.PI);
  const polish = smoothstep(0.42, 0.92, progress);
  for (const material of surfaceMaterials) {
    material.metalness = 0.3 + polish * 0.2;
    material.roughness = 0.42 - polish * 0.08;
  }
  modelPivot.scale.setScalar(1 + progress * 0.025);
  modelPivot.position.y = FLOOR_Y + progress * 0.045;
}

function renderFrame(timestamp) {
  frameRequest = 0;
  if (!renderer || !knight || !sceneVisible) return;
  const elapsed = lastFrameAt ? Math.min(80, timestamp - lastFrameAt) : 16;
  lastFrameAt = timestamp;
  const smoothing = 1 - Math.exp(-elapsed / 105);
  yaw += (targetYaw - yaw) * smoothing;
  pitch += (targetPitch - pitch) * smoothing;
  revealAmount += (targetReveal - revealAmount) * smoothing;
  pointerWorld.lerp(pointerTarget, smoothing);
  modelPivot.rotation.set(pitch, yaw, 0);
  const profileAmount = clamp(Math.abs(yaw - FRONTAL_YAW) / MAX_YAW);
  const rimStrength = smoothstep(0.75, 1, profileAmount) * 1.8;
  for (const uniform of rimStrengthUniforms) uniform.value = rimStrength;
  for (const material of revealMaterials) {
    material.uniforms.uPointer.value.copy(pointerWorld);
    material.uniforms.uReveal.value = revealAmount;
  }
  updateMaterialProgress();
  renderer.render(scene, camera);
  if (frame.dataset.sceneState === "loading") {
    frame.dataset.sceneState = "live";
    heroScreen.classList.add("scene-live");
  }
  frame.dataset.modelYaw = yaw.toFixed(4);
  frame.dataset.modelPitch = pitch.toFixed(4);
  frame.dataset.pointerReveal = revealAmount.toFixed(3);
  frame.dataset.studioLightsFixed = String(studioLightsAreFixed());

  const settling = Math.abs(yaw - targetYaw) > 0.001
    || Math.abs(pitch - targetPitch) > 0.001
    || Math.abs(revealAmount - targetReveal) > 0.005
    || pointerWorld.distanceToSquared(pointerTarget) > 0.00001;
  if (settling) queueFrame();
}

function setStaticFallback(message) {
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  canvas.hidden = true;
  heroScreen.classList.remove("scene-live");
  frame.dataset.sceneState = "poster";
  frame.dataset.modelReady = "false";
  status.textContent = message;
}

async function startScene() {
  try {
    if (reducedMotion.matches && !debugMode) {
      frame.dataset.sceneState = "poster";
      frame.dataset.modelReady = "false";
      status.textContent = document.documentElement.lang.startsWith("pt")
        ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
        : "3D scene paused by reduced-motion preference. The static scene and navigation remain available.";
      return;
    }

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, debugMode ? 1 : 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    if (debugMode) {
      scene.background = new THREE.Color(0x000000);
      const whiteLight = new THREE.DirectionalLight(0xffffff, 2.1);
      whiteLight.name = "fixed-white-left-light";
      whiteLight.position.set(-4, 2, 5);
      addStudioLight(whiteLight);
      const redLight = new THREE.DirectionalLight(0xf02a3a, 2.4);
      redLight.name = "fixed-red-right-light";
      redLight.position.set(4, 1.5, 4);
      addStudioLight(redLight);
    } else {
      // The studio rig stays in scene space; pointer input rotates only modelPivot.
      addStudioLight(new THREE.HemisphereLight(0xe7e8eb, 0x101114, 0.45));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(-2.8, 3.4, -3.8);
      addStudioLight(key);
      const fill = new THREE.DirectionalLight(0xbec2cd, 0.22);
      fill.position.set(-3.8, 0.7, 1.5);
      addStudioLight(fill);
      const rim = new THREE.DirectionalLight(0xf02a3a, 1.3);
      rim.position.set(6.2, 1.7, 3.2);
      addStudioLight(rim);
    }
    frame.dataset.studioLightCount = String(studioLights.length);
    scene.add(modelPivot);
    if (debugMode) modelPivot.position.y = FLOOR_Y;

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync("/assets/models/chess-knight-006-web.glb");
    const source = gltf.scene;
    gltf.scene.updateMatrixWorld(true);
    const world = source.matrixWorld.clone();
    knight = source.clone(true);
    world.decompose(knight.position, knight.quaternion, knight.scale);
    const bounds = new THREE.Box3().setFromObject(knight);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const modelScale = BASE_MODEL_SIZE * MODEL_SCALE_FACTOR / Math.max(size.x, size.y, size.z);
    const scaledHeight = size.y * modelScale;
    knight.position.sub(center).multiplyScalar(modelScale);
    knight.position.y += scaledHeight / 2;
    knight.scale.multiplyScalar(modelScale);
    modelPivot.add(knight);
    trackingCenterLocal.copy(findTrackingCenter(knight));
    await prepareKnight(knight);

    if (!debugMode) {
      reflectiveFloor = new Reflector(new THREE.PlaneGeometry(8, 8), {
        clipBias: 0.003,
        textureWidth: 720,
        textureHeight: 480,
        color: 0x898a90,
        multisample: 0,
      });
      reflectiveFloor.rotation.x = -Math.PI / 2;
      reflectiveFloor.position.y = FLOOR_Y;
      const renderReflectionWithoutWireOverlay = reflectiveFloor.onBeforeRender;
      reflectiveFloor.onBeforeRender = function (...args) {
        for (const wireframe of wireframes) wireframe.visible = false;
        try {
          renderReflectionWithoutWireOverlay.apply(this, args);
        } finally {
          for (const wireframe of wireframes) wireframe.visible = true;
        }
      };
      scene.add(reflectiveFloor);
    }

    poster.hidden = debugMode;
    fallback.hidden = debugMode;
    canvas.hidden = reducedMotion.matches && !debugMode;
    frame.dataset.modelReady = "true";
    frame.dataset.sceneState = reducedMotion.matches && !debugMode ? "poster" : "loading";
    frame.dataset.modelSource = "chess-knight-006-cc-by-4.0";
    frame.dataset.modelScale = MODEL_SCALE_FACTOR.toFixed(2);
    status.textContent = reducedMotion.matches && !debugMode
      ? document.documentElement.lang.startsWith("pt")
        ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
        : "3D scene paused by reduced-motion preference. The static scene and navigation remain available."
      : document.documentElement.lang.startsWith("pt")
        ? "Cena 3D ativa. O movimento do ponteiro é opcional; projetos e navegação permanecem disponíveis."
        : "3D scene active. Pointer movement is optional; projects and navigation remain available.";
    resizeScene();
    updateSceneProgress();
    queueFrame();
  } catch (error) {
    console.error("Portfolio hero scene unavailable; keeping static model preview.", error);
    setStaticFallback(document.documentElement.lang.startsWith("pt")
      ? "Cena 3D indisponível. O modelo estático, o conteúdo e a navegação continuam disponíveis."
      : "3D scene unavailable. The static model, content, and navigation remain available.");
  }
}

frame.addEventListener("pointermove", pointerMove);
frame.addEventListener("pointerleave", pointerLeave);
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setStaticFallback("A cena 3D foi pausada; o modelo estático e a navegação continuam disponíveis.");
});
if (!debugMode) window.addEventListener("scroll", updateSceneProgress, { passive: true });
window.addEventListener("resize", resizeScene, { passive: true });
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    pointerLeave();
    yaw = RESTING_LEFT_YAW;
    pitch = RESTING_PITCH;
    targetYaw = RESTING_LEFT_YAW;
    targetPitch = RESTING_PITCH;
    revealAmount = 0;
    targetReveal = 0;
    pointerWorld.set(0, 0, 0);
    pointerTarget.set(0, 0, 0);
    modelPivot.rotation.set(RESTING_PITCH, RESTING_LEFT_YAW, 0);
    for (const material of revealMaterials) material.uniforms.uReveal.value = 0;
    frame.dataset.modelYaw = yaw.toFixed(4);
    frame.dataset.modelPitch = pitch.toFixed(4);
    frame.dataset.pointerReveal = "0.000";
    canvas.hidden = !debugMode;
    if (debugMode) {
      heroScreen.classList.add("scene-live");
      frame.dataset.sceneState = "live";
    } else {
      heroScreen.classList.remove("scene-live");
      frame.dataset.sceneState = "poster";
    }
    status.textContent = document.documentElement.lang.startsWith("pt")
      ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
      : "3D scene paused by reduced-motion preference. The static scene and navigation remain available.";
  } else if (renderer && knight) {
    canvas.hidden = false;
    frame.dataset.sceneState = "loading";
    status.textContent = document.documentElement.lang.startsWith("pt")
      ? "Cena 3D ativa. O movimento do ponteiro é opcional; projetos e navegação permanecem disponíveis."
      : "3D scene active. Pointer movement is optional; projects and navigation remain available.";
  } else if (!renderer) {
    startScene();
  }
  updateSceneProgress();
  queueFrame();
});
mobileViewport.addEventListener("change", () => {
  if (mobileViewport.matches && !debugMode) pointerLeave();
});
new IntersectionObserver(([entry]) => {
  sceneVisible = entry.isIntersecting;
  if (sceneVisible) queueFrame();
}).observe(frame);

if (reducedMotion.matches) track.dataset.motion = "reduced";
startScene();
