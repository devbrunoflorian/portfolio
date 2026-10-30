import * as THREE from "three";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { FLOOR_Y, smoothstep } from "./context.js";

const LOW_POLY_FACET_VERTEX_BUDGET = 1100;
const EDGE_THRESHOLD_ANGLE_DEG = 24;

export function createRevealMaterial() {
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

export function createSilhouetteMaterial() {
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

export async function prepareKnight(ctx, root) {
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
      ctx.rimStrengthUniforms.push(rimStrength);
      return material;
    });
    ctx.surfaceMaterials.push(...materials);
    sources.forEach((material) => material.dispose());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];

    // The opaque body occludes this thin shell, leaving only its outer contour.
    const silhouette = new THREE.Mesh(lowPolyGeometry, createSilhouetteMaterial());
    silhouette.renderOrder = -1;
    silhouette.raycast = () => {};
    mesh.add(silhouette);

    if (ctx.debugMode) continue;

    // Use selective EdgesGeometry (~24 deg threshold) instead of full WireframeGeometry.
    // Suppresses 60-80% of internal triangulation lines, keeping only meaningful structural creases:
    // silhouette contours, cheek/jaw transitions, neck contours, selected mane blocks, chest, pedestal edges.
    const edgeGeometry = new THREE.EdgesGeometry(lowPolyGeometry, EDGE_THRESHOLD_ANGLE_DEG);
    const wireframe = new THREE.LineSegments(edgeGeometry, createRevealMaterial());
    wireframe.renderOrder = 1;
    wireframe.raycast = () => {};
    mesh.add(wireframe);
    ctx.wireframes.push(wireframe);
    ctx.revealMaterials.push(wireframe.material);
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
