import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSeededRandom } from "../shared/random.js";

const CHUNK_COUNT = 32;
const FRAGMENT_SEED = 0x4b4e3036;
const STRUCTURAL_LOCK_TIME = 1.77;
const CHUNK_GLTF_URL = "/assets/models/chess-knight-006-volumetric-32.glb";

function randomUnitVector(random) {
  const value = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
  return value.lengthSq() > 0.001 ? value.normalize() : new THREE.Vector3(1, 0, 0);
}

function createChunkMotion(chunk, bounds, random) {
  const axis = randomUnitVector(random);
  const angle = (Math.PI / 2 + random() * Math.PI / 2) * (random() < 0.5 ? -1 : 1);
  const height = Math.max(0.001, bounds.max.y - bounds.min.y);
  const distance = height * (1.12 + random() * 0.72);
  const screenAngle = random() * Math.PI * 2;
  const screenRadius = height * (0.22 + random() * 0.46);
  const depth = Math.sqrt(Math.max(0, distance * distance - screenRadius * screenRadius))
    * (random() < 0.5 ? -1 : 1);
  const offset = new THREE.Vector3(
    Math.cos(screenAngle) * screenRadius,
    Math.sin(screenAngle) * screenRadius,
    depth,
  );
  const normalizedY = (chunk.center.y - bounds.min.y) / height;
  const timingJitter = random();
  let groupStart;
  if (normalizedY < 0.23) groupStart = 1.07;
  else if (normalizedY < 0.49) groupStart = 1.11;
  else if (normalizedY < 0.76) groupStart = 1.14;
  else groupStart = 1.17;
  const startTime = groupStart + timingJitter * 0.08;
  const duration = STRUCTURAL_LOCK_TIME - startTime;

  return {
    axisAngle: new THREE.Vector4(axis.x, axis.y, axis.z, angle),
    offset,
    startTime,
    duration,
  };
}

function fillAttribute(count, vector, itemSize) {
  const values = new Float32Array(count * itemSize);
  for (let index = 0; index < count; index++) {
    for (let component = 0; component < itemSize; component++) {
      values[index * itemSize + component] = vector[component];
    }
  }
  return values;
}

function attachFragmentAttributes(geometry, chunk, motion, isCut) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("aFragCenter", new THREE.Float32BufferAttribute(fillAttribute(count, chunk.center.toArray(), 3), 3));
  geometry.setAttribute("aFragAxisAngle", new THREE.Float32BufferAttribute(fillAttribute(count, motion.axisAngle.toArray(), 4), 4));
  geometry.setAttribute("aFragOffset", new THREE.Float32BufferAttribute(fillAttribute(count, motion.offset.toArray(), 3), 3));
  geometry.setAttribute("aFragDelay", new THREE.Float32BufferAttribute(fillAttribute(count, [motion.startTime], 1), 1));
  geometry.setAttribute("aFragDuration", new THREE.Float32BufferAttribute(fillAttribute(count, [motion.duration], 1), 1));
  geometry.setAttribute("aFragCut", new THREE.Uint8BufferAttribute(new Uint8Array(count).fill(isCut ? 255 : 0), 1, true));
  return geometry;
}

function createObsidianMaterial(ctx, bounds) {
  const material = new THREE.MeshStandardMaterial({
    color: "#121418",
    metalness: 0.32,
    roughness: 0.36,
    flatShading: true,
  });
  const rimStrength = { value: 0.85 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAssembly = ctx.assemblyUniform;
    shader.uniforms.uMotionTime = ctx.assemblyTimeUniform;
    shader.uniforms.uModelMinY = { value: bounds.min.y };
    shader.uniforms.uModelHeight = { value: Math.max(0.001, bounds.max.y - bounds.min.y) };
    shader.uniforms.uRimAssembly = ctx.rimAssemblyUniform;
    shader.uniforms.uFacetReveal = ctx.facetRevealUniform;
    shader.uniforms.uRimStrength = rimStrength;
    shader.uniforms.uRedRimColor = { value: new THREE.Color("#ff1230") };
    shader.uniforms.uWhiteRimColor = { value: new THREE.Color("#e6e9ef") };

    const fragmentFunctions = `
      attribute vec3 aFragCenter;
      attribute vec4 aFragAxisAngle;
      attribute vec3 aFragOffset;
      attribute float aFragDelay;
      attribute float aFragDuration;
      attribute float aFragCut;
      uniform float uAssembly;
      uniform float uMotionTime;
      uniform float uModelHeight;
      varying float vFragCut;
      varying float vFragCenterY;
      vec3 rotateFragmentVector(vec3 value, vec3 axis, float angle) {
        float cosine = cos(angle);
        float sine = sin(angle);
        return value * cosine + cross(axis, value) * sine
          + axis * dot(axis, value) * (1.0 - cosine);
      }
      float fragmentProgress() {
        float rawProgress = clamp((uMotionTime - aFragDelay) / max(0.001, aFragDuration), 0.0, 1.0);
        float approach = smoothstep(0.0, 0.84, rawProgress) * 0.96;
        float synchronizedSeat = smoothstep(0.91, 1.0, rawProgress) * 0.04;
        return approach + synchronizedSeat;
      }
      float rawMatterMotion(float progress) {
        float rawWindow = smoothstep(0.50, 0.57, uMotionTime)
          * (1.0 - smoothstep(1.02, 1.20, uMotionTime));
        return rawWindow * (1.0 - progress);
      }
      // This impulse reaches exact zero before the approved 1.85 s mesh handoff.
      float lockSettleMotion() {
        float elapsed = max(0.0, uMotionTime - 1.77);
        float envelope = 1.0 - smoothstep(0.055, 0.08, elapsed);
        return sin(elapsed * 22.0) * exp(-elapsed * 22.0) * envelope;
      }
      vec3 fragmentDriftAxis(vec3 axis) {
        vec3 driftAxis = cross(normalize(aFragOffset), axis);
        if (dot(driftAxis, driftAxis) < 0.001) {
          driftAxis = cross(normalize(aFragOffset), vec3(0.0, 1.0, 0.0));
        }
        return normalize(driftAxis);
      }
      float fragmentPhase() {
        return aFragDelay * 4.7 + aFragAxisAngle.w * 1.8
          + dot(aFragCenter, vec3(6.1, 3.7, 8.9));
      }
      vec3 deformFragmentPosition(vec3 sourcePosition) {
        float progress = fragmentProgress();
        float amount = 1.0 - progress;
        vec3 axis = normalize(aFragAxisAngle.xyz);
        float rawMotion = rawMatterMotion(progress);
        float phase = fragmentPhase();
        float spin = sin(uMotionTime * 2.35 + phase) * 0.035 * rawMotion;
        float settle = lockSettleMotion();
        float angle = aFragAxisAngle.w * amount + spin;
        vec3 rotated = rotateFragmentVector(
          sourcePosition - aFragCenter,
          axis,
          angle
        );
        vec3 driftAxis = fragmentDriftAxis(axis);
        vec3 driftCrossAxis = normalize(cross(normalize(aFragOffset), driftAxis));
        float driftTime = uMotionTime * (2.15 + abs(aFragAxisAngle.w) * 0.18) + phase;
        vec3 idleDrift = (driftAxis * sin(driftTime)
          + driftCrossAxis * cos(driftTime * 0.73 + phase * 0.41) * 0.42)
          * length(aFragOffset) * 0.014 * rawMotion;
        vec3 assemblyArc = driftAxis * length(aFragOffset) * 0.055
          * sin(progress * 3.14159265);
        vec3 settleOffset = vec3(0.0, -0.012, 0.003) * uModelHeight * settle;
        return aFragCenter + rotated + aFragOffset * amount + assemblyArc + idleDrift + settleOffset;
      }
      vec3 deformFragmentNormal(vec3 sourceNormal) {
        float progress = fragmentProgress();
        float amount = 1.0 - progress;
        float rawMotion = rawMatterMotion(progress);
        float spin = sin(uMotionTime * 2.35 + fragmentPhase()) * 0.035 * rawMotion;
        return normalize(rotateFragmentVector(
          sourceNormal,
          normalize(aFragAxisAngle.xyz),
          aFragAxisAngle.w * amount + spin
        ));
      }
    `;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\n${fragmentFunctions}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\nobjectNormal = deformFragmentNormal(objectNormal);",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = deformFragmentPosition(position);
      vFragCut = aFragCut;
      vFragCenterY = aFragCenter.y;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      uniform float uRimAssembly;
      uniform float uFacetReveal;
      uniform float uAssembly;
      uniform float uMotionTime;
      uniform float uModelMinY;
      uniform float uModelHeight;
      uniform float uRimStrength;
      uniform vec3 uRedRimColor;
      uniform vec3 uWhiteRimColor;
      varying float vFragCut;
      varying float vFragCenterY;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float cutMask = clamp(vFragCut, 0.0, 1.0);
      float rimEdge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      float rim = smoothstep(0.76, 0.94, rimEdge);
      vec3 worldRightInView = normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0));
      float worldSide = dot(normalize(normal), worldRightInView);
      float redSideMask = smoothstep(0.05, 0.45, worldSide);
      float whiteSideMask = smoothstep(0.05, 0.45, -worldSide);
      float normalizedFragmentY = clamp((vFragCenterY - uModelMinY) / uModelHeight, 0.0, 1.0);
      float lockProgress = smoothstep(1.76, 1.84, uMotionTime);
      float lockEnvelope = smoothstep(1.75, 1.78, uMotionTime)
        * (1.0 - smoothstep(1.82, 1.85, uMotionTime));
      float lockBand = exp(-pow((normalizedFragmentY - lockProgress) / 0.035, 2.0)) * lockEnvelope;
      float faceLight = max(0.0, dot(normalize(normal), vec3(0.0, 0.0, 1.0)));
      vec3 preRevealFill = vec3(0.003, 0.0035, 0.004)
        + vec3(0.012, 0.013, 0.015) * faceLight * smoothstep(0.0, 1.0, uAssembly);
      vec3 cutFill = vec3(0.004, 0.005, 0.007)
        + vec3(0.016, 0.018, 0.022) * faceLight;
      float faceReveal = uFacetReveal;
      outgoingLight = mix(preRevealFill, outgoingLight, faceReveal);
      outgoingLight = mix(outgoingLight, cutFill, cutMask);
      outgoingLight += rim * uRedRimColor * redSideMask
        * uRimAssembly * uRimStrength * (1.0 - cutMask);
      outgoingLight += rim * uRedRimColor * redSideMask
        * lockBand * 0.78 * (1.0 - cutMask);
      outgoingLight += rim * uWhiteRimColor * whiteSideMask
        * uFacetReveal * 0.85 * (1.0 - cutMask);
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => "home-knight-closed-volumetric-assembly-v4";
  ctx.rimStrengthUniforms.push(rimStrength);
  return material;
}

export async function prepareVolumetricKnight(ctx, root) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(CHUNK_GLTF_URL);
  if (ctx.disposed) {
    gltf.scene.traverse((object) => {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material?.dispose();
      }
    });
    return;
  }

  gltf.scene.updateMatrixWorld(true);
  const chunkParts = Array.from({ length: CHUNK_COUNT }, (_, id) => ({
    id,
    parts: [],
    bounds: new THREE.Box3(),
  }));
  let sourceTriangles = 0;

  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const match = /^fragment_(\d{2})_(exterior|cut)$/.exec(object.name);
    if (!match) return;
    const chunk = chunkParts[Number(match[1])];
    if (!chunk) throw new Error(`Unexpected volumetric fragment id in ${object.name}`);

    const isCut = match[2] === "cut";
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position") geometry.deleteAttribute(name);
    }
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    chunk.bounds.union(geometry.boundingBox);
    sourceTriangles += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
    chunk.parts.push({ geometry, isCut });
  });

  const validChunks = chunkParts.filter((chunk) => chunk.parts.length > 0);
  if (validChunks.length !== CHUNK_COUNT || chunkParts.some((chunk) => chunk.parts.length !== 2)) {
    throw new Error(`Expected ${CHUNK_COUNT} closed chunks with exterior and cut surfaces; received ${validChunks.length}.`);
  }

  const bounds = new THREE.Box3();
  for (const chunk of chunkParts) bounds.union(chunk.bounds);
  const random = createSeededRandom(FRAGMENT_SEED);
  const geometries = [];
  const motionByChunk = new Map();

  for (const chunk of chunkParts) {
    const center = chunk.bounds.getCenter(new THREE.Vector3());
    const motion = createChunkMotion({ id: chunk.id, center }, bounds, random);
    motionByChunk.set(chunk.id, motion);
    for (const part of chunk.parts) {
      geometries.push(attachFragmentAttributes(part.geometry, { center }, motion, part.isCut));
    }
  }

  const geometry = mergeGeometries(geometries, false);
  if (!geometry) {
    geometries.forEach((part) => part.dispose());
    throw new Error("Three.js could not merge the offline volumetric fragment buffers.");
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  for (const part of geometries) part.dispose();

  const mesh = new THREE.Mesh(geometry, createObsidianMaterial(ctx, bounds));
  mesh.name = "Chess Knight 006 — 32 closed volumetric chunks";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const originalMeshes = [];
  const originalLines = [];
  root.traverse((object) => {
    if (object.isMesh) originalMeshes.push(object);
    if (object.isLineSegments) originalLines.push(object);
  });
  ctx.renderer.compile(ctx.scene, ctx.camera);
  const warmTarget = new THREE.WebGLRenderTarget(1, 1);
  const previousTarget = ctx.renderer.getRenderTarget();
  const previousViewport = ctx.renderer.getViewport(new THREE.Vector4());
  const previousScissor = ctx.renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = ctx.renderer.getScissorTest();
  try {
    ctx.renderer.setRenderTarget(warmTarget);
    ctx.renderer.render(ctx.scene, ctx.camera);
  } finally {
    ctx.renderer.setRenderTarget(previousTarget);
    ctx.renderer.setViewport(previousViewport);
    ctx.renderer.setScissor(previousScissor);
    ctx.renderer.setScissorTest(previousScissorTest);
    warmTarget.dispose();
  }
  for (const object of originalMeshes) object.visible = false;
  root.add(mesh);
  ctx.volumetricMesh = mesh;
  ctx.volumetricBaseMeshes = originalMeshes;
  ctx.volumetricBaseLines = originalLines;
  ctx.fragmentStats = {
    chunkCount: CHUNK_COUNT,
    sourceTriangles,
    mergedVertices: geometry.getAttribute("position").count,
    cutTriangles: chunkParts.reduce((sum, chunk) => sum + chunk.parts
      .filter((part) => part.isCut)
      .reduce((partSum, part) => partSum + (part.geometry.index?.count ?? part.geometry.getAttribute("position").count) / 3, 0), 0),
    rotationsDegrees: [...motionByChunk.values()].map(({ axisAngle }) => THREE.MathUtils.radToDeg(Math.abs(axisAngle.w))),
    scatterRadiiHeightRatio: [...motionByChunk.values()].map(({ offset }) => offset.length() / Math.max(0.001, bounds.max.y - bounds.min.y)),
  };
  ctx.frame.dataset.fragmentChunks = String(CHUNK_COUNT);
  ctx.frame.dataset.fragmentTriangles = String(sourceTriangles);
  ctx.frame.dataset.fragmentVertices = String(ctx.fragmentStats.mergedVertices);
  ctx.frame.dataset.fragmentCutTriangles = String(ctx.fragmentStats.cutTriangles);
  ctx.frame.dataset.fragmentAsset = CHUNK_GLTF_URL;
  ctx.frame.dataset.fragmentStructuralLockTime = STRUCTURAL_LOCK_TIME.toFixed(3);
  ctx.frame.dataset.fragmentLockChunks = chunkParts.map((chunk) => chunk.id).join(",");
  ctx.frame.dataset.fragmentLockArrivals = chunkParts
    .map(({ id }) => (motionByChunk.get(id).startTime + motionByChunk.get(id).duration).toFixed(3))
    .join(",");
  ctx.frame.dataset.fragmentArrivalTimes = [...motionByChunk.entries()]
    .map(([id, motion]) => `${id}:${(motion.startTime + motion.duration).toFixed(3)}`)
    .join(",");
}
