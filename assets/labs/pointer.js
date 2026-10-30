export function createLabsPointer(ctx, {
  binary,
  fireflies,
  render,
  getCaptureTime,
}) {
  const { stage, canvas, pointer, reducedMotion, config } = ctx;
  const listenersEnabled = !config.geometryDebugEnabled && !config.captureEnabled && !config.orbitEnabled;

  function update(delta) {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const targetStrength = pointer.active ? 1 : 0;
    const rate = pointer.active ? 24 : 1.8;
    pointer.strength += (targetStrength - pointer.strength) * (1 - Math.exp(-rate * delta));
    const ndcX = (pointer.x / width) * 2 - 1;
    const ndcY = 1 - (pointer.y / height) * 2;

    binary.pointerMaterials.forEach((material) => {
      const uniforms = material.userData.pointerUniforms;
      if (!uniforms) return;
      uniforms.ndc.value.set(ndcX, ndcY);
      uniforms.viewport.value.set(width, height);
      uniforms.strength.value = pointer.strength * (material.userData.transitionValues?.pointerMultiplier ?? 1);
    });
  }

  function onPointerMove(event) {
    if (reducedMotion.matches || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
    const bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = pointer.x >= 0 && pointer.x <= bounds.width && pointer.y >= 0 && pointer.y <= bounds.height;
    canvas.dataset.pointerActive = String(pointer.active);
  }

  function onPointerLeave() {
    pointer.active = false;
    canvas.dataset.pointerActive = 'false';
  }

  function setCapturePointer(x, y) {
    const hasPoint = Number.isFinite(x) && Number.isFinite(y);
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    pointer.x = hasPoint ? x : 0;
    pointer.y = hasPoint ? y : 0;
    pointer.active = hasPoint && x >= 0 && x <= width && y >= 0 && y <= height;
    pointer.strength = pointer.active ? 1 : 0;
    canvas.dataset.pointerActive = String(pointer.active);
    update(0);
    fireflies?.resetCaptureRecoil(getCaptureTime() ?? 0);
    render();
  }

  function clear() {
    pointer.active = false;
    pointer.strength = 0;
    canvas.dataset.pointerActive = 'false';
    binary.pointerMaterials.forEach((material) => {
      const uniforms = material.userData.pointerUniforms;
      if (uniforms) uniforms.strength.value = 0;
    });
    fireflies?.clearRecoil();
  }

  function mount() {
    if (!listenersEnabled) return;
    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', onPointerLeave, { passive: true });
  }

  return {
    mount,
    update,
    setCapture: setCapturePointer,
    clear,
    resetCaptureRecoil(seconds) { fireflies?.resetCaptureRecoil(seconds); },
    dispose() {
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
