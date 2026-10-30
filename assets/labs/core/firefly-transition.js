import { FIREFLY_REGION } from './firefly-regions.js';

function smoothstep(start, end, value) {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

export function createFireflyScrollTransition(ctx, {
  fireflyState,
  activeCenter,
  halfWidth,
  halfHeight,
}) {
  const { THREE, camera } = ctx;
  const transitionCenter = new THREE.Vector3();
  const incomingCenter = new THREE.Vector3();
  const corridorVector = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const local = new THREE.Vector3();
  const source = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const routeOrigin = new THREE.Vector3();
  const routeTarget = new THREE.Vector3();
  const scatterDirection = new THREE.Vector3();
  const jitter = new THREE.Vector3();

  function setTransitionState(state) {
    if (!state) return;
    const {
      currentRoot,
      nextRoot: incomingRoot,
      fraction,
      previewFade,
      hasNext,
    } = state;
    const positionsNow = fireflyState.positions;
    const intensityNow = fireflyState.intensities;

    if (fraction === 0) {
      positionsNow.set(fireflyState.homePositions);
      intensityNow.set(fireflyState.homeIntensities);
      for (let index = 0; index < fireflyState.regions.length; index += 1) {
        if (fireflyState.regions[index] === FIREFLY_REGION.CORRIDOR) {
          intensityNow[index] *= hasNext ? previewFade : 0;
        }
      }
    } else {
      transitionCenter.copy(activeCenter);
      currentRoot.localToWorld(transitionCenter);
      incomingCenter.copy(activeCenter);
      incomingRoot.localToWorld(incomingCenter);
      corridorVector.copy(incomingCenter).sub(transitionCenter);
      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      camera.getWorldDirection(cameraForward).normalize();

      for (let index = 0; index < fireflyState.regions.length; index += 1) {
        const offset = index * 3;
        const region = fireflyState.regions[index];
        if (region === FIREFLY_REGION.HALO) {
          local.fromArray(fireflyState.folderAnchors, offset);
          source.copy(local);
          currentRoot.localToWorld(source);
          destination.copy(local);
          incomingRoot.localToWorld(destination);

          const phase = fireflyState.phases[index];
          const rate = fireflyState.rates[index];
          const phaseUnit = phase / (Math.PI * 2);
          const delay = phaseUnit * 0.035;
          const departure = smoothstep(0.12 + delay, 0.52 + delay, fraction);
          const arrival = smoothstep(0.56 + delay, 0.92 + delay, fraction);
          const dispersion = departure * (1 - arrival);
          const normalizedRate = Math.max(0, Math.min(1, (rate - 0.26) / 0.42));
          const polar = Math.acos(2 * normalizedRate - 1);
          jitter.set(
            Math.sin(polar) * Math.cos(phase),
            Math.sin(polar) * Math.sin(phase),
            Math.cos(polar),
          );
          scatterDirection.copy(local).sub(activeCenter).normalize().addScaledVector(jitter, 0.58).normalize();

          source.lerp(destination, arrival).addScaledVector(
            scatterDirection,
            (0.28 + phaseUnit * 0.72) * dispersion,
          );
          positionsNow[offset] = source.x;
          positionsNow[offset + 1] = source.y;
          positionsNow[offset + 2] = source.z;
          intensityNow[index] = fireflyState.homeIntensities[index] * Math.max(1 - departure, arrival);
          continue;
        }

        if (region === FIREFLY_REGION.CORRIDOR) {
          if (!hasNext) {
            intensityNow[index] = 0;
            continue;
          }
          edge.fromArray(fireflyState.corridorEdges, offset);
          currentRoot.localToWorld(edge);
          routeTarget.copy(transitionCenter).addScaledVector(cameraRight, halfWidth * 0.32)
            .addScaledVector(cameraUp, halfHeight * 0.12);
          routeOrigin.copy(edge).lerp(routeTarget, 0.36);
          routeOrigin.addScaledVector(corridorVector, fireflyState.corridorProgress[index]);
          routeOrigin.addScaledVector(cameraRight, fireflyState.corridorSideOffsets[index]);
          routeOrigin.addScaledVector(cameraUp, fireflyState.corridorUpOffsets[index]);
          routeOrigin.addScaledVector(cameraForward, fireflyState.corridorDepthOffsets[index]);
          positionsNow[offset] = routeOrigin.x;
          positionsNow[offset + 1] = routeOrigin.y;
          positionsNow[offset + 2] = routeOrigin.z;
          intensityNow[index] = fireflyState.homeIntensities[index] * previewFade;
        }
      }
    }

    fireflyState.positionAttribute.needsUpdate = true;
    fireflyState.intensityAttribute.needsUpdate = true;
  }

  return setTransitionState;
}
