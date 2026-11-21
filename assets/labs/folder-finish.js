import { shellTriangleGeometry } from './core/mesh-geometry.js';

export function createLabsFolderFinish(ctx, meshes) {
  const { THREE, folderRoot } = ctx;
  const geometry = shellTriangleGeometry(meshes, THREE);
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0x0b1726,
    transparent: true,
    opacity: 0.015,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  surfaceMaterial.userData.labsThemeRole = 'folder-surface';
  surfaceMaterial.userData.labsDarkColor = 0x0b1726;
  surfaceMaterial.userData.labsLightColor = 0xd9e5f6;
  surfaceMaterial.userData.labsDarkOpacity = 0.015;
  surfaceMaterial.userData.labsLightOpacity = 0.4;

  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  surface.name = 'labs-folder-theme-surface';
  surface.renderOrder = 0.25;
  surface.frustumCulled = false;
  surface.userData.folderFinish = true;
  folderRoot.add(surface);

  const edgeGeometry = new THREE.EdgesGeometry(geometry, 18);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x58a1f0,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    toneMapped: false,
  });
  edgeMaterial.userData.labsThemeRole = 'folder-outline';
  edgeMaterial.userData.labsDarkColor = 0x58a1f0;
  edgeMaterial.userData.labsLightColor = 0x0052cc;
  edgeMaterial.userData.labsDarkOpacity = 0.08;
  edgeMaterial.userData.labsLightOpacity = 0.82;

  const outline = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  outline.name = 'labs-folder-theme-outline';
  outline.scale.setScalar(1.001);
  outline.renderOrder = 6;
  outline.frustumCulled = false;
  outline.userData.folderFinish = true;
  folderRoot.add(outline);

  return {
    dispose() {
      folderRoot.remove(surface, outline);
      geometry.dispose();
      edgeGeometry.dispose();
      surfaceMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
}
