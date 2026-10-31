import * as THREE from "three";

const FRACTURE_PATH_URL = "/assets/models/chess-knight-006-fracture-pulse.bin";
const FRACTURE_PATH_HEADER_BYTES = 12;
const FRACTURE_PULSE = Object.freeze({
  ignition: 1.77,
  travelSeconds: 0.18,
  peakStart: 1.975,
  peakEnd: 2.02,
  fadeTravelSeconds: 0.17,
  localFadeSeconds: 0.11,
  visibleUntil: 2.31,
});

function createFractureMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTimelineTime: { value: 0 },
      uPulseColor: { value: new THREE.Color("#ff173b") },
    },
    vertexShader: `
      attribute float aFractureDistance;
      varying float vFractureDistance;
      void main() {
        vFractureDistance = aFractureDistance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTimelineTime;
      uniform vec3 uPulseColor;
      varying float vFractureDistance;
      void main() {
        float pathDistance = clamp(vFractureDistance, 0.0, 1.0);
        float localIgnition = 1.77 + pathDistance * 0.18;
        float charged = smoothstep(localIgnition - 0.008, localIgnition + 0.008, uTimelineTime);
        float front = exp(-pow((uTimelineTime - localIgnition - 0.012) / 0.018, 2.0));
        float peak = smoothstep(1.955, 1.975, uTimelineTime)
          * (1.0 - smoothstep(2.02, 2.05, uTimelineTime));
        float localFadeStart = 2.02 + (1.0 - pathDistance) * 0.17;
        float fade = 1.0 - smoothstep(localFadeStart, localFadeStart + 0.11, uTimelineTime);
        float emission = charged * fade * (0.62 + peak * 0.55 + front * 0.35);
        if (emission < 0.008) discard;
        gl_FragColor = vec4(uPulseColor * emission, clamp(emission, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function parseFracturePathAsset(buffer) {
  if (buffer.byteLength < FRACTURE_PATH_HEADER_BYTES) {
    throw new Error("Fracture path asset is shorter than its header.");
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "FSP1") throw new Error(`Unsupported fracture path asset version: ${magic}`);
  const segmentCount = view.getUint32(4, true);
  const componentCount = view.getUint16(8, true);
  const branchNodeCount = view.getUint16(10, true);
  const expectedBytes = FRACTURE_PATH_HEADER_BYTES + segmentCount * 8 * Float32Array.BYTES_PER_ELEMENT;
  if (!segmentCount || buffer.byteLength !== expectedBytes) {
    throw new Error(`Invalid fracture path payload size: ${buffer.byteLength}; expected ${expectedBytes}.`);
  }

  const source = new Float32Array(buffer, FRACTURE_PATH_HEADER_BYTES, segmentCount * 8);
  const positions = new Float32Array(segmentCount * 6);
  const distances = new Float32Array(segmentCount * 2);
  for (let segment = 0; segment < segmentCount; segment++) {
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const sourceOffset = segment * 8 + endpoint * 4;
      const targetOffset = segment * 6 + endpoint * 3;
      positions[targetOffset] = source[sourceOffset];
      positions[targetOffset + 1] = source[sourceOffset + 1];
      positions[targetOffset + 2] = source[sourceOffset + 2];
      distances[segment * 2 + endpoint] = source[sourceOffset + 3];
    }
  }
  return { segmentCount, componentCount, branchNodeCount, positions, distances };
}

export async function prepareFracturePulse(ctx, root) {
  if (ctx.fracturePulse) return ctx.fracturePulse;
  const response = await fetch(FRACTURE_PATH_URL);
  if (!response.ok) throw new Error(`Could not load fracture paths (${response.status}).`);
  const asset = parseFracturePathAsset(await response.arrayBuffer());
  if (ctx.disposed) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(asset.positions, 3));
  geometry.setAttribute("aFractureDistance", new THREE.BufferAttribute(asset.distances, 1));
  geometry.computeBoundingSphere();

  const material = createFractureMaterial();
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = "Chess Knight 006 — capped fracture pulse";
  lines.frustumCulled = false;
  lines.renderOrder = 3;
  lines.raycast = () => {};
  lines.visible = false;
  root.add(lines);
  lines.visible = true;
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
    lines.visible = false;
  }

  let disposed = false;
  const pulse = {
    lines,
    segmentCount: asset.segmentCount,
    componentCount: asset.componentCount,
    branchNodeCount: asset.branchNodeCount,
    setTime(time) {
      if (disposed) return;
      const timelineTime = Number.isFinite(time) ? time : 0;
      material.uniforms.uTimelineTime.value = timelineTime;
      lines.visible = timelineTime >= FRACTURE_PULSE.ignition && timelineTime <= FRACTURE_PULSE.visibleUntil;
      ctx.frame.dataset.fracturePulseTime = timelineTime.toFixed(3);
      ctx.frame.dataset.fracturePulseVisible = String(lines.visible);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.remove(lines);
      geometry.dispose();
      material.dispose();
      if (ctx.fracturePulse === pulse) ctx.fracturePulse = null;
    },
  };
  ctx.fracturePulse = pulse;
  ctx.frame.dataset.fracturePulseSegments = String(asset.segmentCount);
  ctx.frame.dataset.fracturePulseComponents = String(asset.componentCount);
  ctx.frame.dataset.fracturePulseBranches = String(asset.branchNodeCount);
  return pulse;
}
