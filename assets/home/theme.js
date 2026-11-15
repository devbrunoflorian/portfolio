import { registerThemeParticipant } from '../shared/theme.js';
import { smoothstep } from './context.js';

export function registerHomeTheme(ctx) {
  const toneMapping = ctx.renderer.toneMapping;
  let appliedTheme = ctx.theme === 'dark' ? 'dark' : null;
  return registerThemeParticipant({
    applyTheme(theme, { signal }) {
      if (signal.aborted || ctx.disposed || !ctx.renderer) return;
      const light = theme === 'light';
      ctx.theme = theme;
      ctx.canvas.dataset.theme = theme;
      ctx.frame.dataset.knightTheme = light ? 'ivory' : 'onyx';
      if (appliedTheme === theme) return;
      appliedTheme = theme;
      const polish = smoothstep(.42, .92, ctx.progress);
      for (const material of [...ctx.surfaceMaterials, ctx.volumetricMesh?.material].filter(Boolean)) {
        material.color.set(light ? '#f2e7cf' : '#0f1114');
        material.emissive.set(light ? '#e8ddc6' : '#000000');
        material.emissiveIntensity = light ? .12 : 1;
        const volumetric = material === ctx.volumetricMesh?.material;
        material.metalness = light ? .06 : volumetric || ctx.mobileViewport.matches ? .32 : .28 + polish * .18;
        material.roughness = light ? .58 : volumetric || ctx.mobileViewport.matches ? .36 : .40 - polish * .08;
      }
      ctx.renderer.toneMapping = light ? 0 : toneMapping;
      ctx.renderer.setClearColor(light ? 0xf3efea : 0x070809, 1);
      ctx.scene.background?.set(light ? 0xf3efea : 0x070809);
      ctx.spatialEnvironment?.setTheme(theme);
      if (ctx.sceneVisible) {
        ctx.spatialEnvironment?.render(ctx.renderer, ctx.camera);
        ctx.renderer.render(ctx.scene, ctx.camera);
      }
    },
    onError() {
      ctx.canvas.hidden = true;
      ctx.frame.dataset.sceneState = 'poster';
      ctx.heroScreen.classList.remove('scene-live');
      ctx.poster?.removeAttribute('hidden');
    },
  });
}
