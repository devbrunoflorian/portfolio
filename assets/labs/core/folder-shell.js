export function heightScaleAt(x) {
  return 1 - 0.17 * (x / 0.91 + 3) / 6;
}

function placeVertex(v, back) {
  v.x *= 0.91;
  v.y *= heightScaleAt(v.x);
  v.z += back ? -0.12 - v.y * 0.16 : 0.04 + v.y * 0.28;
  return v;
}

// Two rounded leaves share a fold at the floor and open toward the viewer.
export function createFolderShell(THREE) {
  const rims = [];
  const triangles = [];
  const normalizedPoints = [];
  for (const back of [true, false]) {
    const shape = new THREE.Shape();
    const top = back ? 4.42 : 3.58;
    shape.moveTo(-2.87, 0.04);
    shape.lineTo(2.84, 0.04);
    shape.quadraticCurveTo(3, 0.04, 3, 0.22);
    shape.lineTo(3, top - 0.22 - (back ? 0.52 : 0));
    shape.quadraticCurveTo(3, top - (back ? 0.52 : 0), 2.78, top - (back ? 0.52 : 0));
    if (back) {
      shape.lineTo(-0.48, top - 0.52);
      shape.bezierCurveTo(-0.8, top - 0.52, -0.82, top, -1.15, top);
    }
    shape.lineTo(-2.76, top);
    shape.quadraticCurveTo(-3, top, -3, top - 0.23);
    shape.lineTo(-3, 0.21);
    shape.quadraticCurveTo(-3, 0.04, -2.87, 0.04);
    const rim = new THREE.CurvePath();
    const points = shape.getPoints(5).map(({ x, y }) => placeVertex(new THREE.Vector3(x, y, 0.055), back));
    for (let i = 1; i < points.length; i++) rim.add(new THREE.LineCurve3(points[i - 1], points[i]));
    rims.push({ back, curve: rim, normal: new THREE.Vector3(0, back ? 0.16 : -0.28, 1).normalize() });
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: false, curveSegments: 5 });
    const attr = geometry.getAttribute('position');
    for (let i = 0; i < attr.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(offset => {
        const v = new THREE.Vector3().fromBufferAttribute(attr, i + offset);
        return placeVertex(v, back);
      });
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      const area = normal.length() / 2;
      if (area < 1e-6) continue;
      normal.normalize();
      normalizedPoints.push(a, b, c);
      triangles.push({ back, a, b, c, area, normal, type: normal.z > 0.72 ? 'front' : normal.z < -0.72 ? 'rear' : 'side' });
    }
    geometry.dispose();
  }
  return { rims, triangles, normalizedPoints };
}
