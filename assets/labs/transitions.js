export function createLabsTransitions(ctx, {
  binary,
  cameraRig,
  folderRoots,
  glyphs,
}) {
  const { THREE, scene, canvas, reducedMotion, layout } = ctx;
  const mobile = ctx.config.mobile;
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRig.camera.quaternion).normalize();
  let scrollPosition = 0;
  let mobileTravelAspect = -1;
  let mobileTravel = { exit: 0, entry: 0 };

  function measureMobileTravel() {
    const root = folderRoots[0];
    const savedPosition = root.position.clone();
    const savedScale = root.scale.clone();
    const camera = cameraRig.camera;
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const clearNdc = 1.18;
    let exit = 0;
    let entry = 0;

    root.position.copy(layout.heroPosition);
    root.scale.copy(layout.heroScale);
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    for (const glyph of glyphs) {
      const worldPoint = root.localToWorld(glyph.point.clone());
      const viewPoint = worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);
      const halfViewWidth = Math.max(0.1, -viewPoint.z) * halfFov * camera.aspect;
      const ndcX = worldPoint.clone().project(camera).x;
      exit = Math.max(exit, (ndcX + clearNdc) * halfViewWidth);
      entry = Math.max(entry, (clearNdc - ndcX) * halfViewWidth);
    }

    root.position.copy(savedPosition);
    root.scale.copy(savedScale);
    root.updateMatrixWorld(true);
    return { exit: Math.max(0, exit), entry: Math.max(0, entry) };
  }

  function getMobileTravel() {
    if (!mobile) return mobileTravel;
    const aspect = cameraRig.camera.aspect;
    if (Math.abs(aspect - mobileTravelAspect) > 0.0001) {
      mobileTravel = measureMobileTravel();
      mobileTravelAspect = aspect;
    }
    return mobileTravel;
  }

  function setFolderVisualState(root, mode, progress, glyphOpacity, pointerMultiplier, visible, counterpartMatrix) {
    root.visible = visible;
    root.traverse((object) => {
      if (object.isInstancedMesh) {
        binary.setTransition(object.material, mode, progress, glyphOpacity, pointerMultiplier, counterpartMatrix);
        return;
      }
      if (object.userData.depthOccluder) {
        object.visible = visible && glyphOpacity > 0;
        object.material.uniforms.mode.value = mode;
        object.material.uniforms.progress.value = progress;
      } else if (object.userData.folderFinish) {
        object.visible = visible && mode === 0 && glyphOpacity > 0;
      }
    });
  }

  function easeRange(value, start, end) {
    return THREE.MathUtils.smoothstep(value, start, end);
  }

  function setProgress(position) {
    scrollPosition = THREE.MathUtils.clamp(position, 0, 4);
    const motionPosition = reducedMotion.matches
      ? Math.round(scrollPosition)
      : scrollPosition >= 3.985 ? 4 : scrollPosition;
    const segment = Math.min(4, Math.floor(motionPosition));
    const fraction = segment === 4 ? 0 : motionPosition - segment;
    const currentSlot = segment % 2;
    const nextSlot = 1 - currentSlot;
    const currentRoot = folderRoots[currentSlot];
    const nextRoot = folderRoots[nextSlot];
    const { heroPosition, heroScale, previewPosition: previewBasePosition, previewScale } = layout;
    currentRoot.position.copy(heroPosition);
    currentRoot.scale.copy(heroScale);
    currentRoot.rotation.y = 0;
    currentRoot.updateMatrixWorld(true);
    const mobileTravel = getMobileTravel();
    const previewPosition = mobile
      ? heroPosition.clone().addScaledVector(cameraRight, mobileTravel.entry)
      : cameraRig.getProjectedPreviewPosition(
        nextRoot,
        previewBasePosition,
        previewScale,
        currentRoot,
      );
    const arrival = mobile ? easeRange(fraction, 0.32, 0.62) : easeRange(fraction, 0.55, 0.95);
    const dissolve = mobile ? easeRange(fraction, 0.21, 0.38) : easeRange(fraction, 0.12, 0.88);
    const rebuild = mobile ? easeRange(fraction, 0.32, 0.62) : easeRange(fraction, 0.12, 0.82);
    const exit = mobile ? easeRange(fraction, 0.02, 0.35) : 0;
    const hasNext = segment < 4;

    if (mobile && hasNext) currentRoot.position.addScaledVector(cameraRight, -mobileTravel.exit * exit);
    currentRoot.visible = true;
    nextRoot.position.copy(previewPosition).lerp(heroPosition, arrival);
    nextRoot.rotation.y *= 1 - arrival;
    if (mobile) nextRoot.scale.copy(heroScale).multiplyScalar(0.72 + arrival * 0.28);
    else nextRoot.scale.copy(previewScale).lerp(heroScale, arrival);
    scene.updateMatrixWorld(true);
    setFolderVisualState(
      currentRoot,
      fraction > 0 && hasNext ? 1 : 0,
      mobile ? dissolve : fraction,
      1,
      fraction > 0 && hasNext ? 1 - dissolve : 1,
      true,
      nextRoot.matrixWorld,
    );
    binary.setBlur(currentRoot, 0);

    const previewFade = segment === 0 ? (mobile ? 0 : 1) : easeRange(fraction, 0, 0.1);
    const previewBlur = hasNext ? 1 - arrival : 0;
    const previewOpacity = 0.72 * previewFade;
    setFolderVisualState(
      nextRoot,
      fraction > 0 && hasNext ? 2 : 0,
      mobile ? rebuild : fraction,
      THREE.MathUtils.lerp(previewOpacity, 1, rebuild),
      fraction > 0 && hasNext ? rebuild : 0,
      hasNext,
      currentRoot.matrixWorld,
    );
    binary.setBlur(nextRoot, previewBlur);

    canvas.dataset.scrollPosition = scrollPosition.toFixed(3);
    canvas.dataset.transitionSegment = String(segment + 1);
    canvas.dataset.transitionFraction = fraction.toFixed(3);
    canvas.dataset.transitionDissolve = dissolve.toFixed(3);
    canvas.dataset.transitionRebuild = rebuild.toFixed(3);
    canvas.dataset.activeFolderSlot = String(currentSlot);
    if (mobile) {
      const outgoingVisible = !hasNext || (exit < 0.92 && dissolve < 1);
      const incomingVisible = hasNext && arrival > 0.1 && rebuild > 0.1;
      canvas.dataset.mobilePreviewOpacity = (fraction > 0 && hasNext ? rebuild : 0).toFixed(3);
      canvas.dataset.mobileExit = exit.toFixed(3);
      canvas.dataset.mobileEntry = arrival.toFixed(3);
      canvas.dataset.mobileVisibleFolders = String(Number(outgoingVisible) + Number(incomingVisible));
    }

    return {
      motionPosition,
      segment,
      fraction,
      dissolve,
      rebuild,
      arrival,
      exit,
      currentSlot,
      nextSlot,
      currentRoot,
      nextRoot,
      hasNext,
      previewFade,
    };
  }

  return {
    setProgress,
    get progress() { return scrollPosition; },
  };
}
