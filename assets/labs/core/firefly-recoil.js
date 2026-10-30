export function updateFireflyRecoil(ctx, fireflyState, delta, seconds) {
  if (!fireflyState || delta <= 0) return;

  const { THREE, stage, camera, pointer } = ctx;
  const { positions, drifts, phases, rates, offsets, velocities, offsetAttribute } = fireflyState;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  const worldPosition = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const projectedPosition = new THREE.Vector3();
  const interactionScale = Math.min(1, height / 941);
  const radius = 150 * interactionScale;

  for (let index = 0; index < phases.length; index += 1) {
    const offset = index * 3;
    const cycle = seconds * rates[index] + phases[index];
    const phase = phases[index];
    worldPosition.set(
      positions[offset] + drifts[offset] * Math.cos(cycle) + Math.sin(seconds * 0.37 + phase) * 0.012,
      positions[offset + 1] + drifts[offset + 1] * Math.sin(cycle) + Math.cos(seconds * 0.29 + phase * 1.7) * 0.01,
      positions[offset + 2] + drifts[offset + 2] * Math.sin(cycle * 0.63 + phase * 1.1) + Math.sin(seconds * 0.23 + phase * 0.7) * 0.008,
    );

    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;
    let reacting = false;
    if (pointer.active) {
      projectedPosition.copy(worldPosition).project(camera);
      if (projectedPosition.z >= -1 && projectedPosition.z <= 1) {
        const screenX = (projectedPosition.x * 0.5 + 0.5) * width;
        const screenY = (1 - (projectedPosition.y * 0.5 + 0.5)) * height;
        const dx = screenX - pointer.x;
        const dy = screenY - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius) {
          const directionX = distance > 0.5 ? dx / distance : Math.cos(phases[index]);
          const directionY = distance > 0.5 ? dy / distance : Math.sin(phases[index]);
          const influence = Math.pow(1 - distance / radius, 0.62);
          viewPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
          const unitsPerPixel = 2 * Math.abs(viewPosition.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) / height;
          const radialDisplacement = 30 * influence * unitsPerPixel * interactionScale;
          const turn = phases[index] < Math.PI ? 1 : -1;
          const tangentDisplacement = 10 * influence * unitsPerPixel * interactionScale * turn;
          const screenX = directionX * radialDisplacement - directionY * tangentDisplacement;
          const screenY = directionY * radialDisplacement + directionX * tangentDisplacement;
          targetX = cameraRight.x * screenX - cameraUp.x * screenY;
          targetY = cameraRight.y * screenX - cameraUp.y * screenY;
          targetZ = cameraRight.z * screenX - cameraUp.z * screenY;
          reacting = true;
        }
      }
    }

    const spring = reacting ? 125 : 6;
    const damping = reacting ? 17 : 3.2;
    const retention = Math.exp(-damping * delta);
    velocities[offset] = (velocities[offset] + (targetX - offsets[offset]) * spring * delta) * retention;
    velocities[offset + 1] = (velocities[offset + 1] + (targetY - offsets[offset + 1]) * spring * delta) * retention;
    velocities[offset + 2] = (velocities[offset + 2] + (targetZ - offsets[offset + 2]) * spring * delta) * retention;
    offsets[offset] += velocities[offset] * delta;
    offsets[offset + 1] += velocities[offset + 1] * delta;
    offsets[offset + 2] += velocities[offset + 2] * delta;
  }

  offsetAttribute.needsUpdate = true;
}
