import { shellTriangleGeometry } from './mesh-geometry.js';
import { TRANSFER_TIMING } from '../shaders/transition.js';

export function createShellOcclusion(ctx) {
  const { THREE, camera, folderRoot } = ctx;
  const raycaster = new THREE.Raycaster();
  const rayHits = [];
  let shellOccluder = null;

  function addOccluder(meshes) {
    const geometry = shellTriangleGeometry(meshes, THREE);
    const vertices = geometry.getAttribute('position');
    camera.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    const projectedX = Array.from({ length: vertices.count }, (_, i) =>
      folderRoot.localToWorld(point.fromBufferAttribute(vertices, i)).project(camera).x);
    const minX = Math.min(...projectedX);
    const width = Math.max(...projectedX) - minX;
    geometry.setAttribute('scanOrder', new THREE.Float32BufferAttribute(projectedX.map(x => (x - minX) / width), 1));
    shellOccluder = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { mode: { value: 0 }, progress: { value: 0 } },
      vertexShader: `
        attribute float scanOrder;
        varying float vScan;
        void main() {
          vScan = scanOrder;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${TRANSFER_TIMING}
        uniform float mode;
        uniform float progress;
        varying float vScan;
        void main() {
          if (mode > 0.5) {
            float amount = transferAmount(vScan, 0.5, progress);
            float released = smoothstep(0.025, 0.20, distanceFromFolder(mode, amount, progress));
            // Uncover the background only where the local band of digits has left.
            float threshold = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
            if (released > threshold) discard;
          }
          gl_FragColor = vec4(0.0);
        }
      `,
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    }));
    shellOccluder.name = 'folder-outer-shell-depth';
    shellOccluder.userData.depthOccluder = true;
    shellOccluder.renderOrder = 0.5;
    shellOccluder.frustumCulled = false;
    folderRoot.add(shellOccluder);
    return shellOccluder;
  }

  function isVisibleShellPoint(point, onRim = false) {
    if (!shellOccluder) return true;
    folderRoot.updateMatrixWorld(true);
    const target = folderRoot.localToWorld(point.clone());
    const direction = target.sub(camera.position);
    const targetDistance = direction.length();
    if (targetDistance <= 0) return false;

    raycaster.set(camera.position, direction.multiplyScalar(1 / targetDistance));
    raycaster.near = 0;
    raycaster.far = targetDistance + 0.002;
    rayHits.length = 0;
    raycaster.intersectObject(shellOccluder, false, rayHits);
    return rayHits.length ? rayHits[0].distance >= targetDistance - 0.004 : onRim;
  }

  function dispose() {
    if (!shellOccluder) return;
    folderRoot.remove(shellOccluder);
    shellOccluder.geometry.dispose();
    shellOccluder.material.dispose();
    shellOccluder = null;
  }

  return { addOccluder, isVisibleShellPoint, dispose };
}
