import * as THREE from "three";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { FLOOR_Y, smoothstep } from "./context.js";
import { createSeededRandom } from "../shared/random.js";
import { ASSEMBLY_DURATION, annotateFragmentEdges, createFragmentedGeometry } from "./fragment-geometry.js";
import { prepareVolumetricKnight } from "./volumetric-assembly.js";

const LOW_POLY_FACET_VERTEX_BUDGET = 1100;
const EDGE_THRESHOLD_ANGLE_DEG = 24;
const FRAGMENT_SEED = 0x484f4d45;
const FRAGMENT_VERTEX_GLSL = `
  attribute float aFragmentId;
  attribute vec3 aFragCenter;
  attribute vec4 aFragAxisAngle;
  attribute float aFragDelay;
  uniform float uAssembly;
  uniform float uFragmentSpread;
  uniform vec3 uFragmentOrigin;
  vec3 rotateFragmentVector(vec3 value, vec3 axis, float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return value * cosine + cross(axis, value) * sine + axis * dot(axis, value) * (1.0 - cosine);
  }
  float fragmentAssemblyProgress() {
    return smoothstep(aFragDelay, aFragDelay + ${ASSEMBLY_DURATION.toFixed(2)}, uAssembly);
  }
  vec3 deformFragmentPosition(vec3 sourcePosition) {
    if (uAssembly >= 1.0) return sourcePosition;
    float progress = fragmentAssemblyProgress();
    float amount = 1.0 - progress;
    vec3 axis = normalize(aFragAxisAngle.xyz);
    vec3 rotated = rotateFragmentVector(sourcePosition - aFragCenter, axis, aFragAxisAngle.w * amount);
    vec3 radial = aFragCenter - uFragmentOrigin;
    if (dot(radial, radial) < 0.0001) radial = axis;
    radial = normalize(radial);
    vec3 escapeDirection = normalize(radial * 0.25 + axis * 0.75);
    float spin = clamp((abs(aFragAxisAngle.w) - 1.5707963) / 1.5707963, 0.0, 1.0);
    float radius = uFragmentSpread * mix(1.0, 1.05, spin);
    return aFragCenter + rotated + escapeDirection * radius * amount;
  }
  vec3 deformFragmentNormal(vec3 sourceNormal) {
    if (uAssembly >= 1.0) return sourceNormal;
    float amount = 1.0 - fragmentAssemblyProgress();
    return normalize(rotateFragmentVector(sourceNormal, normalize(aFragAxisAngle.xyz), aFragAxisAngle.w * amount));
  }
`;

export function createRevealMaterial(ctx) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointer: { value: new THREE.Vector3() },
      uReveal: { value: 0 },
      uBaseOpacity: { value: 0.11 },
      uRestingColor: { value: new THREE.Color("#7e848e") },
      uRevealColor: { value: new THREE.Color("#a8adb4") },
      uAccentColor: { value: new THREE.Color("#e62035") },
      uAssembly: ctx.assemblyUniform,
      uFragmentSpread: ctx.fragmentSpreadUniform,
      uFragmentOrigin: ctx.fragmentOriginUniform,
      uFacetReveal: ctx.facetRevealUniform,
      uRimAssembly: ctx.rimAssemblyUniform,
    },
    vertexShader: `
      ${FRAGMENT_VERTEX_GLSL}
      attribute float aAssemblyEdge;
      varying vec3 vWorldPosition;
      varying float vAssemblyEdge;
      void main() {
        vec3 localPosition = deformFragmentPosition(position);
        vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        vAssemblyEdge = aAssemblyEdge;
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
      uniform float uFacetReveal;
      uniform float uRimAssembly;
      varying vec3 vWorldPosition;
      varying float vAssemblyEdge;
      void main() {
        float distanceToPointer = distance(vWorldPosition, uPointer);
        float falloff = 1.0 - smoothstep(0.04, 0.32, distanceToPointer);
        float localizedReveal = falloff * uReveal;
        float baseAlpha = uBaseOpacity + localizedReveal * (0.50 - uBaseOpacity);
        float assemblyLine = (1.0 - uFacetReveal) * uRimAssembly * vAssemblyEdge;
        float alpha = baseAlpha * uFacetReveal + assemblyLine * 0.72;
        if (alpha < 0.015) discard;
        vec3 baseColor = mix(uRestingColor, mix(uRevealColor, uAccentColor, 0.40), localizedReveal);
        vec3 color = mix(baseColor, uAccentColor, assemblyLine);
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

export function createSilhouetteMaterial(ctx) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWhite: { value: new THREE.Color("#e6e9ef") },
      uRed: { value: new THREE.Color("#ff1230") },
      uAssembly: ctx.assemblyUniform,
      uFragmentSpread: ctx.fragmentSpreadUniform,
      uFragmentOrigin: ctx.fragmentOriginUniform,
      uFacetReveal: ctx.facetRevealUniform,
    },
    vertexShader: `
      ${FRAGMENT_VERTEX_GLSL}
      varying float vWorldSide;
      void main() {
        vec3 localPosition = deformFragmentPosition(position);
        vec3 localNormal = deformFragmentNormal(normal);
        vec3 viewNormal = normalize(normalMatrix * localNormal);
        vWorldSide = dot(viewNormal, normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0)));
        vec4 viewPosition = modelViewMatrix * vec4(localPosition, 1.0);
        viewPosition.xyz += viewNormal * 0.006;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uWhite;
      uniform vec3 uRed;
      uniform float uFacetReveal;
      varying float vWorldSide;
      void main() {
        vec3 color = (uWhite * smoothstep(0.05, 0.45, -vWorldSide)
          + uRed * smoothstep(0.05, 0.45, vWorldSide)) * uFacetReveal;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

export async function prepareKnight(ctx, root, chunkCount = 32) {
  let volumetricMode = ctx.homeCapture?.assemblyMode === "volume"
    || Boolean(ctx.openingController?.usesVolumetricAssembly);
  if (volumetricMode && ctx.mobileViewport.matches) {
    ctx.homeCapture.assemblyMode = null;
    volumetricMode = false;
    ctx.frame.dataset.volumetricAssembly = "suppressed-mobile";
  }

  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });
  const simplifier = new SimplifyModifier();
  const chunkPlans = [];
  let modelHeight = 0;

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

    lowPolyGeometry.computeBoundingBox();
    const origin = lowPolyGeometry.boundingBox.getCenter(new THREE.Vector3());
    const bounds = {
      minY: lowPolyGeometry.boundingBox.min.y,
      maxY: lowPolyGeometry.boundingBox.max.y,
    };
    modelHeight = Math.max(modelHeight, bounds.maxY - bounds.minY);
    ctx.fragmentSpreadUniform.value = Math.max(
      ctx.fragmentSpreadUniform.value,
      modelHeight * 1.05,
    );
    ctx.fragmentOriginUniform.value.copy(origin);
    const fragmentPlan = createFragmentedGeometry(lowPolyGeometry, {
      chunkCount,
      random: createSeededRandom(FRAGMENT_SEED),
      modelBounds: bounds,
    });
    chunkPlans.push(fragmentPlan);
    lowPolyGeometry.dispose();
    lowPolyGeometry = fragmentPlan.geometry;

    // The base sculpture receives the low-poly faceted geometry with flatShading
    // so individual polygon planes define the horse through lighting.
    mesh.geometry.dispose();
    mesh.geometry = lowPolyGeometry;

    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sources.map(() => {
      const material = new THREE.MeshStandardMaterial({
        color: "#0f1114",
        metalness: 0.32,
        roughness: 0.36,
        flatShading: true,
      });
      const rimStrength = { value: 0 };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uVolumetricLockPreview = { value: volumetricMode ? 1 : 0 };
        shader.uniforms.uAssembly = ctx.assemblyUniform;
        shader.uniforms.uFragmentSpread = ctx.fragmentSpreadUniform;
        shader.uniforms.uFragmentOrigin = ctx.fragmentOriginUniform;
        shader.uniforms.uRimAssembly = ctx.rimAssemblyUniform;
        shader.uniforms.uFacetReveal = ctx.facetRevealUniform;
        shader.uniforms.uRedRimColor = { value: new THREE.Color("#ff1230") };
        shader.uniforms.uWhiteRimColor = { value: new THREE.Color("#e6e9ef") };
        shader.uniforms.uRimStrength = rimStrength;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `#include <common>
          uniform vec3 uRedRimColor;
          uniform vec3 uWhiteRimColor;
          uniform float uRimStrength;
          uniform float uRimAssembly;
          uniform float uFacetReveal;
          uniform float uVolumetricLockPreview;
          uniform float uAssembly;`,
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          `#include <common>\n${FRAGMENT_VERTEX_GLSL}`,
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\nobjectNormal = deformFragmentNormal(normal);",
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "vec3 transformed = deformFragmentPosition(position);",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float rimEdge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
          float rim = smoothstep(0.76, 0.94, rimEdge);
          vec3 worldRightInView = normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0));
          float worldSide = dot(normalize(normal), worldRightInView);
          float redSideMask = smoothstep(0.05, 0.45, worldSide);
          float whiteSideMask = smoothstep(0.05, 0.45, -worldSide);
          float faceLight = max(0.0, dot(normalize(normal), vec3(0.0, 0.0, 1.0)));
          vec3 standardPreRevealFill = vec3(0.018, 0.020, 0.024) + vec3(0.045, 0.050, 0.060) * faceLight;
          vec3 volumetricPreRevealFill = vec3(0.003, 0.0035, 0.004)
            + vec3(0.012, 0.013, 0.015) * faceLight * smoothstep(0.0, 1.0, uAssembly);
          vec3 preRevealFill = mix(standardPreRevealFill, volumetricPreRevealFill, uVolumetricLockPreview);
          outgoingLight = outgoingLight * mix(0.85, 1.0, rim) * uFacetReveal
            + preRevealFill * (1.0 - uFacetReveal);
          float rimReveal = mix(uFacetReveal, 1.0, uVolumetricLockPreview);
          outgoingLight += rim * uRedRimColor * redSideMask * uRimStrength * rimReveal;
          outgoingLight += rim * uWhiteRimColor * whiteSideMask * 0.85 * uFacetReveal;
          #include <opaque_fragment>`,
        );
      };
      material.customProgramCacheKey = () => "knight-fragmented-silhouette-rim-v6";
      ctx.rimStrengthUniforms.push(rimStrength);
      return material;
    });
    ctx.surfaceMaterials.push(...materials);
    sources.forEach((material) => material.dispose());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];

    // The opaque body occludes this thin shell, leaving only its outer contour.
    const silhouette = new THREE.Mesh(lowPolyGeometry, createSilhouetteMaterial(ctx));
    silhouette.renderOrder = -1;
    silhouette.raycast = () => {};
    mesh.add(silhouette);

    if (ctx.debugMode) continue;

    // Use selective EdgesGeometry (~24 deg threshold) instead of full WireframeGeometry.
    // Suppresses 60-80% of internal triangulation lines, keeping only meaningful structural creases:
    // silhouette contours, cheek/jaw transitions, neck contours, selected mane blocks, chest, pedestal edges.
    const edgeGeometry = new THREE.EdgesGeometry(lowPolyGeometry, EDGE_THRESHOLD_ANGLE_DEG);
    annotateFragmentEdges(edgeGeometry, fragmentPlan);
    const wireframe = new THREE.LineSegments(edgeGeometry, createRevealMaterial(ctx));
    wireframe.renderOrder = 1;
    wireframe.raycast = () => {};
    mesh.add(wireframe);
    ctx.wireframes.push(wireframe);
    ctx.revealMaterials.push(wireframe.material);
  }

  const allChunks = chunkPlans.flatMap((plan) => plan.chunks);
  ctx.fragmentStats = {
    chunkCount: allChunks.length,
    faceCount: chunkPlans.reduce((sum, plan) => sum + plan.faceCount, 0),
    faceCounts: chunkPlans.flatMap((plan) => plan.faceCounts),
    regionCounts: chunkPlans.reduce((counts, plan) => {
      for (const [region, count] of Object.entries(plan.regionCounts)) counts[region] = (counts[region] || 0) + count;
      return counts;
    }, {}),
  };
  ctx.frame.dataset.fragmentChunks = String(ctx.fragmentStats.chunkCount);
  ctx.frame.dataset.fragmentFaceCounts = ctx.fragmentStats.faceCounts.join(",");
  ctx.frame.dataset.fragmentRegionCounts = JSON.stringify(ctx.fragmentStats.regionCounts);
  ctx.frame.dataset.fragmentBoundaryVertices = String(chunkPlans.reduce((sum, plan) => sum + plan.boundaryVertexCount, 0));
  ctx.frame.dataset.fragmentSpreadHeightRatio = (ctx.fragmentSpreadUniform.value / modelHeight).toFixed(3);
  ctx.frame.dataset.fragmentRotationDegrees = allChunks
    .map((chunk) => (Math.abs(chunk.axisAngle[3]) * 180 / Math.PI).toFixed(2))
    .join(",");

  if (volumetricMode && !ctx.mobileViewport.matches) {
    try {
      await prepareVolumetricKnight(ctx, root);
      ctx.frame.dataset.volumetricAssembly = "ready";
    } catch (error) {
      if (ctx.homeCapture?.assemblyMode === "volume") throw error;
      ctx.openingController?.disableSequence("volumetric-asset-error");
      ctx.frame.dataset.openingError = "volumetric-asset-error";
      console.warn("[Home Opening] volumetric assembly unavailable; keeping the intact Knight.", error);
    }
  }
}

export function disposeKnightResources(root) {
  const geometries = new Set();
  const materials = new Set();
  root?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) materials.add(material);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function disposeKnight(ctx) {
  if (!ctx.knight) return;
  ctx.fracturePulse?.dispose();
  disposeKnightResources(ctx.knight);
  ctx.modelPivot.remove(ctx.knight);
  ctx.knight = null;
}

export function findTrackingCenter(ctx, root) {
  root.updateMatrixWorld(true);
  ctx.modelPivot.updateMatrixWorld(true);
  const pivotInverse = ctx.modelPivot.matrixWorld.clone().invert();
  const bounds = new THREE.Box3().setFromObject(root);
  return bounds.getCenter(new THREE.Vector3()).applyMatrix4(pivotInverse);
}

export function updateKnightMaterialProgress(ctx) {
  if (ctx.debugMode) return;
  if (ctx.mobileViewport.matches) {
    ctx.modelPivot.scale.setScalar(1);
    ctx.modelPivot.position.y = FLOOR_Y;
    for (const material of ctx.surfaceMaterials) {
      material.metalness = 0.32;
      material.roughness = 0.36;
    }
    return;
  }
  const polish = smoothstep(0.42, 0.92, ctx.progress);
  for (const material of ctx.surfaceMaterials) {
    material.metalness = 0.28 + polish * 0.18;
    material.roughness = 0.40 - polish * 0.08;
  }
  // Narrative progression across stages:
  // IDEA: construction edges (~0.18 opacity)
  // STRUCTURE: balanced wireframe supporting sculptural facets (~0.11 opacity)
  // FORM: polished faceted sculpture, minimal wireframe (~0.04 opacity)
  const scrollWireframeOpacity = THREE.MathUtils.lerp(0.18, 0.04, ctx.progress);
  for (const material of ctx.revealMaterials) {
    material.uniforms.uBaseOpacity.value = scrollWireframeOpacity;
  }
  ctx.modelPivot.scale.setScalar(1 + ctx.progress * 0.025);
  ctx.modelPivot.position.y = FLOOR_Y + ctx.progress * 0.045;
}
