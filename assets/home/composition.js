import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createSpatialEnvironment } from "./environment.js?v=pbr-tight-1";
import { homeEnvironment, mobileViewport } from "./technical-systems.js?v=pbr-tight-1";
import { revealMobileCopy, updateMobileProgress } from "../home-mobile.js?v=pbr-tight-1";
import { homeCapture } from "../home-capture.js";
import { activeSceneDescription, resizeScene } from "./camera.js";
import {
  BASE_MODEL_SIZE,
  FLOOR_Y,
  MODEL_SCALE_FACTOR,
  RESTING_LEFT_YAW,
  RESTING_PITCH,
  MOBILE_RESTING_YAW,
  FRONTAL_MODEL_YAW,
  MAX_YAW,
  clamp,
  createHomeContext,
  smoothstep,
} from "./context.js";
import { createOpeningController } from "./opening-controller.js";
import {
  disposeKnight,
  disposeKnightResources,
  findTrackingCenter,
  prepareKnight,
  updateKnightMaterialProgress,
} from "./knight.js";
import {
  createReflectiveFloor,
  createStudioLighting,
  disposeLighting,
  studioLightsAreFixed,
} from "./lighting-reflection.js";
import { createPointerScroll } from "./pointer-scroll.js";

function mountHomeScene() {
  const ctx = createHomeContext({ homeCapture, homeEnvironment, mobileViewport });
  ctx.updateMobileProgress = updateMobileProgress;
  ctx.openingController = createOpeningController({
    frame: ctx.frame,
    heroScreen: ctx.heroScreen,
    revealCopy: revealMobileCopy,
    ctx,
  });
  const pointerScroll = createPointerScroll(ctx);
  ctx.updateSceneProgress = pointerScroll.updateSceneProgress;
  ctx.queueFrame = () => {
    if (ctx.homeCapture) return;
    if (!ctx.renderer || !ctx.sceneVisible || ctx.frameRequest) return;
    ctx.frameRequest = requestAnimationFrame(renderFrame);
  };
  const listeners = [];
  let visibilityObserver;

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function renderFrame(timestamp) {
    ctx.frameRequest = 0;
    if (!ctx.renderer || !ctx.knight || (!ctx.sceneVisible && !ctx.homeCapture)) return;
    if (ctx.mobileViewport.matches && !ctx.debugMode) {
      const copyBounds = ctx.heroCopy.getBoundingClientRect();
      const sceneBounds = ctx.frame.getBoundingClientRect();
      if (copyBounds.top <= sceneBounds.top && copyBounds.right > sceneBounds.left + 1) {
        ctx.lastFrameAt = 0;
        return;
      }
    }
    ctx.openingController.presentFirstInteractiveFrame(timestamp);
    const elapsed = ctx.homeCapture ? ctx.homeCapture.delta : ctx.lastFrameAt ? Math.min(80, timestamp - ctx.lastFrameAt) : 16;
    ctx.lastFrameAt = timestamp;
    const smoothing = 1 - Math.exp(-elapsed / 105);
    ctx.yaw += (ctx.targetYaw - ctx.yaw) * smoothing;
    ctx.pitch += (ctx.targetPitch - ctx.pitch) * smoothing;
    ctx.revealAmount += (ctx.targetReveal - ctx.revealAmount) * smoothing;
    ctx.pointerWorld.lerp(ctx.pointerTarget, smoothing);
    if (ctx.mobileViewport.matches && !ctx.debugMode) {
      ctx.yaw = ctx.targetYaw = MOBILE_RESTING_YAW;
      ctx.pitch = ctx.targetPitch = RESTING_PITCH;
      ctx.revealAmount = ctx.targetReveal = 0;
      ctx.pointerWorld.set(0, 0, 0);
    }
    ctx.modelPivot.rotation.set(ctx.pitch, FRONTAL_MODEL_YAW + ctx.yaw, 0);
    ctx.openingController.update(timestamp);
    const profileAmount = clamp(Math.abs(ctx.yaw) / MAX_YAW);
    const rimStrength = ctx.mobileViewport.matches && !ctx.debugMode ? 1.4 : 0.85 + smoothstep(0.6, 1, profileAmount) * 0.55;
    for (const uniform of ctx.rimStrengthUniforms) uniform.value = rimStrength;
    for (const material of ctx.revealMaterials) {
      material.uniforms.uBaseOpacity.value = ctx.mobileViewport.matches && !ctx.debugMode ? 0.25 : 0.38;
      material.uniforms.uPointer.value.copy(ctx.pointerWorld);
      material.uniforms.uReveal.value = ctx.revealAmount;
    }
    updateKnightMaterialProgress(ctx);
    if (ctx.spatialEnvironment && homeEnvironment) {
      ctx.spatialEnvironment.update(timestamp, homeEnvironment);
      homeEnvironment.update(timestamp, elapsed);
      homeEnvironment.setAnchor(pointerScroll.projectTrackingCenter(), ctx.frame.getBoundingClientRect());
    }
    ctx.spatialEnvironment?.render(ctx.renderer, ctx.camera);
    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.frame.dataset.modelYaw = ctx.yaw.toFixed(4);
    ctx.frame.dataset.modelPitch = ctx.pitch.toFixed(4);
    ctx.frame.dataset.pointerReveal = ctx.revealAmount.toFixed(3);
    ctx.frame.dataset.studioLightsFixed = String(studioLightsAreFixed(ctx));

    const settling = Math.abs(ctx.yaw - ctx.targetYaw) > 0.001
      || Math.abs(ctx.pitch - ctx.targetPitch) > 0.001
      || Math.abs(ctx.revealAmount - ctx.targetReveal) > 0.005
      || ctx.pointerWorld.distanceToSquared(ctx.pointerTarget) > 0.00001;
    if (settling || (ctx.spatialEnvironment && !ctx.reducedMotion.matches && ctx.sceneVisible)) ctx.queueFrame();
  }

  function setStaticFallback(message) {
    ctx.openingController.disableSequence("scene-fallback");
    ctx.homeCapture?.fallback();
    revealMobileCopy();
    homeEnvironment?.setActive(false);
    if (ctx.renderer) {
      ctx.renderer.dispose();
      ctx.renderer = null;
    }
    ctx.canvas.hidden = true;
    ctx.heroScreen.classList.remove("scene-live");
    ctx.frame.dataset.sceneState = "poster";
    ctx.frame.dataset.modelReady = "false";
    ctx.status.textContent = message;
  }

  function onReducedMotionChange() {
    if (ctx.reducedMotion.matches) {
      ctx.openingController.disableSequence("reduced-motion");
      pointerScroll.pointerLeave();
      const restingYaw = mobileViewport.matches && !ctx.debugMode ? MOBILE_RESTING_YAW : RESTING_LEFT_YAW;
      ctx.yaw = restingYaw;
      ctx.pitch = RESTING_PITCH;
      ctx.targetYaw = restingYaw;
      ctx.targetPitch = RESTING_PITCH;
      ctx.revealAmount = 0;
      ctx.targetReveal = 0;
      ctx.pointerWorld.set(0, 0, 0);
      ctx.pointerTarget.set(0, 0, 0);
      ctx.modelPivot.rotation.set(RESTING_PITCH, FRONTAL_MODEL_YAW + restingYaw, 0);
      for (const material of ctx.revealMaterials) material.uniforms.uReveal.value = 0;
      ctx.canvas.hidden = !ctx.debugMode;
      if (ctx.debugMode) {
        ctx.heroScreen.classList.add("scene-live");
        ctx.frame.dataset.sceneState = "live";
      } else {
        ctx.heroScreen.classList.remove("scene-live");
        ctx.frame.dataset.sceneState = "poster";
      }
      ctx.status.textContent = document.documentElement.lang.startsWith("pt")
        ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
        : "3D scene paused by reduced-motion preference. The static scene and navigation remain available.";
    } else if (ctx.renderer && ctx.knight) {
      ctx.canvas.hidden = false;
      ctx.frame.dataset.sceneState = "loading";
      ctx.status.textContent = activeSceneDescription(ctx);
    } else if (!ctx.renderer) {
      startScene();
    }
    ctx.updateSceneProgress();
    ctx.queueFrame();
  }

  function onMobileViewportChange() {
    if (!ctx.debugMode) {
      pointerScroll.pointerLeave();
      resizeScene(ctx);
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    setStaticFallback("A cena 3D foi pausada; o modelo estático e a navegação continuam disponíveis.");
  }

  function dispose() {
    if (ctx.disposed) return;
    ctx.disposed = true;
    if (ctx.frameRequest) cancelAnimationFrame(ctx.frameRequest);
    ctx.frameRequest = 0;
    visibilityObserver?.disconnect();
    for (const remove of listeners.splice(0)) remove();
    ctx.openingController.dispose();
    homeEnvironment?.dispose?.();
    ctx.spatialEnvironment?.dispose();
    disposeKnight(ctx);
    disposeLighting(ctx);
    ctx.renderer?.dispose();
    ctx.renderer = null;
  }

  const onPosterError = () => {
    ctx.poster.hidden = true;
    ctx.fallback.src = "/assets/models/chess-knight-006-preview.png";
    ctx.fallback.hidden = false;
  };
  listen(ctx.posterImage, "error", onPosterError);
  listen(ctx.heroScreen, "pointermove", pointerScroll.pointerMove);
  listen(ctx.heroScreen, "pointerleave", pointerScroll.pointerLeave);
  listen(ctx.canvas, "webglcontextlost", onContextLost);
  if (!ctx.debugMode) listen(window, "scroll", ctx.updateSceneProgress, { passive: true });
  listen(window, "resize", () => resizeScene(ctx), { passive: true });
  listen(ctx.reducedMotion, "change", onReducedMotionChange);
  listen(mobileViewport, "change", onMobileViewportChange);
  visibilityObserver = new IntersectionObserver(([entry]) => {
    ctx.sceneVisible = entry.isIntersecting;
    if (ctx.sceneVisible) ctx.queueFrame();
  });
  visibilityObserver.observe(ctx.frame);

  if (ctx.reducedMotion.matches) ctx.track.dataset.motion = "reduced";
  startScene();

  async function startScene() {
    try {
      if (ctx.disposed) return;
      ctx.frame.dataset.openingBootstrapStarted = "true";
      if (ctx.reducedMotion.matches && !ctx.debugMode) {
        ctx.frame.dataset.sceneState = "poster";
        ctx.frame.dataset.modelReady = "false";
        ctx.status.textContent = document.documentElement.lang.startsWith("pt")
          ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
          : "3D scene paused by reduced-motion preference. The static scene and navigation remain available.";
        return;
      }

      ctx.renderer = new THREE.WebGLRenderer({ canvas: ctx.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
      ctx.renderer.setClearColor(0x070809, 1);
      ctx.renderer.outputColorSpace = THREE.SRGBColorSpace;
      ctx.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      ctx.renderer.toneMappingExposure = 1.12;

      createStudioLighting(ctx);

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync("/assets/models/chess-knight-006-web.glb");
      if (ctx.disposed) {
        disposeKnightResources(gltf.scene);
        return;
      }
      const source = gltf.scene;
      gltf.scene.updateMatrixWorld(true);
      const world = source.matrixWorld.clone();
      ctx.knight = source.clone(true);
      world.decompose(ctx.knight.position, ctx.knight.quaternion, ctx.knight.scale);
      const bounds = new THREE.Box3().setFromObject(ctx.knight);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const modelScale = BASE_MODEL_SIZE * MODEL_SCALE_FACTOR / Math.max(size.x, size.y, size.z);
      const scaledHeight = size.y * modelScale;
      ctx.knight.position.sub(center).multiplyScalar(modelScale);
      ctx.knight.position.y += scaledHeight / 2;
      ctx.knight.scale.multiplyScalar(modelScale);
      ctx.modelPivot.add(ctx.knight);
      ctx.trackingCenterLocal.copy(findTrackingCenter(ctx, ctx.knight));
      await prepareKnight(ctx, ctx.knight, ctx.homeCapture?.chunkCount ?? 32);
      if (ctx.disposed) return;

      createReflectiveFloor(ctx);

      if (!ctx.debugMode) {
        const openingMode = ctx.openingController.usesVolumetricAssembly;
        if (openingMode) {
          ctx.canvas.hidden = false;
          // Target samples the existing SVG through the camera, so establish the
          // final viewport pose before its geometry is generated.
          resizeScene(ctx);
        }
        ctx.spatialEnvironment = createSpatialEnvironment(ctx.scene, FLOOR_Y, ctx.renderer, ctx.camera, { openingMode });
        if (openingMode) {
          const openingLayersReady = await ctx.spatialEnvironment.prepareOpeningLayers();
          if (!openingLayersReady) {
            ctx.openingController.disableSequence("opening-layer-error");
          } else {
            if (ctx.volumetricMesh) ctx.volumetricMesh.visible = false;
            ctx.volumetricBaseMeshes?.forEach((mesh) => { mesh.visible = false; });
            ctx.volumetricBaseLines?.forEach((line) => { line.visible = false; });
            if (ctx.reflectiveFloor) ctx.reflectiveFloor.visible = false;
            if (ctx.whiteRevealLight) ctx.whiteRevealLight.intensity = 0;
            ctx.assemblyLights.forEach(({ light }) => { light.intensity = 0; });
          }
        }
        homeEnvironment?.setActive(!ctx.openingController.usesVolumetricAssembly);
      }

      ctx.poster.hidden = ctx.debugMode;
      ctx.fallback.hidden = ctx.debugMode;
      ctx.canvas.hidden = ctx.reducedMotion.matches && !ctx.debugMode;
      ctx.frame.dataset.modelReady = "true";
      ctx.frame.dataset.sceneState = ctx.reducedMotion.matches && !ctx.debugMode ? "poster" : "loading";
      ctx.frame.dataset.modelSource = "chess-knight-006-cc-by-4.0";
      ctx.frame.dataset.modelScale = MODEL_SCALE_FACTOR.toFixed(2);
      ctx.frame.dataset.wireframeMode = "edges-threshold-24";
      ctx.frame.dataset.facetShading = "flat";
      ctx.status.textContent = ctx.reducedMotion.matches && !ctx.debugMode
        ? document.documentElement.lang.startsWith("pt")
          ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
          : "3D scene paused by reduced-motion preference. The static scene and navigation remain available."
        : document.documentElement.lang.startsWith("pt")
          ? "Cena 3D ativa. O movimento do ponteiro é opcional; projetos e navegação permanecem disponíveis."
          : "3D scene active. Pointer movement is optional; projects and navigation remain available.";
      resizeScene(ctx);
      ctx.updateSceneProgress();
      if (ctx.homeCapture && ctx.spatialEnvironment) {
        ctx.spatialEnvironment.setWorldVisible(true);
        ctx.spatialEnvironment.setReflectionVisible(true);
        const warmTarget = new THREE.WebGLRenderTarget(1, 1);
        const previousTarget = ctx.renderer.getRenderTarget();
        try {
          ctx.renderer.compile(ctx.scene, ctx.camera);
          ctx.renderer.setRenderTarget(warmTarget);
          ctx.spatialEnvironment.render(ctx.renderer, ctx.camera);
          ctx.renderer.render(ctx.scene, ctx.camera);
        } finally {
          ctx.renderer.setRenderTarget(previousTarget);
          warmTarget.dispose();
          ctx.spatialEnvironment.setReflectionVisible(false);
          ctx.spatialEnvironment.setWorldVisible(false);
        }
      }
      ctx.homeCapture?.bindScene({
        render: renderFrame,
        updateProgress: ctx.updateSceneProgress,
        info: () => ({
          programs: ctx.renderer.info.programs.length,
          calls: ctx.renderer.info.render.calls,
          geometries: ctx.renderer.info.memory.geometries,
          textures: ctx.renderer.info.memory.textures,
          backend: ctx.renderer.getContext().getParameter(ctx.renderer.getContext().RENDERER),
          device: (() => {
            const gl = ctx.renderer.getContext();
            const extension = gl.getExtension("WEBGL_debug_renderer_info");
            return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable";
          })(),
        }),
        dispose,
      });
      ctx.queueFrame();
    } catch (error) {
      if (ctx.disposed) return;
      console.error("Portfolio hero scene unavailable; keeping static model preview.", error);
      setStaticFallback(document.documentElement.lang.startsWith("pt")
        ? "Cena 3D indisponível. O modelo estático, o conteúdo e a navegação continuam disponíveis."
        : "3D scene unavailable. The static model, content, and navigation remain available.");
    }
  }

  return Object.freeze({ dispose });
}

export const homeScene = mountHomeScene();
