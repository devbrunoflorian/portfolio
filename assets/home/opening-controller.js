import { clamp, smoothstep } from "./context.js";

function easeInOutQuad(value) {
  return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
}

function easeInQuad(value) {
  return value * value;
}

function getAssemblyProgress(time) {
  const elapsed = clamp((time - 1.1) / 0.6);
  if (elapsed <= 0) return 0;
  if (elapsed < 0.18) return 0.28 * easeInOutQuad(elapsed / 0.18);
  if (elapsed < 0.7) return 0.28 + 0.37 * easeInOutQuad((elapsed - 0.18) / 0.52);
  return 0.65 + 0.35 * easeInQuad((elapsed - 0.7) / 0.3);
}

function getAssemblyRim(time) {
  if (time < 0.55) return 0;
  if (time < 0.85) return smoothstep(0.55, 0.85, time);
  if (time < 1.1) return 1;
  if (time < 1.7) return 1;
  if (time <= 2.0) {
    const pulse = smoothstep(1.72, 1.86, time);
    const settle = smoothstep(1.86, 2.0, time);
    return 1 - 0.28 * pulse + 0.22 * settle;
  }
  if (time < 2.25) {
    const elapsed = time - 1.7;
    const pulse = 0.8 + 0.22 * Math.sin(elapsed * Math.PI * 2 * 0.3);
    const lockIn = smoothstep(1.7, 1.78, time);
    return 1 + (pulse - 1) * lockIn;
  }
  return (0.8 + 0.22 * Math.sin(0.55 * Math.PI * 2 * 0.3)) * (1 - smoothstep(2.25, 2.75, time));
}

export function createOpeningController({ frame, heroScreen, revealCopy, ctx }) {
  let disposed = false;
  let finalCaptureState = false;
  const targetFocusCapture = ctx.homeCapture?.focusLayer === "target" && !ctx.mobileViewport.matches;
  const previousFocusLayer = document.documentElement.dataset.homeFocusLayer;
  if (targetFocusCapture) document.documentElement.dataset.homeFocusLayer = "target";

  function restoreTargetFocusCapture() {
    if (!targetFocusCapture) return;
    if (previousFocusLayer === undefined) delete document.documentElement.dataset.homeFocusLayer;
    else document.documentElement.dataset.homeFocusLayer = previousFocusLayer;
  }

  function update(timeMilliseconds) {
    if (disposed || !ctx.homeCapture) return;
    const captureTime = Math.max(0, timeMilliseconds / 1000);
    const time = captureTime;
    const assemblyOnly = ctx.homeCapture.assemblyMode === "volume";
    const timelineTime = assemblyOnly ? Math.min(2.35, time) : time;

    ctx.assemblyTimeUniform.value = assemblyOnly ? timelineTime : 0;
    ctx.assemblyUniform.value = getAssemblyProgress(timelineTime);
    ctx.rimAssemblyUniform.value = getAssemblyRim(timelineTime);
    const facetReveal = assemblyOnly ? 0 : smoothstep(2.0, 2.25, time);
    const assemblyLighting = smoothstep(0, 1, ctx.assemblyUniform.value);
    ctx.facetRevealUniform.value = facetReveal;
    ctx.assemblyLights.forEach(({ light, intensity }) => {
      const volumeGain = assemblyOnly
        ? (light.name === "fixed-red-right-light" ? 0.12 : 0.38)
        : 1;
      light.intensity = intensity * assemblyLighting * volumeGain;
    });

    const reflectionAmount = assemblyOnly ? 0 : smoothstep(1.1, 1.5, time);
    const floorAmount = assemblyOnly ? 0 : smoothstep(2.0, 2.25, time);
    const volumetricHandoff = assemblyOnly && timelineTime >= 1.85;
    ctx.reflectorReflectionUniform.value = reflectionAmount;
    ctx.reflectorFloorUniform.value = floorAmount;
    if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = !assemblyOnly;
    const normalExperience = !assemblyOnly && time >= 3.9;
    frame.dataset.assemblyProgress = ctx.assemblyUniform.value.toFixed(4);
    frame.dataset.assemblyRim = ctx.rimAssemblyUniform.value.toFixed(4);
    frame.dataset.facetReveal = facetReveal.toFixed(4);
    frame.dataset.reflectorOpacity = floorAmount.toFixed(4);
    frame.dataset.reflectionOpacity = reflectionAmount.toFixed(4);
    frame.dataset.worldVisible = String(!assemblyOnly && time >= 2.0);
    frame.dataset.volumetricHandoff = String(volumetricHandoff);
    if (ctx.volumetricMesh) {
      ctx.volumetricMesh.visible = !assemblyOnly || (timelineTime >= 0.55 && !volumetricHandoff);
    }
    ctx.volumetricBaseMeshes?.forEach((mesh) => { mesh.visible = volumetricHandoff; });
    ctx.volumetricBaseLines?.forEach((line) => { line.visible = !volumetricHandoff; });
    if (ctx.whiteRevealLight) {
      const whiteReveal = assemblyOnly ? 0 : smoothstep(2.25, 2.75, time);
      ctx.whiteRevealLight.intensity = ctx.whiteRevealIntensity * whiteReveal * smoothstep(0, 1, ctx.assemblyUniform.value);
    }
    if (normalExperience !== finalCaptureState && ctx.reflectiveFloor) {
      ctx.reflectiveFloor.material.transparent = !normalExperience;
      ctx.reflectiveFloor.material.depthWrite = normalExperience;
      finalCaptureState = normalExperience;
    }
    ctx.spatialEnvironment?.setWorldVisible(!assemblyOnly && time >= 2.0);
    if (assemblyOnly) ctx.spatialEnvironment?.setReflectionVisible(false);

    if (targetFocusCapture) {
      if (ctx.scene.background?.isColor) ctx.scene.background.set(0x000000);
      ctx.modelPivot.visible = false;
      if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
      if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = false;
      ctx.spatialEnvironment?.setWorldVisible(false);
      ctx.spatialEnvironment?.setTargetVisible(true);
      ctx.spatialEnvironment?.setTargetTime(captureTime);
      frame.dataset.worldVisible = "false";
    }
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
      restoreTargetFocusCapture();
    },
  };
}
