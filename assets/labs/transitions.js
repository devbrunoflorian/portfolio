export function createLabsTransitions(ctx, {
  binary,
  cameraRig,
  folderRoots,
}) {
  const { THREE, scene, canvas, reducedMotion, layout } = ctx;
  let scrollPosition = 0;

  function setFolderVisualState(root, mode, progress, glyphOpacity, pointerMultiplier, visible, counterpartMatrix) {
    root.visible = visible;
    root.traverse((object) => {
      if (object.isInstancedMesh) {
        binary.setTransition(object.material, mode, progress, glyphOpacity, pointerMultiplier, counterpartMatrix);
        return;
      }
      if (object.userData.depthOccluder) {
        object.visible = visible && mode === 0;
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
    currentRoot.updateMatrixWorld(true);
    const previewPosition = cameraRig.getProjectedPreviewPosition(
      nextRoot,
      previewBasePosition,
      previewScale,
      currentRoot,
    );
    const arrival = easeRange(fraction, 0.55, 0.95);
    const dissolve = easeRange(fraction, 0.12, 0.88);
    const rebuild = easeRange(fraction, 0.12, 0.82);
    const hasNext = segment < 4;

    currentRoot.visible = true;
    nextRoot.position.copy(previewPosition).lerp(heroPosition, arrival);
    nextRoot.scale.copy(previewScale).lerp(heroScale, arrival);
    scene.updateMatrixWorld(true);
    setFolderVisualState(
      currentRoot,
      fraction > 0 && hasNext ? 1 : 0,
      fraction,
      1,
      fraction > 0 && hasNext ? 1 - dissolve : 1,
      true,
      nextRoot.matrixWorld,
    );
    binary.setBlur(currentRoot, 0);

    const previewFade = segment === 0 ? 1 : easeRange(fraction, 0, 0.1);
    const previewBlur = hasNext ? (fraction > 0 ? 1 - rebuild : 1) : 0;
    setFolderVisualState(
      nextRoot,
      fraction > 0 && hasNext ? 2 : 0,
      fraction,
      fraction > 0 && hasNext ? 1 : 0.72 * previewFade,
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

    return {
      motionPosition,
      segment,
      fraction,
      dissolve,
      rebuild,
      arrival,
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
