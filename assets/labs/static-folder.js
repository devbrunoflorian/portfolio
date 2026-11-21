import { createFolderShell, heightScaleAt } from './core/folder-shell.js';
import {
  boundarySegments,
  distanceToBoundary,
  randomPointOnTriangle,
  shellTriangleGeometry,
  triangleAtXY,
} from './core/mesh-geometry.js';
import { createShellOcclusion } from './core/shell-occlusion.js';

// Keep glyph proportions uniform; use emission color to describe the folder silhouette.
const BINARY_GLYPH_SIZE = 0.195;

// Light grazing the upper fold and the two points of contact with the floor.
function rimIntensity({ x, y }) {
  const fold = Math.exp(-((x - 1.75) ** 2 / 1.25 + (y - 2.95) ** 2 / 0.32));
  const contact = Math.exp(-((Math.abs(x) - 2.62) ** 2 / 0.35 + y * y / 0.14));
  return 0.8 * fold + 1.05 * contact;
}

export function createStaticFolder(ctx) {
  const { THREE, random, scene, folderRoot, camera } = ctx;
  const cameraTarget = ctx.cameraTarget;
  const { geometryDebugEnabled, captureEnabled, glyphSpacing, glowProfile } = ctx.config;
  const shellOcclusion = createShellOcclusion(ctx);
  const geometryDebugScaffolds = [];
  let folderPreviewBaseLine = null;

  const glyphs = [];

  function addGlyph(point, normal, options = {}) {
    glyphs.push({
      point: point.clone().addScaledVector(normal, options.offset ?? 0.006),
      normal: normal.clone(),
      width: BINARY_GLYPH_SIZE * 0.78,
      height: BINARY_GLYPH_SIZE,
      digit: (options.random ?? random)() < 0.5 ? 0 : 1,
      color: new THREE.Color(options.color ?? 0x347fce),
      depth: options.depth ?? 'front',
      exposed: options.exposed ?? true,
    });
  }

  function loadFolderScaffold() {
    return [createFolderShell(THREE)];
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
    const primary = meshes[0];
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

    for (const panel of [front.filter(t => t.back), front.filter(t => !t.back)]) {
      const panelEdges = boundarySegments(panel);
      for (let y = yMin + 0.035; y <= yMax; y += spacingY) {
        for (let x = xMin + 0.035; x <= xMax; x += spacingX) {
          const hit = triangleAtXY(panel, x, y * heightScaleAt(x), THREE, true);
          if (!hit) continue;

          const edgeDistance = distanceToBoundary(hit.point, panelEdges, THREE);
          if (edgeDistance < 0.095) continue;
          const exposed = isVisibleShellPoint(hit.point);
          const sample = exposed ? random : ctx.backPanelRandom;
          const edgeLight = 1 - THREE.MathUtils.smoothstep(edgeDistance, 0.04, 0.56);
          const baseLight = 1 - THREE.MathUtils.smoothstep(
            hit.point.y,
            lowestBoundaryY + 0.035,
            lowestBoundaryY + 0.26,
          );
          const silhouetteLight = Math.max(edgeLight, baseLight * 0.86);
          const interior = new THREE.Color(0x0d2654);
          const body = new THREE.Color(0x4284cd);
          const perimeter = new THREE.Color(0x72a9ff);
          const color = interior
            .lerp(body, 0.48 + sample() * 0.1)
            .lerp(perimeter, silhouetteLight * 0.88);
          const emission = color.multiplyScalar(glowProfile.faceEmission * (0.92 + silhouetteLight * 0.25 + rimIntensity(hit.point)));
          addGlyph(hit.point, hit.triangle.normal, {
            color: emission,
            offset: 0.011,
            exposed,
            random: sample,
          });
          accepted += 1;
        }
      }
    }

    let edgeAccepted = 0;
    for (const { curve, normal, back } of primary.rims) {
      const count = Math.round(curve.getLength() / glyphSpacing);
      for (let index = 0; index < count; index++) {
        const point = curve.getPoint(index / count);
        const brightness = 1.18 + rimIntensity(point);
        addGlyph(point, normal, {
          color: new THREE.Color(0x69a4ff).multiplyScalar(glowProfile.faceEmission * glowProfile.perimeterEmission * brightness),
          offset: 0.018,
          depth: 'front-edge',
          exposed: !back || isVisibleShellPoint(point, true),
        });
        edgeAccepted++;
      }
    }

    return { accepted, edgeAccepted };
  }

  function makeRearGlyphs(meshes) {
    let accepted = 0;
    const main = meshes[0];
    const rear = main.triangles.filter((triangle) => triangle.type === 'rear');
    const edge = boundarySegments(rear);
    const points = main.normalizedPoints;
    const xMin = Math.min(...points.map((point) => point.x));
    const xMax = Math.max(...points.map((point) => point.x));
    const yMin = Math.min(...points.map((point) => point.y));
    const yMax = Math.max(...points.map((point) => point.y));
    const spacingX = glyphSpacing;
    const spacingY = glyphSpacing * 1.109375;
    for (let y = yMin + 0.055; y <= yMax; y += spacingY) {
      for (let x = xMin + 0.045; x <= xMax; x += spacingX) {
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
    const main = meshes[0];
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
    const sideSpacing = BINARY_GLYPH_SIZE * 1.15;
    let accepted = 0;
    for (let attempt = 0; attempt < 5200 && accepted < 460; attempt += 1) {
      let target = random() * totalArea;
      let index = cumulative.findIndex((area) => area >= target);
      if (index < 0) index = cumulative.length - 1;
      const triangle = visible[index];
      const point = randomPointOnTriangle(triangle, random, THREE);
      if (!isVisibleShellPoint(point)) continue;
      const key = `${Math.floor(point.x / sideSpacing)}:${Math.floor(point.y / sideSpacing)}:${Math.floor(point.z / sideSpacing)}`;
      if (bucket.has(key)) continue;
      bucket.add(key);

      const brightness = THREE.MathUtils.clamp(triangle.normal.dot(viewDirection), 0.1, 1);
      const color = new THREE.Color(0x163d65).lerp(new THREE.Color(0x3f89d0), brightness * 0.58);
      const emission = color.multiplyScalar(brightness > 0.72 ? 1.5 : 1);
      addGlyph(point, triangle.normal, {
        color: emission,
        offset: 0.007,
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
