import { shellTriangleGeometry } from './mesh-geometry.js';

export function createShellOcclusion(ctx) {
  const { THREE, camera, folderRoot } = ctx;
  const raycaster = new THREE.Raycaster();
  const rayHits = [];
  let shellOccluder = null;

  function addOccluder(meshes) {
    shellOccluder = new THREE.Mesh(shellTriangleGeometry(meshes, THREE), new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
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

  function isVisibleShellPoint(point) {
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
    return rayHits.length > 0 && rayHits[0].distance >= targetDistance - 0.004;
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
