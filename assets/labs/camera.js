export function createLabsCamera(ctx) {
  const { THREE, initialSize, canvas, layout } = ctx;
  const cameraTarget = new THREE.Vector3(0, 1.63, 0);
  const camera = new THREE.PerspectiveCamera(36, initialSize.width / initialSize.height, 0.1, 60);
  camera.position.set(-7.4635, 3.2, 11.638);
  camera.lookAt(cameraTarget);
  ctx.camera = camera;
  ctx.cameraTarget = cameraTarget;
  function getProjectedPreviewPosition(root, basePosition, scale, activeRoot = ctx.folderRoot) {
    const { anchor, base, baseLine } = layout.previewFrame;
    root.position.copy(basePosition);
    root.scale.copy(scale);
    camera.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    activeRoot.updateMatrixWorld(true);

    const centerView = root.localToWorld(anchor.clone())
      .applyMatrix4(camera.matrixWorldInverse);
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const centerDepth = Math.max(0.1, -centerView.z);
    const targetCenterX = layout.previewCenterNdcX * centerDepth * halfFov * camera.aspect;
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    root.position.addScaledVector(cameraRight, targetCenterX - centerView.x);
    root.updateMatrixWorld(true);

    const previewBaseWorld = root.localToWorld(base.clone());
    const previewBaseView = previewBaseWorld.clone().applyMatrix4(camera.matrixWorldInverse);
    const previewBaseNdc = previewBaseWorld.clone().project(camera);
    const activeBaseLine = baseLine
      .map((point) => activeRoot.localToWorld(point.clone()).project(camera))
      .sort((a, b) => a.x - b.x);
    const [lineLeft, lineRight] = activeBaseLine;
    const lineWidth = lineRight.x - lineLeft.x;
    const lineProgress = Math.abs(lineWidth) < 0.000001
      ? 0.5
      : (previewBaseNdc.x - lineLeft.x) / lineWidth;
    const targetBaseNdcY = lineLeft.y + (lineRight.y - lineLeft.y) * lineProgress;
    const baseDepth = Math.max(0.1, -previewBaseView.z);
    const targetBaseY = targetBaseNdcY * baseDepth * halfFov;
    root.position.addScaledVector(cameraUp, targetBaseY - previewBaseView.y);
    root.updateMatrixWorld(true);

    const alignedBaseNdc = root.localToWorld(base.clone()).project(camera);
    const alignedTargetNdcY = lineLeft.y + (lineRight.y - lineLeft.y)
      * (Math.abs(lineWidth) < 0.000001 ? 0.5 : (alignedBaseNdc.x - lineLeft.x) / lineWidth);
    root.userData.previewBaseAlignment = {
      targetNdcY: alignedTargetNdcY,
      projectedNdcY: alignedBaseNdc.y,
      errorNdc: alignedBaseNdc.y - alignedTargetNdcY,
    };
    if (ctx.config.captureEnabled) {
      canvas.dataset.previewBaseTargetNdcY = alignedTargetNdcY.toFixed(6);
      canvas.dataset.previewBaseProjectedNdcY = alignedBaseNdc.y.toFixed(6);
      canvas.dataset.previewBaseErrorNdc = root.userData.previewBaseAlignment.errorNdc.toFixed(8);
    }

    return root.position.clone();
  }

  async function createOrbitControls(render) {
    const { OrbitControls } = await ctx.loadOrbitControls();
    const canvas = ctx.canvas;
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'grab';
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(cameraTarget);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.update();

    const reportCamera = () => {
      const state = {
        position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
        target: controls.target.toArray().map((value) => Number(value.toFixed(4))),
        fov: Number(camera.fov.toFixed(2)),
      };
      canvas.dataset.cameraState = JSON.stringify(state);
      window.__labsCameraState = state;
      console.info('[Labs camera]', state);
    };
    controls.addEventListener('change', () => {
      reportCamera();
      render();
    });
    reportCamera();
    return controls;
  }

  return {
    camera,
    cameraTarget,
    getProjectedPreviewPosition,
    createOrbitControls,
    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
  };
}
