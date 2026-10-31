import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { FLOOR_Y } from "./context.js";

export function addStudioLight(ctx, light) {
  ctx.scene.add(light);
  ctx.studioLights.push({ light, parent: ctx.scene, position: light.position.clone() });
}

export function studioLightsAreFixed(ctx) {
  return ctx.studioLights.every(({ light, parent, position }) => (
    parent === ctx.scene && light.parent === ctx.scene && light.position.equals(position)
  ));
}

export function createStudioLighting(ctx) {
  ctx.scene.background = new THREE.Color(0x070809);
  // Both modes use the same fixed rig and silhouette-only material.
  const whiteLight = new THREE.DirectionalLight(0xffffff, 0.65);
  whiteLight.name = "fixed-white-left-light";
  whiteLight.position.set(-4, 2, 5);
  ctx.whiteRevealLight = whiteLight;
  ctx.whiteRevealIntensity = whiteLight.intensity;
  addStudioLight(ctx, whiteLight);
  const redLight = new THREE.DirectionalLight(0xf02a3a, 0.55);
  redLight.name = "fixed-red-right-light";
  redLight.position.set(4, 1.5, 4);
  addStudioLight(ctx, redLight);
  ctx.assemblyLights.push({ light: redLight, intensity: redLight.intensity });
  // Neutral frontal fill light: broad, soft, positioned front-left-above (-1.0, 2.4, 4.6)
  // Recovers cheek, muzzle, neck, chest, and pedestal facets while keeping deep black shadows
  const fillLight = new THREE.DirectionalLight(0xdbe2ec, 0.85);
  fillLight.name = "fixed-neutral-fill-light";
  fillLight.position.set(-1.0, 2.4, 4.6);
  addStudioLight(ctx, fillLight);
  ctx.assemblyLights.push({ light: fillLight, intensity: fillLight.intensity });
  ctx.frame.dataset.studioLightCount = String(ctx.studioLights.length);
  ctx.scene.add(ctx.modelPivot);
  ctx.modelPivot.position.y = FLOOR_Y;
}

export function createReflectiveFloor(ctx) {
  if (ctx.debugMode) return;
  const reflectiveFloor = new Reflector(new THREE.PlaneGeometry(8, 8), {
    clipBias: 0.003,
    textureWidth: 720,
    textureHeight: 480,
    color: 0x898a90,
    multisample: 0,
  });
  reflectiveFloor.rotation.x = -Math.PI / 2;
  reflectiveFloor.position.y = FLOOR_Y;
  if (ctx.homeCapture) {
    ctx.reflectorReflectionUniform.value = 0;
    ctx.reflectorFloorUniform.value = 0;
    reflectiveFloor.material.uniforms.uAssemblyReflectionOpacity = ctx.reflectorReflectionUniform;
    reflectiveFloor.material.uniforms.uAssemblyFloorOpacity = ctx.reflectorFloorUniform;
    reflectiveFloor.material.fragmentShader = reflectiveFloor.material.fragmentShader
      .replace("uniform vec3 color;", "uniform vec3 color;\nuniform float uAssemblyReflectionOpacity;\nuniform float uAssemblyFloorOpacity;")
      .replace(
        "gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );",
        `vec3 reflectionColor = blendOverlay(base.rgb, color);
        float reflectionBrightness = max(max(base.r, base.g), base.b);
        float reflectionMask = smoothstep(0.001, 0.024, reflectionBrightness) * uAssemblyReflectionOpacity;
        gl_FragColor = vec4(reflectionColor, max(reflectionMask, uAssemblyFloorOpacity));`,
      );
    reflectiveFloor.material.transparent = true;
    reflectiveFloor.material.depthWrite = false;
  }
  reflectiveFloor.material.uniforms.uMobileBlur = { value: 0 };
  reflectiveFloor.material.uniforms.uReflectionTexel = { value: new THREE.Vector2(1 / 720, 1 / 480) };
  reflectiveFloor.material.fragmentShader = reflectiveFloor.material.fragmentShader.replace(
    "uniform vec3 color;",
    "uniform vec3 color;\nuniform float uMobileBlur;\nuniform vec2 uReflectionTexel;",
  ).replace("vec4 base = texture2DProj( tDiffuse, vUv );", `
    vec4 base = texture2DProj(tDiffuse, vUv);
    if (uMobileBlur > 0.0) {
      vec2 offset = uReflectionTexel * uMobileBlur * vUv.w;
      base *= 0.4;
      base += texture2DProj(tDiffuse, vUv + vec4(offset.x, 0.0, 0.0, 0.0)) * 0.15;
      base += texture2DProj(tDiffuse, vUv - vec4(offset.x, 0.0, 0.0, 0.0)) * 0.15;
      base += texture2DProj(tDiffuse, vUv + vec4(0.0, offset.y, 0.0, 0.0)) * 0.15;
      base += texture2DProj(tDiffuse, vUv - vec4(0.0, offset.y, 0.0, 0.0)) * 0.15;
    }
  `);
  const renderReflectionWithoutWireOverlay = reflectiveFloor.onBeforeRender;
  reflectiveFloor.onBeforeRender = function (...args) {
    for (const wireframe of ctx.wireframes) wireframe.visible = false;
    ctx.spatialEnvironment?.setReflectionVisible(true);
    try {
      renderReflectionWithoutWireOverlay.apply(this, args);
    } finally {
      ctx.spatialEnvironment?.setReflectionVisible(false);
      for (const wireframe of ctx.wireframes) wireframe.visible = true;
    }
  };
  ctx.scene.add(reflectiveFloor);
  ctx.reflectiveFloor = reflectiveFloor;
}

export function disposeLighting(ctx) {
  if (ctx.lightingDisposed) return;
  ctx.lightingDisposed = true;
  if (ctx.reflectiveFloor) {
    const floor = ctx.reflectiveFloor;
    floor.getRenderTarget().dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    ctx.scene.remove(floor);
    ctx.reflectiveFloor = null;
  }
  for (const { light } of ctx.studioLights) ctx.scene.remove(light);
  ctx.studioLights.length = 0;
}
