import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { createSpatialEnvironment } from "./home-environment-scene.js?v=mobile-compose-1";
import { homeEnvironment } from "./home-environment.js?v=mobile-compose-1";
import { mobileViewport, revealMobileCopy, updateMobileProgress } from "./home-mobile.js?v=mobile-compose-1";

const frame = document.querySelector("#scene-frame");
const canvas = document.querySelector("#scene-canvas");
const fallback = document.querySelector("#scene-fallback");
const track = document.querySelector("#hero-track");
const heroScreen = document.querySelector(".hero-screen");
const heroCopy = document.querySelector(".hero-copy");
const status = document.querySelector("#scene-status");
const stageLabel = document.querySelector("#scene-stage");
const poster = document.querySelector("#hero-poster");
const posterImage = document.querySelector("#hero-poster-image");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
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
let spatialEnvironment;
let frameRequest = 0;
let sceneVisible = true;
// Asset calibration is separate from pointer yaw: zero always faces the camera.
const FRONTAL_MODEL_YAW = THREE.MathUtils.degToRad(90);
const MAX_YAW = THREE.MathUtils.degToRad(90);
const RESTING_LEFT_YAW = -MAX_YAW;
const MOBILE_RESTING_YAW = THREE.MathUtils.degToRad(-68);
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

const LOW_POLY_FACET_VERTEX_BUDGET = 1100;
const EDGE_THRESHOLD_ANGLE_DEG = 24;
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

function activeSceneDescription() {
  const portuguese = document.documentElement.lang.startsWith("pt");
  if (mobileViewport.matches && !debugMode) {
    return portuguese
      ? "Cena 3D ativa. O cavalo permanece em pose fixa enquanto o ambiente acompanha a rolagem."
      : "3D scene active. The knight stays fixed while the environment follows scrolling.";
  }
  return portuguese
    ? "Cena 3D ativa. O movimento do ponteiro é opcional; projetos e navegação permanecem disponíveis."
    : "3D scene active. Pointer movement is optional; projects and navigation remain available.";
}

function updateSceneProgress() {
  if (debugMode || reducedMotion.matches) return;
  if (mobileViewport.matches) {
    updateMobileProgress();
    queueFrame();
    return;
  }
  const extent = Math.max(1, track.offsetHeight - innerHeight);
  progress = clamp(-track.getBoundingClientRect().top / extent);
  const stage = Math.min(stageNames.length - 1, Math.floor(progress * stageNames.length));
  track.dataset.stage = String(stage);
  frame.dataset.progress = progress.toFixed(3);
  stageLabel.textContent = `${String(stage + 1).padStart(2, "0")} / ${stageNames[stage]}`;
  const stagePhases = ["idea", "structure", "form"];
  homeEnvironment?.setPhase?.(stagePhases[stage] || "structure");
  queueFrame();
}

function createRevealMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointer: { value: new THREE.Vector3() },
      uReveal: { value: 0 },
      uBaseOpacity: { value: 0.11 },
      uRestingColor: { value: new THREE.Color("#7e848e") },
      uRevealColor: { value: new THREE.Color("#a8adb4") },
      uAccentColor: { value: new THREE.Color("#e62035") },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vec4 viewPosition = viewMatrix * worldPosition;
        viewPosition.xyz += normalize(-viewPosition.xyz) * 0.0012;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uPointer;
      uniform float uReveal;
      uniform float uBaseOpacity;
      uniform vec3 uRestingColor;
      uniform vec3 uRevealColor;
      uniform vec3 uAccentColor;
      varying vec3 vWorldPosition;
      void main() {
        float distanceToPointer = distance(vWorldPosition, uPointer);
        float falloff = 1.0 - smoothstep(0.04, 0.32, distanceToPointer);
        float localizedReveal = falloff * uReveal;
        float alpha = uBaseOpacity + localizedReveal * (0.50 - uBaseOpacity);
        if (alpha < 0.015) discard;
        vec3 color = mix(uRestingColor, mix(uRevealColor, uAccentColor, 0.40), localizedReveal);
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

function createSilhouetteMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWhite: { value: new THREE.Color("#e6e9ef") },
      uRed: { value: new THREE.Color("#ff1230") },
    },
    vertexShader: `
      varying float vWorldSide;
      void main() {
        vec3 viewNormal = normalize(normalMatrix * normal);
        vWorldSide = dot(viewNormal, normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0)));
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        viewPosition.xyz += viewNormal * 0.006;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uWhite;
      uniform vec3 uRed;
      varying float vWorldSide;
      void main() {
        vec3 color = uWhite * smoothstep(0.05, 0.45, -vWorldSide)
          + uRed * smoothstep(0.05, 0.45, vWorldSide);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

async function prepareKnight(root) {
  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });
  const simplifier = new SimplifyModifier();

  for (const mesh of meshes) {
    const wireSource = mesh.geometry.clone();
    wireSource.deleteAttribute("normal");
    wireSource.deleteAttribute("uv");
    const vertexCount = wireSource.getAttribute("position").count;
    const targetVertices = Math.min(LOW_POLY_FACET_VERTEX_BUDGET, Math.max(400, Math.floor(vertexCount * 0.02)));
    let lowPolyGeometry = wireSource;

    if (vertexCount > targetVertices) {
      lowPolyGeometry = await simplifier.modify(wireSource, vertexCount - targetVertices);
      wireSource.dispose();
    }
    lowPolyGeometry.computeVertexNormals();

    // The base sculpture receives the low-poly faceted geometry with flatShading
    // so individual polygon planes define the horse through lighting.
    mesh.geometry.dispose();
    mesh.geometry = lowPolyGeometry;

    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sources.map(() => {
      const material = new THREE.MeshStandardMaterial({
        color: "#121418",
        metalness: 0.32,
        roughness: 0.36,
        flatShading: true,
      });
      const rimStrength = { value: 0 };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uRedRimColor = { value: new THREE.Color("#ff1230") };
        shader.uniforms.uWhiteRimColor = { value: new THREE.Color("#e6e9ef") };
        shader.uniforms.uRimStrength = rimStrength;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `#include <common>
          uniform vec3 uRedRimColor;
          uniform vec3 uWhiteRimColor;
          uniform float uRimStrength;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float rimEdge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
          float rim = smoothstep(0.76, 0.94, rimEdge);
          vec3 worldRightInView = normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0));
          float worldSide = dot(normalize(normal), worldRightInView);
          float redSideMask = smoothstep(0.05, 0.45, worldSide);
          float whiteSideMask = smoothstep(0.05, 0.45, -worldSide);
          // Preserve 70-80% dark mass while allowing frontal fill light to reveal facet planes
          outgoingLight = outgoingLight * mix(0.85, 1.0, rim);
          outgoingLight += rim * (uRedRimColor * redSideMask * uRimStrength
            + uWhiteRimColor * whiteSideMask * 0.85);
          #include <opaque_fragment>`,
        );
      };
      material.customProgramCacheKey = () => "knight-two-sided-silhouette-rim-v4";
      rimStrengthUniforms.push(rimStrength);
      return material;
    });
    surfaceMaterials.push(...materials);
    sources.forEach((material) => material.dispose());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];

    // The opaque body occludes this thin shell, leaving only its outer contour.
    const silhouette = new THREE.Mesh(lowPolyGeometry, createSilhouetteMaterial());
    silhouette.renderOrder = -1;
    silhouette.raycast = () => {};
    mesh.add(silhouette);

    if (debugMode) continue;

    // Use selective EdgesGeometry (~24 deg threshold) instead of full WireframeGeometry.
    // Suppresses 60-80% of internal triangulation lines, keeping only meaningful structural creases:
    // silhouette contours, cheek/jaw transitions, neck contours, selected mane blocks, chest, pedestal edges.
    const edgeGeometry = new THREE.EdgesGeometry(lowPolyGeometry, EDGE_THRESHOLD_ANGLE_DEG);
    const wireframe = new THREE.LineSegments(edgeGeometry, createRevealMaterial());
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
  trackingRestQuaternion.setFromAxisAngle(verticalAxis, FRONTAL_MODEL_YAW);
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
  if (event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    pointerLeave();
    return;
  }
  const center = projectTrackingCenter();
  if (!bounds.width || !bounds.height || !center) return;

  const dx = event.clientX - center.x;
  const horizontalSideDistance = dx < 0 ? center.x - bounds.left : bounds.right - center.x;
  const normalizedX = clamp(dx / Math.max(1, horizontalSideDistance), -1, 1);
  const trackingX = clamp(normalizedX / TRACKING_FULL_TILT_AT, -1, 1);
  const dy = event.clientY - center.y;
  const verticalSideDistance = dy < 0 ? center.y - bounds.top : bounds.bottom - center.y;
  const normalizedY = clamp(dy / Math.max(1, verticalSideDistance), -1, 1);
  const trackingY = clamp(normalizedY / TRACKING_FULL_TILT_AT, -1, 1);
  targetYaw = trackingX * MAX_YAW;
  targetPitch = trackingY < 0
    ? trackingY * LOOK_UP_LIMIT
    : trackingY * LOOK_DOWN_LIMIT;
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
  targetYaw = mobileViewport.matches && !debugMode ? MOBILE_RESTING_YAW : RESTING_LEFT_YAW;
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
  const isMobile = mobileViewport.matches && !debugMode;
  const maxPixelRatio = Math.sqrt((isMobile ? 650_000 : 1_800_000) / (width * height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5, maxPixelRatio);
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio), false);
  camera.aspect = width / height;
  camera.position.set(0, isMobile ? 0.1 : 0.12, isMobile ? 3.5 : 4.55);
  camera.lookAt(0, isMobile ? -0.17 : -0.2, 0);
  camera.updateProjectionMatrix();
  if (reflectiveFloor) {
    const target = reflectiveFloor.getRenderTarget();
    target.setSize(isMobile ? 320 : 720, isMobile ? 320 : 480);
    reflectiveFloor.material.uniforms.color.value.set(isMobile ? 0x73747a : 0x898a90);
    reflectiveFloor.material.uniforms.uMobileBlur.value = isMobile ? 1.25 : 0;
    reflectiveFloor.material.uniforms.uReflectionTexel.value.set(1 / target.width, 1 / target.height);
  }
  frame.dataset.poseMode = isMobile ? "static-mobile" : "pointer-desktop";
  if (!reducedMotion.matches) status.textContent = activeSceneDescription();
  frame.dataset.bufferWidth = String(canvas.width);
  frame.dataset.bufferHeight = String(canvas.height);
  updateSceneProgress();
  queueFrame();
}

function updateMaterialProgress() {
  if (debugMode) return;
  if (mobileViewport.matches) {
    modelPivot.scale.setScalar(1);
    modelPivot.position.y = FLOOR_Y;
    for (const material of surfaceMaterials) {
      material.metalness = 0.32;
      material.roughness = 0.36;
    }
    return;
  }
  const polish = smoothstep(0.42, 0.92, progress);
  for (const material of surfaceMaterials) {
    material.metalness = 0.28 + polish * 0.18;
    material.roughness = 0.40 - polish * 0.08;
  }
  // Narrative progression across stages:
  // IDEA: construction edges (~0.18 opacity)
  // STRUCTURE: balanced wireframe supporting sculptural facets (~0.11 opacity)
  // FORM: polished faceted sculpture, minimal wireframe (~0.04 opacity)
  const scrollWireframeOpacity = THREE.MathUtils.lerp(0.18, 0.04, progress);
  for (const material of revealMaterials) {
    material.uniforms.uBaseOpacity.value = scrollWireframeOpacity;
  }
  modelPivot.scale.setScalar(1 + progress * 0.025);
  modelPivot.position.y = FLOOR_Y + progress * 0.045;
}

function renderFrame(timestamp) {
  frameRequest = 0;
  if (!renderer || !knight || !sceneVisible) return;
  if (mobileViewport.matches && !debugMode) {
    const copyBounds = heroCopy.getBoundingClientRect();
    const sceneBounds = frame.getBoundingClientRect();
    if (copyBounds.top <= sceneBounds.top && copyBounds.right > sceneBounds.left + 1) {
      lastFrameAt = 0;
      return;
    }
  }
  const elapsed = lastFrameAt ? Math.min(80, timestamp - lastFrameAt) : 16;
  lastFrameAt = timestamp;
  const smoothing = 1 - Math.exp(-elapsed / 105);
  yaw += (targetYaw - yaw) * smoothing;
  pitch += (targetPitch - pitch) * smoothing;
  revealAmount += (targetReveal - revealAmount) * smoothing;
  pointerWorld.lerp(pointerTarget, smoothing);
  if (mobileViewport.matches && !debugMode) {
    yaw = targetYaw = MOBILE_RESTING_YAW;
    pitch = targetPitch = RESTING_PITCH;
    revealAmount = targetReveal = 0;
    pointerWorld.set(0, 0, 0);
  }
  modelPivot.rotation.set(pitch, FRONTAL_MODEL_YAW + yaw, 0);
  const profileAmount = clamp(Math.abs(yaw) / MAX_YAW);
  const rimStrength = mobileViewport.matches && !debugMode ? 1.4 : 0.85 + smoothstep(0.6, 1, profileAmount) * 0.55;
  for (const uniform of rimStrengthUniforms) uniform.value = rimStrength;
  for (const material of revealMaterials) {
    material.uniforms.uBaseOpacity.value = mobileViewport.matches && !debugMode ? 0.25 : 0.38;
    material.uniforms.uPointer.value.copy(pointerWorld);
    material.uniforms.uReveal.value = revealAmount;
  }
  updateMaterialProgress();
  if (spatialEnvironment && homeEnvironment) {
    spatialEnvironment.update(timestamp, homeEnvironment);
    homeEnvironment.update(timestamp, elapsed);
    homeEnvironment.setAnchor(projectTrackingCenter(), frame.getBoundingClientRect());
  }
  renderer.render(scene, camera);
  if (frame.dataset.sceneState === "loading") {
    frame.dataset.sceneState = "live";
    heroScreen.classList.add("scene-live");
    revealMobileCopy();
  }
  frame.dataset.modelYaw = yaw.toFixed(4);
  frame.dataset.modelPitch = pitch.toFixed(4);
  frame.dataset.pointerReveal = revealAmount.toFixed(3);
  frame.dataset.studioLightsFixed = String(studioLightsAreFixed());

  const settling = Math.abs(yaw - targetYaw) > 0.001
    || Math.abs(pitch - targetPitch) > 0.001
    || Math.abs(revealAmount - targetReveal) > 0.005
    || pointerWorld.distanceToSquared(pointerTarget) > 0.00001;
  if (settling || (spatialEnvironment && !reducedMotion.matches && sceneVisible)) queueFrame();
}

function setStaticFallback(message) {
  revealMobileCopy();
  homeEnvironment?.setActive(false);
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
    renderer.setClearColor(0x050608, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    scene.background = new THREE.Color(0x050608);
    // Both modes use the same fixed rig and silhouette-only material.
    const whiteLight = new THREE.DirectionalLight(0xffffff, 0.65);
    whiteLight.name = "fixed-white-left-light";
    whiteLight.position.set(-4, 2, 5);
    addStudioLight(whiteLight);
    const redLight = new THREE.DirectionalLight(0xf02a3a, 0.55);
    redLight.name = "fixed-red-right-light";
    redLight.position.set(4, 1.5, 4);
    addStudioLight(redLight);
    // Neutral frontal fill light: broad, soft, positioned front-left-above (-1.0, 2.4, 4.6)
    // Recovers cheek, muzzle, neck, chest, and pedestal facets while keeping deep black shadows
    const fillLight = new THREE.DirectionalLight(0xdbe2ec, 0.85);
    fillLight.name = "fixed-neutral-fill-light";
    fillLight.position.set(-1.0, 2.4, 4.6);
    addStudioLight(fillLight);
    frame.dataset.studioLightCount = String(studioLights.length);
    scene.add(modelPivot);
    modelPivot.position.y = FLOOR_Y;

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
      reflectiveFloor.material.uniforms.uMobileBlur = { value: 0 };
      reflectiveFloor.material.uniforms.uReflectionTexel = { value: new THREE.Vector2(1 / 720, 1 / 480) };
      reflectiveFloor.material.fragmentShader = reflectiveFloor.material.fragmentShader.replace(
        "uniform vec3 color;",
        "uniform vec3 color;\nuniform float uMobileBlur;\nuniform vec2 uReflectionTexel;",
      ).replace("vec4 base = texture2DProj( tDiffuse, vUv );", `
        vec4 base = texture2DProj(tDiffuse, vUv);
        if (uMobileBlur > 0.0) {
          vec2 offset = uReflectionTexel * uMobileBlur * vUv.w;
          base *= 0.4;
          base += texture2DProj(tDiffuse, vUv + vec4(offset.x, 0.0, 0.0, 0.0)) * 0.15;
          base += texture2DProj(tDiffuse, vUv - vec4(offset.x, 0.0, 0.0, 0.0)) * 0.15;
          base += texture2DProj(tDiffuse, vUv + vec4(0.0, offset.y, 0.0, 0.0)) * 0.15;
          base += texture2DProj(tDiffuse, vUv - vec4(0.0, offset.y, 0.0, 0.0)) * 0.15;
        }
      `);
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

    if (!debugMode) {
      spatialEnvironment = createSpatialEnvironment(scene, FLOOR_Y, renderer, camera);
      homeEnvironment?.setActive(true);
    }

    poster.hidden = debugMode;
    fallback.hidden = debugMode;
    canvas.hidden = reducedMotion.matches && !debugMode;
    frame.dataset.modelReady = "true";
    frame.dataset.sceneState = reducedMotion.matches && !debugMode ? "poster" : "loading";
    frame.dataset.modelSource = "chess-knight-006-cc-by-4.0";
    frame.dataset.modelScale = MODEL_SCALE_FACTOR.toFixed(2);
    frame.dataset.wireframeMode = "edges-threshold-24";
    frame.dataset.facetShading = "flat";
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

// The copy overlaps the canvas; listen on their shared parent to avoid dead zones.
heroScreen.addEventListener("pointermove", pointerMove);
heroScreen.addEventListener("pointerleave", pointerLeave);
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setStaticFallback("A cena 3D foi pausada; o modelo estático e a navegação continuam disponíveis.");
});
if (!debugMode) window.addEventListener("scroll", updateSceneProgress, { passive: true });
window.addEventListener("resize", resizeScene, { passive: true });
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    pointerLeave();
    const restingYaw = mobileViewport.matches && !debugMode ? MOBILE_RESTING_YAW : RESTING_LEFT_YAW;
    yaw = restingYaw;
    pitch = RESTING_PITCH;
    targetYaw = restingYaw;
    targetPitch = RESTING_PITCH;
    revealAmount = 0;
    targetReveal = 0;
    pointerWorld.set(0, 0, 0);
    pointerTarget.set(0, 0, 0);
    modelPivot.rotation.set(RESTING_PITCH, FRONTAL_MODEL_YAW + restingYaw, 0);
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
    status.textContent = activeSceneDescription();
  } else if (!renderer) {
    startScene();
  }
  updateSceneProgress();
  queueFrame();
});
mobileViewport.addEventListener("change", () => {
  if (!debugMode) {
    pointerLeave();
    resizeScene();
  }
});
new IntersectionObserver(([entry]) => {
  sceneVisible = entry.isIntersecting;
  if (sceneVisible) queueFrame();
}).observe(frame);

if (reducedMotion.matches) track.dataset.motion = "reduced";
startScene();
