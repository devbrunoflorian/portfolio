export function createOpeningController({ frame, heroScreen, revealCopy, ctx }) {
  let disposed = false;
  let finalCaptureState = false;

  function update(timeMilliseconds) {
    if (disposed || !ctx.homeCapture) return;
    const time = Math.max(0, timeMilliseconds / 1000);

    if (time < 1.1) ctx.assemblyUniform.value = 0;
    else if (time >= 1.7) ctx.assemblyUniform.value = 1;
    else ctx.assemblyUniform.value = (time - 1.1) / 0.6;

    if (time < 0.55) ctx.rimAssemblyUniform.value = 0;
    else if (time < 1.1) {
      const amount = Math.min(1, (time - 0.55) / 0.55);
      ctx.rimAssemblyUniform.value = amount * amount * (3 - 2 * amount);
    } else if (time < 2.25) ctx.rimAssemblyUniform.value = 1;
    else if (time < 2.75) {
      const amount = (time - 2.25) / 0.5;
      ctx.rimAssemblyUniform.value = 1 - amount * amount * (3 - 2 * amount);
    } else ctx.rimAssemblyUniform.value = 0;

    const normalExperience = time >= 3.9;
    frame.dataset.assemblyProgress = ctx.assemblyUniform.value.toFixed(4);
    frame.dataset.assemblyRim = ctx.rimAssemblyUniform.value.toFixed(4);
    const reflectionAmount = Math.max(0, Math.min(1, (time - 1.1) / 0.4));
    ctx.reflectorOpacityUniform.value = reflectionAmount * reflectionAmount * (3 - 2 * reflectionAmount);
    if (normalExperience !== finalCaptureState && ctx.reflectiveFloor) {
      ctx.reflectiveFloor.material.transparent = !normalExperience;
      ctx.reflectiveFloor.material.depthWrite = normalExperience;
      finalCaptureState = normalExperience;
    }
    ctx.whiteRevealLight && (ctx.whiteRevealLight.intensity = normalExperience ? ctx.whiteRevealIntensity : 0);
    ctx.spatialEnvironment?.setWorldVisible(normalExperience);
  }

  return {
    update,
    presentFirstInteractiveFrame() {
      if (disposed || frame.dataset.sceneState !== "loading") return;
      frame.dataset.sceneState = "live";
      heroScreen.classList.add("scene-live");
      revealCopy();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
    },
  };
}
