import {
  boundarySegments,
  distanceToBoundary,
  meshTriangles,
  randomPointOnTriangle,
  shellTriangleGeometry,
  transformMeshVertices,
  triangleAtXY,
} from './core/mesh-geometry.js';
import { createShellOcclusion } from './core/shell-occlusion.js';

export function createStaticFolder(ctx) {
  const { THREE, GLTFLoader, random, scene, folderRoot, camera } = ctx;
  const cameraTarget = ctx.cameraTarget;
  const { geometryDebugEnabled, captureEnabled, glyphSpacing, glowProfile } = ctx.config;
  const shellOcclusion = createShellOcclusion(ctx);
  const geometryDebugScaffolds = [];
  let folderPreviewBaseLine = null;

  const glyphs = [];

  function addGlyph(point, normal, options = {}) {
    const size = options.size ?? 0.072;
    glyphs.push({
      point: point.clone().addScaledVector(normal, options.offset ?? 0.006),
      normal: normal.clone(),
      width: size * (options.widthRatio ?? 0.78),
      height: size,
      digit: random() < 0.5 ? 0 : 1,
      color: new THREE.Color(options.color ?? 0x347fce),
      depth: options.depth ?? 'front',
    });
  }

  async function loadFolderScaffold() {
    const gltf = await new GLTFLoader().loadAsync('/assets/models/labs-folder-scaffold.glb');
    gltf.scene.updateMatrixWorld(true);
    const sourceMeshes = [];
    const rawPoints = [];

    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      const points = transformMeshVertices(object, THREE);
      sourceMeshes.push({ mesh: object, points });
      rawPoints.push(...points);
    });

    const shellMeshes = sourceMeshes.filter(({ mesh }) => mesh.name === 'Object_30');
    if (shellMeshes.length === 0) throw new Error('The folder scaffold contains no outer-shell geometry.');

    const rawBounds = new THREE.Box3().setFromPoints(rawPoints);
    const height = rawBounds.max.y - rawBounds.min.y;
    const scale = 4.45 / height;
    const bounds = {
      min: rawBounds.min,
      center: new THREE.Vector3(
        (rawBounds.min.x + rawBounds.max.x) * 0.5,
        rawBounds.min.y,
        (rawBounds.min.z + rawBounds.max.z) * 0.5,
      ),
    };

    const meshes = shellMeshes.map(({ mesh, points }) => ({
      name: mesh.name,
      ...meshTriangles(mesh, points, scale, bounds, THREE),
    }));

    for (const { mesh } of sourceMeshes) {
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    }

    return meshes;
  }

  const addShellOccluder = shellOcclusion.addOccluder;
  const isVisibleShellPoint = shellOcclusion.isVisibleShellPoint;

  function addGeometryDebugScaffold(meshes) {
    if (!geometryDebugEnabled) return;
    const scaffold = new THREE.Mesh(shellTriangleGeometry(meshes, THREE), new THREE.MeshBasicMaterial({
      color: 0x68727e,
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
    scaffold.name = 'folder-scaffold-geometry-debug';
    scaffold.userData.geometryDebugScaffold = true;
    scaffold.renderOrder = 0.75;
    scaffold.visible = false;
    folderRoot.add(scaffold);
    geometryDebugScaffolds.push(scaffold);
  }

  function makeFrontGlyphs(meshes) {
    const primary = meshes.find((mesh) => mesh.name === 'Object_30');
    const front = primary.triangles.filter((triangle) => triangle.type === 'front');
    const edge = boundarySegments(front);
    const boundaryPoints = edge.flatMap(({ a, b }) => [a, b]);
    const lowestBoundaryY = Math.min(...boundaryPoints.map((point) => point.y));
    const basePoints = boundaryPoints.filter((point) => point.y <= lowestBoundaryY + 0.035);
    if (basePoints.length < 2) throw new Error('The folder front has no measurable base edge.');
    const baseLeft = basePoints.reduce((left, point) => point.x < left.x ? point : left);
    const baseRight = basePoints.reduce((right, point) => point.x > right.x ? point : right);
    if (baseRight.x - baseLeft.x < 1) throw new Error('The folder front base edge is too short to project.');
    folderPreviewBaseLine = [baseLeft.clone(), baseRight.clone()];
    const points = primary.normalizedPoints;
    const xMin = Math.min(...points.map((point) => point.x));
    const xMax = Math.max(...points.map((point) => point.x));
    const yMin = Math.min(...points.map((point) => point.y));
    const yMax = Math.max(...points.map((point) => point.y));
    const spacingX = glyphSpacing;
    const spacingY = glyphSpacing * 1.109375;
    let accepted = 0;

    for (let y = yMin + 0.035; y <= yMax; y += spacingY) {
      for (let x = xMin + 0.035; x <= xMax; x += spacingX) {
        const jittered = new THREE.Vector2(
          x + (random() - 0.5) * spacingX * 0.42,
          y + (random() - 0.5) * spacingY * 0.34,
        );
        const hit = triangleAtXY(front, jittered.x, jittered.y, THREE, true);
        if (!hit || !isVisibleShellPoint(hit.point)) continue;

        const edgeDistance = distanceToBoundary(hit.point, edge, THREE);
        if (edgeDistance < 0.095) continue;
        const densityWeight = Math.exp(-edgeDistance / 0.17);
        const emissionWeight = Math.exp(-edgeDistance / 0.085);
        const keepChance = 0.82 + densityWeight * 0.12;
        if (random() > keepChance) continue;

        const densityBrightness = THREE.MathUtils.smoothstep(densityWeight, 0.08, 0.72);
        const brightness = THREE.MathUtils.smoothstep(emissionWeight, 0.08, 0.72);
        const interior = new THREE.Color(0x12365c);
        const body = new THREE.Color(0x1b507d);
        const perimeter = new THREE.Color(0x3d85c9);
        const color = interior
          .lerp(body, 0.34 + random() * 0.2)
          .lerp(perimeter, brightness * 0.78);
        const hotspotChance = brightness > 0.78 ? 0.003 : 0;
        const hotspot = random() < hotspotChance;
        const edgeEmission = brightness > 0.68 ? 2.3 : glowProfile.faceEmission;
        const emission = hotspot
          ? new THREE.Color(0xa3d7ff).multiplyScalar(2)
          : color.multiplyScalar(edgeEmission);
        addGlyph(hit.point, new THREE.Vector3(0, 0, 1), {
          size: spacingY * (0.91 + densityBrightness * 0.035),
          color: emission,
          offset: 0.011,
        });
        accepted += 1;
      }
    }

    let edgeAccepted = 0;
    const edgeBuckets = new Set();
    const edgeSpacing = 0.052;
    for (const segment of edge) {
      const length = segment.a.distanceTo(segment.b);
      const steps = Math.max(1, Math.ceil(length / edgeSpacing));
      for (let step = 0; step <= steps; step += 1) {
        const t = THREE.MathUtils.clamp((step + (random() - 0.5) * 0.32) / steps, 0, 1);
        const point = segment.a.clone().lerp(segment.b, t);
        const key = `${Math.round(point.x / 0.038)}:${Math.round(point.y / 0.038)}`;
        if (edgeBuckets.has(key)) continue;
        edgeBuckets.add(key);

        const variation = random();
        const blue = new THREE.Color(0x2c83dc).lerp(new THREE.Color(0x5caeff), variation * 0.35);
        const emission = blue.multiplyScalar((1.28 + variation * 0.44) * glowProfile.perimeterEmission);
        addGlyph(point, new THREE.Vector3(0, 0, 1), {
          size: 0.048 + variation * 0.009,
          widthRatio: 0.72,
          color: emission,
          offset: 0.014,
          depth: 'front-edge',
        });
        edgeAccepted += 1;
      }
    }

    return { accepted, edgeAccepted };
  }

  function makeRearGlyphs(meshes) {
    let accepted = 0;
    const main = meshes.find((mesh) => mesh.name === 'Object_30');
    const rear = main.triangles.filter((triangle) => triangle.type === 'rear');
    const edge = boundarySegments(rear);
    const points = main.normalizedPoints;
    const xMin = Math.min(...points.map((point) => point.x));
    const xMax = Math.max(...points.map((point) => point.x));
    const yMin = Math.min(...points.map((point) => point.y));
    const yMax = Math.max(...points.map((point) => point.y));
    for (let y = yMin + 0.055; y <= yMax; y += 0.12) {
      for (let x = xMin + 0.045; x <= xMax; x += 0.12) {
        const hit = triangleAtXY(rear, x + 0.03, y + 0.045, THREE, false);
        if (!hit || !isVisibleShellPoint(hit.point)) continue;
        const edgeWeight = Math.exp(-distanceToBoundary(hit.point, edge, THREE) / 0.15);
        if (random() > 0.2 + edgeWeight * 0.54) continue;
        const color = new THREE.Color(0x091d34).lerp(new THREE.Color(0x2261a0), edgeWeight * 0.78);
        const hotspot = edgeWeight > 0.8 && random() < 0.0015;
        const emission = hotspot
          ? new THREE.Color(0xa3d7ff).multiplyScalar(2)
          : color.multiplyScalar(edgeWeight > 0.72 ? 1.75 : 1);
        addGlyph(hit.point, new THREE.Vector3(0, 0, 1), {
          size: 0.05 + edgeWeight * 0.006,
          color: emission,
          offset: 0.009,
          depth: 'rear',
        });
        accepted += 1;
      }
    }

    return accepted;
  }

  function makeSideGlyphs(meshes) {
    const viewDirection = camera.position.clone().sub(cameraTarget).normalize();
    const main = meshes.find((mesh) => mesh.name === 'Object_30');
    const visible = main.triangles
      .filter((triangle) => triangle.type === 'side' && triangle.normal.dot(viewDirection) > 0.08);
    const totalArea = visible.reduce((sum, triangle) => sum + triangle.area, 0);
    const cumulative = [];
    let running = 0;
    for (const triangle of visible) {
      running += triangle.area;
      cumulative.push(running);
    }

    const bucket = new Set();
    let accepted = 0;
    for (let attempt = 0; attempt < 5200 && accepted < 820; attempt += 1) {
      let target = random() * totalArea;
      let index = cumulative.findIndex((area) => area >= target);
      if (index < 0) index = cumulative.length - 1;
      const triangle = visible[index];
      const point = randomPointOnTriangle(triangle, random, THREE);
      if (!isVisibleShellPoint(point)) continue;
      const key = `${Math.floor(point.x / 0.07)}:${Math.floor(point.y / 0.07)}:${Math.floor(point.z / 0.075)}`;
      if (bucket.has(key)) continue;
      bucket.add(key);

      const brightness = THREE.MathUtils.clamp(triangle.normal.dot(viewDirection), 0.1, 1);
      const color = new THREE.Color(0x163d65).lerp(new THREE.Color(0x3f89d0), brightness * 0.58);
      const emission = color.multiplyScalar(brightness > 0.72 ? 1.5 : 1);
      addGlyph(point, triangle.normal, {
        size: 0.069,
        color: emission,
        offset: 0.007,
        widthRatio: 0.7,
        depth: 'side',
      });
      accepted += 1;
    }
    return accepted;
  }

  function configurePreviewFrame() {
    if (!folderPreviewBaseLine) throw new Error('The folder preview base line was not sampled from the scaffold.');
    const bounds = new THREE.Box3().setFromPoints(glyphs.map((glyph) => glyph.point));
    const base = folderPreviewBaseLine[0].clone().lerp(folderPreviewBaseLine[1], 0.5);
    const frame = {
      anchor: bounds.getCenter(new THREE.Vector3()),
      base,
      baseLine: folderPreviewBaseLine,
    };
    ctx.layout.previewFrame = frame;
    return frame;
  }

  return {
    glyphs,
    debugScaffolds: geometryDebugScaffolds,
    loadFolderScaffold,
    addShellOccluder,
    addGeometryDebugScaffold,
    makeFrontGlyphs,
    makeRearGlyphs,
    makeSideGlyphs,
    configurePreviewFrame,
    dispose: shellOcclusion.dispose,
    get previewBaseLine() { return folderPreviewBaseLine; },
  };
}
