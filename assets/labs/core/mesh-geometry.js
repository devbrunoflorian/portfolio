const DEPTH_SCALE = 0.42;

export function transformMeshVertices(mesh, THREE) {
  if (mesh.isSkinnedMesh) mesh.skeleton.update();
  const position = mesh.geometry.getAttribute('position');
  const points = new Array(position.count);

  for (let index = 0; index < position.count; index += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(position, index);
    if (mesh.isSkinnedMesh) mesh.applyBoneTransform(index, point);
    points[index] = point.applyMatrix4(mesh.matrixWorld);
  }

  return points;
}

export function meshTriangles(mesh, points, scale, bounds, THREE) {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const triangles = [];
  const normalizedPoints = points.map((point) => new THREE.Vector3(
    (point.x - bounds.center.x) * scale,
    (point.y - bounds.min.y) * scale,
    (point.z - bounds.center.z) * scale * DEPTH_SCALE,
  ));

  for (let face = 0; face < triangleCount; face += 1) {
    const ids = index
      ? [index.getX(face * 3), index.getX(face * 3 + 1), index.getX(face * 3 + 2)]
      : [face * 3, face * 3 + 1, face * 3 + 2];
    const [a, b, c] = ids.map((id) => normalizedPoints[id]);
    const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const area = cross.length() * 0.5;
    if (area < 0.000001) continue;
    const normal = cross.normalize();
    const type = normal.z > 0.72 ? 'front' : normal.z < -0.72 ? 'rear' : 'side';
    triangles.push({ meshName: mesh.name, ids, a, b, c, normal, area, type });
  }

  return { triangles, normalizedPoints };
}

export function triangleAtXY(triangles, x, y, THREE, highest = true) {
  let selected = null;
  for (const triangle of triangles) {
    const { a, b, c } = triangle;
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) < 0.000001) continue;

    const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
    const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
    const wc = 1 - wa - wb;
    if (wa < -0.00001 || wb < -0.00001 || wc < -0.00001) continue;

    const point = new THREE.Vector3(
      a.x * wa + b.x * wb + c.x * wc,
      a.y * wa + b.y * wb + c.y * wc,
      a.z * wa + b.z * wb + c.z * wc,
    );
    if (!selected || (highest ? point.z > selected.point.z : point.z < selected.point.z)) {
      selected = { triangle, point };
    }
  }
  return selected;
}

export function boundarySegments(triangles) {
  const edges = new Map();
  const pointKey = (point) => [point.x, point.y, point.z]
    .map((coordinate) => Math.round(coordinate * 10000))
    .join(':');

  for (const triangle of triangles) {
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
      const a = triangle[['a', 'b', 'c'][from]];
      const b = triangle[['a', 'b', 'c'][to]];
      const aKey = pointKey(a);
      const bKey = pointKey(b);
      const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      const edge = edges.get(key);
      if (edge) edge.count += 1;
      else edges.set(key, { count: 1, a, b });
    }
  }
  return [...edges.values()].filter((edge) => edge.count === 1);
}

export function distanceToBoundary(point, edges, THREE) {
  let minimum = Infinity;
  for (const edge of edges) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0
      ? 0
      : THREE.MathUtils.clamp(((point.x - edge.a.x) * dx + (point.y - edge.a.y) * dy) / lengthSquared, 0, 1);
    const x = edge.a.x + dx * projection;
    const y = edge.a.y + dy * projection;
    minimum = Math.min(minimum, Math.hypot(point.x - x, point.y - y));
  }
  return minimum;
}

export function shellTriangleGeometry(meshes, THREE) {
  const positions = meshes.flatMap((mesh) => mesh.triangles.flatMap(({ a, b, c }) => [
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
  ]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function randomPointOnTriangle(triangle, random, THREE) {
  const root = Math.sqrt(random());
  const second = random();
  const wa = 1 - root;
  const wb = root * (1 - second);
  const wc = root * second;
  return new THREE.Vector3(
    triangle.a.x * wa + triangle.b.x * wb + triangle.c.x * wc,
    triangle.a.y * wa + triangle.b.y * wb + triangle.c.y * wc,
    triangle.a.z * wa + triangle.b.z * wb + triangle.c.z * wc,
  );
}
