import { updateFireflyRecoil } from './core/firefly-recoil.js';
import { createFireflyLayout } from './core/firefly-layout.js';
import { createFireflyScrollTransition } from './core/firefly-transition.js';
import { FIREFLY_FRAGMENT_SHADER, FIREFLY_VERTEX_SHADER } from './shaders/fireflies.js';

export function createFireflies(ctx, { glyphs, nextRoot, glyphAtlas }) {
  const { THREE, scene, pointer } = ctx;
  const { captureEnabled } = ctx.config;
  const layout = createFireflyLayout(ctx, { glyphs, nextRoot });
  const {
    countByRegion,
    activeCenter,
    halfWidth,
    halfHeight,
    binaryCount,
    headerCount,
    positions,
    drifts,
    phases,
    rates,
    sizes,
    intensities,
    glyphFlags,
    glyphColumns,
    regions,
    folderAnchors,
    corridorEdges,
    corridorProgress,
    corridorSideOffsets,
    corridorUpOffsets,
    corridorDepthOffsets,
  } = layout;
  let fireflyState = null;

  function resetCaptureFireflyRecoil(seconds) {
    if (!captureEnabled || !fireflyState) return;
    fireflyState.offsets.fill(0);
    fireflyState.velocities.fill(0);
    if (pointer.active) {
      const step = 1 / 60;
      for (let frame = 0; frame < 24; frame += 1) updateFireflyRecoil(ctx, fireflyState, step, seconds);
    } else {
      fireflyState.offsetAttribute.needsUpdate = true;
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aDrift', new THREE.Float32BufferAttribute(drifts, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aRate', new THREE.Float32BufferAttribute(rates, 1));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  const intensityAttribute = new THREE.Float32BufferAttribute(intensities, 1);
  intensityAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aIntensity', intensityAttribute);
  geometry.setAttribute('aGlyph', new THREE.Float32BufferAttribute(glyphFlags, 1));
  geometry.setAttribute('aGlyphColumn', new THREE.Float32BufferAttribute(glyphColumns, 1));
  const recoilOffsets = new Float32Array(positions.length);
  const recoilAttribute = new THREE.BufferAttribute(recoilOffsets, 3);
  recoilAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aRecoilOffset', recoilAttribute);
  fireflyState = {
    positions: positionAttribute.array,
    homePositions: Float32Array.from(positionAttribute.array),
    drifts: Float32Array.from(drifts),
    phases: Float32Array.from(phases),
    rates: Float32Array.from(rates),
    intensities: intensityAttribute.array,
    homeIntensities: Float32Array.from(intensityAttribute.array),
    regions: Uint8Array.from(regions),
    folderAnchors: Float32Array.from(folderAnchors),
    corridorEdges: Float32Array.from(corridorEdges),
    corridorProgress: Float32Array.from(corridorProgress),
    corridorSideOffsets: Float32Array.from(corridorSideOffsets),
    corridorUpOffsets: Float32Array.from(corridorUpOffsets),
    corridorDepthOffsets: Float32Array.from(corridorDepthOffsets),
    offsets: recoilOffsets,
    velocities: new Float32Array(positions.length),
    offsetAttribute: recoilAttribute,
    positionAttribute,
    intensityAttribute,
  };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      idleTime: { value: 0 },
      idleStrength: { value: 0 },
      glyphAtlas: { value: glyphAtlas },
    },
    vertexShader: FIREFLY_VERTEX_SHADER,
    fragmentShader: FIREFLY_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  const setTransitionState = createFireflyScrollTransition(ctx, {
    fireflyState,
    activeCenter,
    halfWidth,
    halfHeight,
  });

  return {
    total: positions.length / 3,
    binaryCount,
    headerCount,
    countByRegion,
    points,
    setTransitionState,
    updateRecoil: (delta, seconds) => updateFireflyRecoil(ctx, fireflyState, delta, seconds),
    resetCaptureRecoil: resetCaptureFireflyRecoil,
    clearRecoil() {
      fireflyState.offsets.fill(0);
      fireflyState.velocities.fill(0);
      fireflyState.offsetAttribute.needsUpdate = true;
    },
    setIdleTime(seconds) {
      material.uniforms.idleTime.value = seconds;
      material.uniforms.idleStrength.value = 1;
    },
    setIdleStrength(strength) {
      material.uniforms.idleStrength.value = strength;
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
