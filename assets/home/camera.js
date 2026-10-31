export function activeSceneDescription(ctx) {
  const portuguese = document.documentElement.lang.startsWith("pt");
  if (ctx.mobileViewport.matches && !ctx.debugMode) {
    return portuguese
      ? "Cena 3D ativa. O cavalo permanece em pose fixa enquanto o ambiente acompanha a rolagem."
      : "3D scene active. The knight stays fixed while the environment follows scrolling.";
  }
  return portuguese
    ? "Cena 3D ativa. O movimento do ponteiro é opcional; projetos e navegação permanecem disponíveis."
    : "3D scene active. Pointer movement is optional; projects and navigation remain available.";
}

export function resizeScene(ctx) {
  if (!ctx.renderer) return;
  const width = Math.max(1, ctx.frame.clientWidth);
  const height = Math.max(1, ctx.frame.clientHeight);
  const isMobile = ctx.mobileViewport.matches && !ctx.debugMode;
  const maxPixelRatio = Math.sqrt((isMobile ? 650_000 : 1_800_000) / (width * height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5, maxPixelRatio);
  ctx.renderer.setPixelRatio(1);
  ctx.renderer.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio), false);
  ctx.camera.aspect = width / height;
  ctx.camera.position.set(0, isMobile ? 0.1 : 0.12, isMobile ? 3.5 : 4.55);
  ctx.camera.lookAt(0, isMobile ? -0.17 : -0.2, 0);
  ctx.camera.updateProjectionMatrix();
  if (ctx.reflectiveFloor) {
    const target = ctx.reflectiveFloor.getRenderTarget();
    target.setSize(isMobile ? 320 : 720, isMobile ? 320 : 480);
    ctx.reflectiveFloor.material.uniforms.color.value.set(isMobile ? 0x73747a : 0x898a90);
    ctx.reflectiveFloor.material.uniforms.uMobileBlur.value = isMobile ? 1.25 : 0;
    ctx.reflectiveFloor.material.uniforms.uReflectionTexel.value.set(1 / target.width, 1 / target.height);
  }
  ctx.frame.dataset.poseMode = isMobile ? "static-mobile" : "pointer-desktop";
  if (!ctx.reducedMotion.matches) ctx.status.textContent = activeSceneDescription(ctx);
  ctx.frame.dataset.bufferWidth = String(ctx.canvas.width);
  ctx.frame.dataset.bufferHeight = String(ctx.canvas.height);
  ctx.updateSceneProgress();
  ctx.queueFrame();
}
