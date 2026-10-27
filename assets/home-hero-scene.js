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
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerWorld = new THREE.Vector3();
const pointerTarget = new THREE.Vector3();
const modelPivot = new THREE.Group();
const trackingAxisLocal = new THREE.Vector3();
const trackingAxisScreen = new THREE.Vector3();
const trackingAxisWorld = new THREE.Vector3();
const trackingRestQuaternion = new THREE.Quaternion();
const trackingRestMatrix = new THREE.Matrix4();
const verticalAxis = new THREE.Vector3(0, 1, 0);
const studioLights = [];
const surfaceMaterials = [];
const wireframes = [];
const revealMaterials = [];
let renderer;
let knight;
let reflectiveFloor;
let frameRequest = 0;
let sceneVisible = true;
let targetYaw = 0;
let targetPitch = 0;
let targetReveal = 0;
let yaw = 0;
let pitch = 0;
let revealAmount = 0;
let progress = 0;
let lastFrameAt = 0;

const REST_YAW = 0;
// The model faces the camera at 90 degrees; the offset range keeps both tracked poses forward-facing.
const TRACKING_CENTER_YAW = THREE.MathUtils.degToRad(90);
const TRACKING_YAW_RANGE = THREE.MathUtils.degToRad(18);
const TRACKING_PITCH_LIMIT = THREE.MathUtils.degToRad(7);
const TRACKING_FULL_TILT_AT = 0.75;
const TRACKING_HEAD_BAND = [0.58, 0.88];
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
  if (reducedMotion.matches) return;
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
      uBaseOpacity: { value: 0.22 },
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
        vec3 color = mix(vec3(0.52, 0.55, 0.60), vec3(0.9, 0.18, 0.25), localizedReveal);
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
    const materials = sources.map(() => new THREE.MeshStandardMaterial({
      color: "#121315",
      metalness: 0.3,
      roughness: 0.42,
    }));
    surfaceMaterials.push(...materials);
    sources.forEach((material) => material.dispose());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];

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

function findTrackingAxis(root, scaledHeight) {
  root.updateMatrixWorld(true);
  modelPivot.updateMatrixWorld(true);
  const pivotInverse = modelPivot.matrixWorld.clone().invert();
  const vertex = new THREE.Vector3();
  const center = new THREE.Vector3();
  const minY = scaledHeight * TRACKING_HEAD_BAND[0];
  const maxY = scaledHeight * TRACKING_HEAD_BAND[1];
  let count = 0;

  root.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry?.getAttribute("position");
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index)
        .applyMatrix4(object.matrixWorld)
        .applyMatrix4(pivotInverse);
      if (vertex.y < minY || vertex.y > maxY) continue;
      center.add(vertex);
      count += 1;
    }
  });

  if (!count) return new THREE.Vector3(0, scaledHeight * 0.72, 0);
  return center.multiplyScalar(1 / count);
}

function projectTrackingAxis() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !knight) return null;
  camera.updateMatrixWorld(true);
  trackingRestQuaternion.setFromAxisAngle(verticalAxis, REST_YAW);
  trackingRestMatrix.compose(modelPivot.position, trackingRestQuaternion, modelPivot.scale);
  trackingAxisWorld.copy(trackingAxisLocal).applyMatrix4(trackingRestMatrix);
  trackingAxisScreen.copy(trackingAxisWorld).project(camera);
  return {
    x: bounds.left + ((trackingAxisScreen.x + 1) / 2) * bounds.width,
    y: bounds.top + ((1 - trackingAxisScreen.y) / 2) * bounds.height,
  };
}

function pointerMove(event) {
  if (!renderer || reducedMotion.matches || mobileViewport.matches || !pointerQuery.matches || event.pointerType !== "mouse") return;
  if (event.target.closest(".home-header, .hero-actions, .scroll-cue")) {
    pointerLeave();
    return;
  }

  const canvasBounds = canvas.getBoundingClientRect();
  if (!canvasBounds.width || !canvasBounds.height) return;
  const axis = projectTrackingAxis();
  if (!axis) return;
  const horizontalSpan = event.clientX < axis.x
    ? Math.max(1, axis.x - canvasBounds.left)
    : Math.max(1, canvasBounds.right - axis.x);
  const verticalSpan = event.clientY < axis.y
    ? Math.max(1, axis.y - canvasBounds.top)
    : Math.max(1, canvasBounds.bottom - axis.y);
  const normalizedX = clamp((event.clientX - axis.x) / horizontalSpan, -1, 1);
  const normalizedY = clamp((event.clientY - axis.y) / verticalSpan, -1, 1);
  const trackingProgress = clamp(normalizedX / TRACKING_FULL_TILT_AT, -1, 1);
  targetYaw = clamp(
    TRACKING_CENTER_YAW + trackingProgress * TRACKING_YAW_RANGE,
    TRACKING_CENTER_YAW - TRACKING_YAW_RANGE,
    TRACKING_CENTER_YAW + TRACKING_YAW_RANGE,
  );
  targetPitch = normalizedY * TRACKING_PITCH_LIMIT;
  frame.dataset.pointerAxisX = axis.x.toFixed(1);
  frame.dataset.pointerAxisY = axis.y.toFixed(1);
  frame.dataset.pointerNormalizedX = normalizedX.toFixed(3);
  frame.dataset.pointerNormalizedY = normalizedY.toFixed(3);

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
  queueFrame();
}

function pointerLeave() {
  targetYaw = REST_YAW;
  targetPitch = 0;
  targetReveal = 0;
  pointerTarget.set(0, 0, 0);
  frame.dataset.pointerHit = "false";
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
  if (mobileViewport.matches) return;
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
    if (reducedMotion.matches) {
      frame.dataset.sceneState = "poster";
      frame.dataset.modelReady = "false";
      status.textContent = document.documentElement.lang.startsWith("pt")
        ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
        : "3D scene paused by reduced-motion preference. The static scene and navigation remain available.";
      return;
    }

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    // The studio rig stays in scene space; pointer input rotates only modelPivot.
    addStudioLight(new THREE.HemisphereLight(0xe7e8eb, 0x101114, 0.86));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(-2.8, 3.4, -3.8);
    addStudioLight(key);
    const fill = new THREE.DirectionalLight(0xbec2cd, 0.46);
    fill.position.set(-3.8, 0.7, 1.5);
    addStudioLight(fill);
    const rim = new THREE.DirectionalLight(0xe02c3b, 3.1);
    // Fixed on the scene's right/back side; never parent this light to the model.
    rim.position.set(3.8, 1.5, -2.4);
    addStudioLight(rim);
    scene.add(modelPivot);

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
    trackingAxisLocal.copy(findTrackingAxis(knight, scaledHeight));
    await prepareKnight(knight);

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

    canvas.hidden = reducedMotion.matches;
    frame.dataset.modelReady = "true";
    frame.dataset.sceneState = reducedMotion.matches ? "poster" : "loading";
    frame.dataset.modelSource = "chess-knight-006-cc-by-4.0";
    frame.dataset.modelScale = MODEL_SCALE_FACTOR.toFixed(2);
    status.textContent = reducedMotion.matches
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

heroScreen.addEventListener("pointermove", pointerMove);
heroScreen.addEventListener("pointerleave", pointerLeave);
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setStaticFallback("A cena 3D foi pausada; o modelo estático e a navegação continuam disponíveis.");
});
window.addEventListener("scroll", updateSceneProgress, { passive: true });
window.addEventListener("resize", resizeScene, { passive: true });
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    pointerLeave();
    yaw = 0;
    pitch = 0;
    targetYaw = 0;
    targetPitch = 0;
    revealAmount = 0;
    targetReveal = 0;
    pointerWorld.set(0, 0, 0);
    pointerTarget.set(0, 0, 0);
    modelPivot.rotation.set(0, REST_YAW, 0);
    for (const material of revealMaterials) material.uniforms.uReveal.value = 0;
    frame.dataset.modelYaw = "0.0000";
    frame.dataset.modelPitch = "0.0000";
    frame.dataset.pointerReveal = "0.000";
    canvas.hidden = true;
    heroScreen.classList.remove("scene-live");
    frame.dataset.sceneState = "poster";
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
  if (mobileViewport.matches) pointerLeave();
});
new IntersectionObserver(([entry]) => {
  sceneVisible = entry.isIntersecting;
  if (sceneVisible) queueFrame();
}).observe(frame);

if (reducedMotion.matches) track.dataset.motion = "reduced";
startScene();
