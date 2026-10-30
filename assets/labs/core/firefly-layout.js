import { FIREFLY_REGION } from './firefly-regions.js';

export function createFireflyLayout(ctx, { glyphs, nextRoot }) {
  const { THREE, random, stage, camera, folderRoot } = ctx;
  camera.updateMatrixWorld(true);
  folderRoot.updateMatrixWorld(true);
  nextRoot.updateMatrixWorld(true);

  const countByRegion = { halo: 1120, corridor: 240, floor: 160, ambient: 80 };
  const activeBounds = new THREE.Box3().setFromPoints(glyphs.map((glyph) => glyph.point));
  const activeCenter = activeBounds.getCenter(new THREE.Vector3());
  const activeSize = activeBounds.getSize(new THREE.Vector3());
  const worldCenter = folderRoot.localToWorld(activeCenter.clone());
  const nextCenter = nextRoot.localToWorld(activeCenter.clone());
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  const cameraForward = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const viewportWidth = stage.clientWidth;
  const viewportHeight = stage.clientHeight;
  const centerView = worldCenter.clone().applyMatrix4(camera.matrixWorldInverse);
  const worldUnitsPerPixel = 2 * Math.abs(centerView.z)
    * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) / viewportHeight;
  const stageBounds = stage.getBoundingClientRect();
  const headerBounds = document.querySelector('.labs-header')?.getBoundingClientRect();
  const headerBottom = headerBounds ? Math.max(0, headerBounds.bottom - stageBounds.top) : 64;
  const safeHeaderY = headerBottom + 12;
  let projectedLeft = Infinity;
  let projectedRight = -Infinity;
  let projectedTop = Infinity;
  let projectedBottom = -Infinity;
  const projectedCenter = worldCenter.clone().project(camera);
  const centerScreenX = (projectedCenter.x * 0.5 + 0.5) * viewportWidth;
  const centerScreenY = (1 - (projectedCenter.y * 0.5 + 0.5)) * viewportHeight;

  for (const glyph of glyphs) {
    const projected = folderRoot.localToWorld(glyph.point.clone()).project(camera);
    const x = (projected.x * 0.5 + 0.5) * viewportWidth;
    const y = (1 - (projected.y * 0.5 + 0.5)) * viewportHeight;
    projectedLeft = Math.min(projectedLeft, x);
    projectedRight = Math.max(projectedRight, x);
    projectedTop = Math.min(projectedTop, y);
    projectedBottom = Math.max(projectedBottom, y);
  }

  const halfWidth = Math.max(activeSize.x * 0.38, (projectedRight - projectedLeft) * worldUnitsPerPixel * 0.5);
  const halfHeight = Math.max(activeSize.y * 0.38, (projectedBottom - projectedTop) * worldUnitsPerPixel * 0.5);
  const weightedEdges = glyphs
    .filter((glyph) => glyph.depth === 'front-edge')
    .map((glyph) => {
      const worldPoint = folderRoot.localToWorld(glyph.point.clone());
      const projected = worldPoint.clone().project(camera);
      const screenX = (projected.x * 0.5 + 0.5) * viewportWidth;
      const screenY = (1 - (projected.y * 0.5 + 0.5)) * viewportHeight;
      const rightness = THREE.MathUtils.clamp(
        (screenX - centerScreenX) / Math.max(1, (projectedRight - projectedLeft) * 0.5),
        -1,
        1,
      );
      const heightness = THREE.MathUtils.clamp(
        (centerScreenY - screenY) / Math.max(1, (projectedBottom - projectedTop) * 0.5),
        -1,
        1,
      );
      return {
        worldPoint,
        weight: 1 + Math.max(0, rightness) * 1.2 + Math.max(0, heightness) * 1.05,
      };
    });
  if (weightedEdges.length === 0) throw new Error('The folder silhouette has no edge glyphs for the firefly field.');

  const edgeWeightTotal = weightedEdges.reduce((sum, edge) => sum + edge.weight, 0);
  const focusedEdgeWeightTotal = weightedEdges.reduce((sum, edge) => sum + edge.weight * edge.weight, 0);
  const positions = [];
  const drifts = [];
  const phases = [];
  const rates = [];
  const sizes = [];
  const intensities = [];
  const glyphFlags = [];
  const glyphColumns = [];
  const regions = [];
  const folderAnchors = [];
  const corridorEdges = [];
  const corridorProgress = [];
  const corridorSideOffsets = [];
  const corridorUpOffsets = [];
  const corridorDepthOffsets = [];
  const binaryQuotaByRegion = { halo: 62, corridor: 26, floor: 6, ambient: 2 };
  let binaryCount = 0;
  let headerCount = 0;

  function sampleEdge(preferUpperRight = false) {
    const total = preferUpperRight ? focusedEdgeWeightTotal : edgeWeightTotal;
    const target = random() * total;
    let accumulated = 0;
    for (const edge of weightedEdges) {
      accumulated += preferUpperRight ? edge.weight * edge.weight : edge.weight;
      if (accumulated >= target) return edge;
    }
    return weightedEdges[weightedEdges.length - 1];
  }

  function keepBelowHeader(position, orbitRadius, size) {
    const viewPosition = position.clone().applyMatrix4(camera.matrixWorldInverse);
    const projected = position.clone().project(camera);
    const screenY = (1 - (projected.y * 0.5 + 0.5)) * viewportHeight;
    const unitsPerPixel = 2 * Math.abs(viewPosition.z)
      * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) / viewportHeight;
    const verticalOrbit = Math.abs(cameraUp.x) * orbitRadius.x
      + Math.abs(cameraUp.y) * orbitRadius.y
      + Math.abs(cameraUp.z) * orbitRadius.z
      + 0.025;
    const motionPixels = verticalOrbit / Math.max(0.0001, unitsPerPixel);
    const spriteRadius = size * (16 / Math.max(1, -viewPosition.z)) + 1.5;
    const minimumY = safeHeaderY + motionPixels + spriteRadius;
    if (screenY < minimumY) {
      position.addScaledVector(cameraUp, -(minimumY - screenY) * unitsPerPixel);
    }
    const adjusted = position.clone().project(camera);
    const adjustedY = (1 - (adjusted.y * 0.5 + 0.5)) * viewportHeight;
    if (adjustedY - motionPixels - spriteRadius < headerBottom) headerCount += 1;
  }

  function pushFirefly(position, intensityRange, motionScale, isGlyph, region, corridorData = null) {
    const size = isGlyph
      ? 3.2 + Math.pow(random(), 1.7) * 1.6
      : 0.42 + Math.pow(random(), 8) * 3.6;
    const orbitRadius = new THREE.Vector3(
      (0.025 + random() * 0.075) * motionScale,
      (0.025 + random() * 0.085) * motionScale,
      (0.018 + random() * 0.065) * motionScale,
    );
    keepBelowHeader(position, orbitRadius, size);
    positions.push(position.x, position.y, position.z);
    drifts.push(orbitRadius.x, orbitRadius.y, orbitRadius.z);
    phases.push(random() * Math.PI * 2);
    rates.push(0.26 + random() * 0.42);
    sizes.push(size);
    intensities.push((intensityRange[0] + random() * (intensityRange[1] - intensityRange[0])) * (isGlyph ? 0.84 : 1));
    glyphFlags.push(isGlyph ? 1 : 0);
    glyphColumns.push(random() < 0.5 ? 0 : 1);
    regions.push(region);
    if (region === FIREFLY_REGION.HALO) {
      const localAnchor = folderRoot.worldToLocal(position.clone());
      folderAnchors.push(localAnchor.x, localAnchor.y, localAnchor.z);
    } else {
      folderAnchors.push(0, 0, 0);
    }
    if (corridorData) {
      corridorEdges.push(corridorData.edge.x, corridorData.edge.y, corridorData.edge.z);
      corridorProgress.push(corridorData.progress);
      corridorSideOffsets.push(corridorData.side);
      corridorUpOffsets.push(corridorData.up);
      corridorDepthOffsets.push(corridorData.depth);
    } else {
      corridorEdges.push(0, 0, 0);
      corridorProgress.push(0);
      corridorSideOffsets.push(0);
      corridorUpOffsets.push(0);
      corridorDepthOffsets.push(0);
    }
    if (isGlyph) binaryCount += 1;
  }

  for (let index = 0; index < countByRegion.halo; index += 1) {
    const upperRightEmission = random() < 0.68;
    const edge = sampleEdge(upperRightEmission);
    const outward = edge.worldPoint.clone().sub(worldCenter).normalize();
    const position = edge.worldPoint.clone()
      .addScaledVector(outward, upperRightEmission ? 0.055 + random() * 0.48 : 0.12 + random() * 0.62)
      .addScaledVector(cameraForward, (random() - 0.5) * 0.82);
    if (!upperRightEmission && random() < 0.38) {
      const angle = random() * Math.PI * 2;
      const radius = 1.08 + random() * 0.45;
      position.copy(worldCenter)
        .addScaledVector(cameraRight, Math.cos(angle) * halfWidth * radius)
        .addScaledVector(cameraUp, Math.sin(angle) * halfHeight * radius)
        .addScaledVector(cameraForward, (random() - 0.5) * 0.9);
    }
    pushFirefly(
      position,
      upperRightEmission ? [0.17, 0.42] : [0.12, 0.3],
      0.9 + random() * 0.5,
      index < binaryQuotaByRegion.halo,
      FIREFLY_REGION.HALO,
    );
  }

  const corridor = nextCenter.clone().sub(worldCenter);
  const corridorSide = cameraRight.clone();
  for (let index = 0; index < countByRegion.corridor; index += 1) {
    const source = sampleEdge(true).worldPoint;
    const routeOrigin = source.clone().lerp(
      worldCenter.clone().addScaledVector(cameraRight, halfWidth * 0.32).addScaledVector(cameraUp, halfHeight * 0.12),
      0.36,
    );
    const progress = 0.08 + Math.pow(random(), 0.72) * 0.92;
    const position = routeOrigin.clone().addScaledVector(corridor, progress);
    const width = (0.06 + (1 - progress) * 0.34) * (random() - 0.5);
    position.addScaledVector(corridorSide, width);
    const vertical = (random() - 0.5) * (0.12 + (1 - progress) * 0.44);
    const depth = (random() - 0.5) * 0.65;
    position.addScaledVector(cameraUp, vertical);
    position.addScaledVector(cameraForward, depth);
    pushFirefly(
      position,
      [0.13, 0.33],
      0.85 + random() * 0.55,
      index < binaryQuotaByRegion.corridor,
      FIREFLY_REGION.CORRIDOR,
      {
        edge: folderRoot.worldToLocal(source.clone()),
        progress,
        side: width,
        up: vertical,
        depth,
      },
    );
  }

  for (let index = 0; index < countByRegion.floor; index += 1) {
    pushFirefly(new THREE.Vector3(
      worldCenter.x + (random() - 0.5) * Math.min(activeSize.x * 1.1, 4.4),
      0.045 + random() * 0.16,
      worldCenter.z + (random() - 0.5) * 2.1,
    ), [0.12, 0.28], 0.48 + random() * 0.38, index < binaryQuotaByRegion.floor, FIREFLY_REGION.FLOOR);
  }

  for (let index = 0; index < countByRegion.ambient; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.25 + Math.pow(random(), 1.5) * 0.72;
    pushFirefly(new THREE.Vector3(
      worldCenter.x + Math.cos(angle) * halfWidth * radius,
      worldCenter.y + Math.sin(angle) * halfHeight * radius,
      worldCenter.z,
    ).addScaledVector(cameraForward, (random() - 0.5) * 1.2), [0.06, 0.17], 1.1 + random() * 0.55, index < binaryQuotaByRegion.ambient, FIREFLY_REGION.AMBIENT);
  }

  return {
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
  };
}
