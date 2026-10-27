import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const frame = document.querySelector("#scene-frame");
const canvas = document.querySelector("#scene-canvas");
const fallback = document.querySelector("#scene-fallback");
const track = document.querySelector("#hero-track");
const heroScreen = document.querySelector(".hero-screen");
const status = document.querySelector("#scene-status");
const stageLabel = document.querySelector("#scene-stage");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const pointerQuery = matchMedia("(pointer: fine)");
const stageNames = ["IDEIA", "SISTEMA", "EXECUÇÃO", "IMPACTO"];
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerWorld = new THREE.Vector3();
const pointerTarget = new THREE.Vector3();
const modelPivot = new THREE.Group();
const studioLights = [];
const surfaceMaterials = [];
const wireMaterials = [];
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

const YAW_LIMIT = THREE.MathUtils.degToRad(5);
const PITCH_LIMIT = THREE.MathUtils.degToRad(3);
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
  studioLights.push({ light, position: light.position.clone() });
}

function studioLightsAreFixed() {
  return studioLights.every(({ light, position }) => light.position.equals(position));
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
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uPointer;
      uniform float uReveal;
      varying vec3 vWorldPosition;
      void main() {
        float distanceToPointer = distance(vWorldPosition, uPointer);
        float falloff = 1.0 - smoothstep(0.05, 0.34, distanceToPointer);
        float alpha = falloff * uReveal;
        if (alpha < 0.025) discard;
        gl_FragColor = vec4(0.9, 0.18, 0.25, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function prepareKnight(root) {
  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });

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

    const wire = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
      color: "#c8c9cd",
      wireframe: true,
      transparent: true,
      opacity: 0.004,
      depthWrite: false,
    }));
    wire.renderOrder = 1;
    mesh.add(wire);
    wireMaterials.push(wire.material);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 17), createRevealMaterial());
    edges.renderOrder = 2;
    mesh.add(edges);
    revealMaterials.push(edges.material);
  }
}

function pointerMove(event) {
  if (!renderer || reducedMotion.matches || !pointerQuery.matches || event.pointerType !== "mouse") return;
  if (event.target.closest(".home-header, .hero-actions, .scroll-cue")) {
    pointerLeave();
    return;
  }

  const screenBounds = heroScreen.getBoundingClientRect();
  if (!screenBounds.width || !screenBounds.height) return;
  const screenX = ((event.clientX - screenBounds.left) / screenBounds.width) * 2 - 1;
  const screenY = 1 - ((event.clientY - screenBounds.top) / screenBounds.height) * 2;
  targetYaw = clamp(screenX * YAW_LIMIT, -YAW_LIMIT, YAW_LIMIT);
  targetPitch = clamp(-screenY * PITCH_LIMIT, -PITCH_LIMIT, PITCH_LIMIT);

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
  queueFrame();
}

function pointerLeave() {
  targetYaw = 0;
  targetPitch = 0;
  targetReveal = 0;
  pointerTarget.set(0, 0, 0);
  frame.dataset.pointerHit = "false";
  queueFrame();
}

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
  const structure = Math.sin(progress * Math.PI);
  const polish = smoothstep(0.42, 0.92, progress);
  for (const material of surfaceMaterials) {
    material.metalness = 0.3 + polish * 0.2;
    material.roughness = 0.42 - polish * 0.08;
  }
  for (const material of wireMaterials) material.opacity = 0.003 + structure * 0.012;
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
  fallback.hidden = false;
  frame.dataset.modelReady = "false";
  status.textContent = message;
}

async function startScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    addStudioLight(new THREE.HemisphereLight(0xe7e8eb, 0x101114, 0.86));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(-2.8, 3.4, 4.5);
    addStudioLight(key);
    const fill = new THREE.DirectionalLight(0xbec2cd, 0.46);
    fill.position.set(-3.8, 0.7, 1.5);
    addStudioLight(fill);
    const rim = new THREE.DirectionalLight(0xe02c3b, 2.25);
    rim.position.set(3.3, 1.5, -2.4);
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
    prepareKnight(knight);

    reflectiveFloor = new Reflector(new THREE.PlaneGeometry(8, 8), {
      clipBias: 0.003,
      textureWidth: 720,
      textureHeight: 480,
      color: 0x898a90,
      multisample: 0,
    });
    reflectiveFloor.rotation.x = -Math.PI / 2;
    reflectiveFloor.position.y = FLOOR_Y;
    scene.add(reflectiveFloor);

    canvas.hidden = false;
    fallback.hidden = true;
    frame.dataset.modelReady = "true";
    frame.dataset.modelSource = "chess-knight-006-cc-by-4.0";
    frame.dataset.modelScale = MODEL_SCALE_FACTOR.toFixed(2);
    status.textContent = document.documentElement.lang.startsWith("pt")
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
    modelPivot.rotation.set(0, 0, 0);
    for (const material of revealMaterials) material.uniforms.uReveal.value = 0;
    frame.dataset.modelYaw = "0.0000";
    frame.dataset.modelPitch = "0.0000";
    frame.dataset.pointerReveal = "0.000";
  }
  updateSceneProgress();
  queueFrame();
});
new IntersectionObserver(([entry]) => {
  sceneVisible = entry.isIntersecting;
  if (sceneVisible) queueFrame();
}).observe(frame);

if (reducedMotion.matches) track.dataset.motion = "reduced";
startScene();
