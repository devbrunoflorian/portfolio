import * as THREE from "three";

const TRACE_DURATION = 0.52;
const TRACE_START = 0.12;
const TRACE_STAGGER = 0.11;
const BODY_BASE_OPACITY = 0.08;
const ANCHOR_PULSE_DURATION = 0.28;
const FINAL_TRACE_FADE = 0.58;

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothProgress(start, end, time) {
  return THREE.MathUtils.smoothstep(time, start, end);
}

export function createObsidianBackgroundAnimation({
  monoliths,
  signals,
  outlines,
  anchorPoints,
}) {
  if (!monoliths.length || signals.length < monoliths.length || outlines.length !== monoliths.length) return null;

  let disposed = false;
  const orderedColumns = monoliths
    .map((mesh, index) => ({ index, distance: Math.hypot(mesh.position.x, mesh.position.z) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  const startTimes = new Array(monoliths.length);
  orderedColumns.forEach(({ index }, order) => {
    startTimes[index] = TRACE_START + order * TRACE_STAGGER;
  });

  const originalSurfaceMaterials = monoliths.map((mesh) => mesh.material);
  const surfaceMaterials = monoliths.map((mesh, index) => {
    const captureMaterial = mesh.material.clone();
    captureMaterial.transparent = true;
    captureMaterial.depthWrite = false;
    captureMaterial.opacity = BODY_BASE_OPACITY;
    mesh.material = captureMaterial;
    return captureMaterial;
  });

  const originalOutlineMaterials = outlines.map((line) => line.material);
  const baseOutlineOpacities = originalOutlineMaterials.map((material) => material.opacity);
  const outlineMaterials = outlines.map((line, index) => {
    const captureMaterial = line.material.clone();
    captureMaterial.opacity = 0;
    line.material = captureMaterial;
    return captureMaterial;
  });

  const originalAnchorMaterial = anchorPoints.material;
  const anchorMaterial = originalAnchorMaterial.clone();
  const anchorColor = anchorMaterial.uniforms.uColor.value.clone();
  const anchorOpacity = anchorMaterial.uniforms.uOpacity.value;
  const anchorStrength = anchorPoints.geometry.attributes.aStrength;
  const initialAnchorStrength = anchorStrength.array.slice();
  anchorPoints.material = anchorMaterial;
  anchorMaterial.uniforms.uColor.value.set(0xff1230);
  anchorMaterial.uniforms.uOpacity.value = 0.72;

  const trailPosition = new THREE.Vector3();
  const timeLimit = TRACE_START + (monoliths.length - 1) * TRACE_STAGGER + TRACE_DURATION + 0.62;
  const fadeStart = timeLimit - FINAL_TRACE_FADE;

  function setTrace(time, index, start) {
    const signal = signals[index];
    const age = time - start;
    const progress = clamp01(age / TRACE_DURATION);
    const traced = age >= TRACE_DURATION;
    const settle = 1 - smoothProgress(fadeStart, timeLimit, time);
    signal.line.material.uniforms.uHead.value = progress;
    signal.line.material.uniforms.uPersist.value = traced ? settle : 0;
    signal.line.material.uniforms.uOpacity.value = age < 0 ? 0 : 0.82 * (traced ? settle : 1);
    signal.trail.material.uniforms.uOpacity.value = age < 0 || traced ? 0 : 0.68;

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
  }

  function setTime(localSeconds) {
    if (disposed) return;
    const time = clamp01(localSeconds / timeLimit) * timeLimit;
    for (let index = 0; index < monoliths.length; index++) {
      const start = startTimes[index];
      const revealStart = start + TRACE_DURATION * 0.14;
      const revealEnd = start + TRACE_DURATION * 0.92;
      const bodyReveal = smoothProgress(revealStart, revealEnd, time);
      surfaceMaterials[index].opacity = BODY_BASE_OPACITY + (1 - BODY_BASE_OPACITY) * bodyReveal;
      outlineMaterials[index].opacity = baseOutlineOpacities[index] * bodyReveal;
      setTrace(time, index, start);

      const pointAge = time - start;
      const pointPulse = pointAge < 0
        ? 0
        : (1 - smoothProgress(0.03, ANCHOR_PULSE_DURATION, pointAge));
      anchorStrength.setX(index, pointPulse);
    }
    anchorStrength.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    monoliths.forEach((mesh, index) => {
      mesh.material = originalSurfaceMaterials[index];
      surfaceMaterials[index].dispose();
    });
    outlines.forEach((line, index) => {
      line.material = originalOutlineMaterials[index];
      outlineMaterials[index].dispose();
    });
    anchorPoints.material = originalAnchorMaterial;
    originalAnchorMaterial.uniforms.uColor.value.copy(anchorColor);
    originalAnchorMaterial.uniforms.uOpacity.value = anchorOpacity;
    anchorStrength.array.set(initialAnchorStrength);
    anchorStrength.needsUpdate = true;
    anchorMaterial.dispose();
  }

  setTime(0);
  return { setTime, dispose, diagnostics: { order: orderedColumns.map(({ index }) => index), drawCallsAdded: 0 } };
}
