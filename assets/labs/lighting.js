export function createLabsLighting(ctx, camera) {
  const { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, renderer, scene, initialSize } = ctx;
  const { strength, radius, threshold } = ctx.config.glowProfile;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(initialSize.width, initialSize.height),
    strength,
    radius,
    threshold,
  ));
  composer.addPass(new OutputPass());
  ctx.composer = composer;

  return {
    composer,
    render() {
      composer.render();
    },
    resize(width, height) {
      composer.setSize(width, height);
    },
    dispose() {
      composer.dispose();
    },
  };
}
