import { registerThemeParticipant } from '../shared/theme.js';

export function registerLabsTheme(ctx, render) {
  const { THREE, scene, renderer, composer, canvas } = ctx;
  const originals = new Map();
  scene.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material && !originals.has(material)) originals.set(material, {
        color: material.color?.clone(), blending: material.blending,
        reflection: material.uniforms?.reflectionStrength?.value,
        labsThemeRole: material.userData?.labsThemeRole,
      });
    }
  });
  const bloom = composer.passes.find(pass => 'strength' in pass && 'threshold' in pass);
  const bloomEnabled = bloom?.enabled;
  const toneMapping = renderer.toneMapping;
  let appliedTheme = 'dark';
  return registerThemeParticipant({
    applyTheme(theme, { signal }) {
      if (signal.aborted || ctx.disposed) return;
      canvas.dataset.theme = theme;
      if (appliedTheme === theme) return;
      appliedTheme = theme;
      const light = theme === 'light';
      renderer.toneMapping = light ? THREE.NoToneMapping : toneMapping;
      scene.background.set(light ? 0xf3efea : 0x000000);
      renderer.setClearColor(light ? 0xf3efea : 0x000000, 1);
      for (const [material, original] of originals) {
        if (original.color) {
          if (original.labsThemeRole) {
            material.color.set(light ? material.userData.labsLightColor : material.userData.labsDarkColor);
            material.opacity = light ? material.userData.labsLightOpacity : material.userData.labsDarkOpacity;
          }
          else if (light) material.color.set(0x0052cc);
          else material.color.copy(original.color);
        }
        material.blending = light ? THREE.NormalBlending : original.blending;
        if (material.uniforms?.uLightTheme) material.uniforms.uLightTheme.value = Number(light);
        if (original.reflection !== undefined) material.uniforms.reflectionStrength.value = light ? .12 : original.reflection;
      }
      if (bloom) bloom.enabled = light ? false : bloomEnabled;
      render();
    },
    onError() { canvas.hidden = true; ctx.stage.classList.remove('labs-webgl-static'); },
  });
}
