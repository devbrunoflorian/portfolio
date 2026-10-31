import * as THREE from "three";

const TRACE_STARTS = [0.08, 0.2, 0.32];
const TRACE_DURATION = 0.64;
const GRID_RADIUS = 7.4;
const FADE_START = 1.16;
const ANIMATION_END = 1.72;

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothProgress(start, end, time) {
  return THREE.MathUtils.smoothstep(time, start, end);
}

function createGridMaterial(originalMaterial) {
  const material = originalMaterial.clone();
  const vertexPatches = [
    ["varying float vDepth;", "varying float vDepth;\n      varying vec3 vFloorPosition;"],
    ["vDepth = position.z;", "vDepth = position.z;\n        vFloorPosition = position;"],
  ];
  for (const [source, replacement] of vertexPatches) {
    if (!material.vertexShader.includes(source)) {
      material.dispose();
      return null;
    }
    material.vertexShader = material.vertexShader.replace(source, replacement);
  }

  const depthVarying = "varying float vDepth;";
  if (!material.fragmentShader.includes("uniform float uOpacity;")
    || !material.fragmentShader.includes(depthVarying)) {
    material.dispose();
    return null;
  }
  const fragmentDeclarations = depthVarying.replace(
    "varying float vDepth;",
    "uniform float uReveal;\n      uniform float uPointProgress;\n      uniform float uEnergy;\n      varying float vDepth;\n      varying vec3 vFloorPosition;",
  );
  material.fragmentShader = material.fragmentShader.replace(depthVarying, fragmentDeclarations);

  const outputMarker = "gl_FragColor = vec4(0.30, 0.32, 0.35, fade * uOpacity);";
  if (!material.fragmentShader.includes(outputMarker)) {
    material.dispose();
    return null;
  }
  material.fragmentShader = material.fragmentShader.replace(outputMarker, `
        float radial = length(vFloorPosition.xz) / ${GRID_RADIUS.toFixed(1)};
        float reveal = 1.0 - smoothstep(uReveal - 0.012, uReveal + 0.018, radial);
        float front = 1.0 - smoothstep(0.012, 0.04, abs(radial - uReveal));
        vec2 node = vec2(
          round(vFloorPosition.x / 0.68) * 0.68,
          round(vFloorPosition.z / 0.7) * 0.7
        );
        float nodeDistance = length(vFloorPosition.xz - node);
        float nodeMask = 1.0 - smoothstep(0.012, 0.05, nodeDistance);
        float nodeRadius = length(node) / ${GRID_RADIUS.toFixed(1)};
        float nodeFront = 1.0 - smoothstep(0.012, 0.04, abs(nodeRadius - uPointProgress));
        float point = nodeMask * nodeFront;
        float pulse = max(front * 0.32, point * 0.86) * uEnergy;
        vec3 graphite = vec3(0.30, 0.32, 0.35);
        vec3 crimson = vec3(1.1, 0.012, 0.035);
        vec3 color = mix(graphite, crimson, clamp(pulse, 0.0, 1.0));
        float alpha = fade * max(uOpacity * reveal, pulse * 0.76);
        gl_FragColor = vec4(color, alpha);`);

  material.uniforms.uReveal = { value: 0 };
  material.uniforms.uPointProgress = { value: 0 };
  material.uniforms.uEnergy = { value: 1 };
  return material;
}

export function createFloorAnimation({ floorGrid, signals }) {
  if (!floorGrid?.material?.isShaderMaterial || signals.length !== TRACE_STARTS.length) return null;

  const originalGridMaterial = floorGrid.material;
  const gridMaterial = createGridMaterial(originalGridMaterial);
  if (!gridMaterial) return null;

  let disposed = false;
  floorGrid.material = gridMaterial;
  const trailPosition = new THREE.Vector3();
  const originalSignalState = signals.map((signal) => ({
    uniforms: {
      head: signal.line.material.uniforms.uHead.value,
      opacity: signal.line.material.uniforms.uOpacity.value,
      persist: signal.line.material.uniforms.uPersist.value,
      trailOpacity: signal.trail.material.uniforms.uOpacity.value,
    },
    positions: signal.trail.geometry.attributes.position.array.slice(),
    strengths: signal.trail.geometry.attributes.aStrength.array.slice(),
  }));

  function setTime(localSeconds) {
    if (disposed) return;
    const time = clamp01(localSeconds / ANIMATION_END) * ANIMATION_END;
    const gridProgress = smoothProgress(0.14, 1.08, time) * 1.08;
    const pointProgress = smoothProgress(0.02, 0.98, time) * 1.08;
    const energy = 1 - smoothProgress(FADE_START, ANIMATION_END, time);
    gridMaterial.uniforms.uReveal.value = gridProgress;
    gridMaterial.uniforms.uPointProgress.value = pointProgress;
    gridMaterial.uniforms.uEnergy.value = energy;

    signals.forEach((signal, index) => {
      const age = time - TRACE_STARTS[index];
      const progress = clamp01(age / TRACE_DURATION);
      const complete = age >= TRACE_DURATION;
      const settle = 1 - smoothProgress(FADE_START, ANIMATION_END, time);
      signal.line.material.uniforms.uHead.value = progress;
      signal.line.material.uniforms.uPersist.value = complete ? settle : 0;
      signal.line.material.uniforms.uOpacity.value = age < 0 ? 0 : 0.68 * (complete ? settle : 1);
      signal.trail.material.uniforms.uOpacity.value = age < 0 || complete ? 0 : 0.62;

      const positions = signal.trail.geometry.attributes.position;
      const strengths = signal.trail.geometry.attributes.aStrength;
      for (let trailIndex = 0; trailIndex < 12; trailIndex++) {
        const along = progress - trailIndex * 0.009;
        signal.path.getPoint(Math.max(0, along), trailPosition);
        positions.setXYZ(trailIndex, trailPosition.x, trailPosition.y, trailPosition.z);
        strengths.setX(trailIndex, age < 0 || along < 0 ? 0 : (1 - trailIndex / 12) ** 2);
      }
      positions.needsUpdate = true;
      strengths.needsUpdate = true;
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    floorGrid.material = originalGridMaterial;
    gridMaterial.dispose();
    signals.forEach((signal, index) => {
      const original = originalSignalState[index];
      signal.line.material.uniforms.uHead.value = original.uniforms.head;
      signal.line.material.uniforms.uOpacity.value = original.uniforms.opacity;
      signal.line.material.uniforms.uPersist.value = original.uniforms.persist;
      signal.trail.material.uniforms.uOpacity.value = original.uniforms.trailOpacity;
      signal.trail.geometry.attributes.position.array.set(original.positions);
      signal.trail.geometry.attributes.position.needsUpdate = true;
      signal.trail.geometry.attributes.aStrength.array.set(original.strengths);
      signal.trail.geometry.attributes.aStrength.needsUpdate = true;
    });
  }

  setTime(0);
  return { setTime, dispose, diagnostics: { drawCallsAdded: 0, gridRadius: GRID_RADIUS } };
}
