import {
  IDLE_ATLAS_FRAGMENT,
  IDLE_BEGIN_VERTEX,
  IDLE_FRAGMENT_DECLARATIONS,
  IDLE_FRAGMENT_LIGHT,
  IDLE_VERTEX_DECLARATIONS,
  createIdleGlyphUv,
} from './shaders/idle.js';
import {
  POINTER_FRAGMENT_ALPHA,
  POINTER_FRAGMENT_DECLARATIONS,
  POINTER_FRAGMENT_LIGHT,
  POINTER_PROJECT_VERTEX,
  POINTER_UV_VERTEX,
  createPointerVertexDeclarations,
} from './shaders/pointer.js';
import {
  TRANSITION_COUNTERPART_DECLARATION,
  TRANSITION_FRAGMENT_ALPHA,
  TRANSITION_FRAGMENT_DECLARATIONS,
  TRANSITION_PROJECT_VERTEX,
  TRANSITION_VERTEX_DECLARATIONS,
} from './shaders/transition.js';
import { createGlyphAtlas } from './core/glyph-atlas.js';

const IDLE_GLYPH_FLIP_RATE = 0.04;
const POINTER_GLYPH_FLIP_BOOST = 0.08;

export function createBinaryRenderer(ctx, glyphs) {
  const { THREE, random, folderRoot, camera, scene } = ctx;
  const { captureEnabled } = ctx.config;
  let idleGlyphMaterials = [];
  let pointerGlyphMaterials = [];
  let glyphMutationSamples = [];

  const glyphAtlas = createGlyphAtlas(THREE);

  function configureGlyphMaterial(material, pointerReactive = false) {
    material.userData.glyphAtlasStyle = { blur: 0 };
    material.userData.transitionValues = material.userData.transitionValues ?? {
      mode: 0,
      progress: 0,
      opacity: 1,
      pointerMultiplier: 1,
      counterpartMatrix: new THREE.Matrix4(),
    };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.idleTime = { value: 0 };
      shader.uniforms.idleStrength = { value: 0 };
      shader.uniforms.transitionMode = { value: material.userData.transitionValues.mode };
      shader.uniforms.transitionProgress = { value: material.userData.transitionValues.progress };
      shader.uniforms.folderOpacity = { value: material.userData.transitionValues.opacity };
      shader.uniforms.glyphAtlasBlur = { value: material.userData.glyphAtlasStyle.blur };
      shader.uniforms.transitionCounterpartMatrix = { value: material.userData.transitionValues.counterpartMatrix };
      material.userData.glyphAtlasUniform = shader.uniforms.glyphAtlasBlur;
      material.userData.idleUniforms = {
        time: shader.uniforms.idleTime,
        strength: shader.uniforms.idleStrength,
      };
      material.userData.transitionUniforms = {
        mode: shader.uniforms.transitionMode,
        progress: shader.uniforms.transitionProgress,
        opacity: shader.uniforms.folderOpacity,
      };
      if (pointerReactive) {
        shader.uniforms.pointerNdc = { value: new THREE.Vector2() };
        shader.uniforms.pointerViewport = { value: new THREE.Vector2(1, 1) };
        shader.uniforms.pointerStrength = { value: 0 };
        material.userData.pointerUniforms = {
          ndc: shader.uniforms.pointerNdc,
          viewport: shader.uniforms.pointerViewport,
          strength: shader.uniforms.pointerStrength,
        };
      }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>${IDLE_VERTEX_DECLARATIONS}${TRANSITION_VERTEX_DECLARATIONS}${createPointerVertexDeclarations(pointerReactive)}`,
        )
        .replace('#include <common>', `#include <common>\n${TRANSITION_COUNTERPART_DECLARATION}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
  float glyphPointerFalloff = 0.0;
  ${pointerReactive ? POINTER_UV_VERTEX : ''}
    glyphHoverLight = glyphPointerFalloff;
  ${createIdleGlyphUv(IDLE_GLYPH_FLIP_RATE, POINTER_GLYPH_FLIP_BOOST)}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
    ${IDLE_BEGIN_VERTEX}`)
        .replace('#include <project_vertex>', `#include <project_vertex>
    ${TRANSITION_PROJECT_VERTEX}
    ${pointerReactive ? POINTER_PROJECT_VERTEX : ''}`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>${TRANSITION_FRAGMENT_DECLARATIONS}${IDLE_FRAGMENT_DECLARATIONS}${POINTER_FRAGMENT_DECLARATIONS}`,
        )
        .replace('#include <map_fragment>', `
    ${IDLE_ATLAS_FRAGMENT}
    ${POINTER_FRAGMENT_LIGHT}
    ${IDLE_FRAGMENT_LIGHT}
    ${TRANSITION_FRAGMENT_ALPHA} * ${POINTER_FRAGMENT_ALPHA};`);
    };
    material.customProgramCacheKey = () => `labs-binary-glyph-atlas-transition-v9-${pointerReactive ? 'pointer' : 'static'}`;
  }

  function setGlyphTransition(material, mode, progress, opacity, pointerMultiplier = 1, counterpartMatrix) {
    const values = material.userData.transitionValues;
    values.mode = mode;
    values.progress = progress;
    values.opacity = opacity;
    values.pointerMultiplier = pointerMultiplier;
    if (counterpartMatrix) values.counterpartMatrix.copy(counterpartMatrix);
    const uniforms = material.userData.transitionUniforms;
    if (!uniforms) return;
    uniforms.mode.value = mode;
    uniforms.progress.value = progress;
    uniforms.opacity.value = opacity;
  }

  function setFolderAtlasBlur(root, amount) {
    const blur = THREE.MathUtils.clamp(amount, 0, 1);
    root.traverse((object) => {
      if (!object.isInstancedMesh) return;
      const style = object.material.userData.glyphAtlasStyle;
      if (!style) return;
      style.blur = blur;
      if (object.material.userData.glyphAtlasUniform) {
        object.material.userData.glyphAtlasUniform.value = blur;
      }
    });
  }

  function setIdleTime(seconds) {
    idleGlyphMaterials.forEach((material) => {
      const uniforms = material.userData.idleUniforms;
      if (!uniforms) return;
      uniforms.time.value = seconds;
      uniforms.strength.value = 1;
    });
  }

  function measureGlyphMutationFraction(seconds) {
    let changed = 0;
    let total = 0;
    const digitAt = (column, phase, rate, time) => {
      const tick = Math.floor(time * (0.35 + rate) + phase * 13.0);
      const value = Math.sin(tick * 12.9898 + phase * 78.233) * 43758.5453;
      const hash = value - Math.floor(value);
      const flip = hash >= 1.0 - IDLE_GLYPH_FLIP_RATE ? 1 : 0;
      return (column + flip) % 2;
    };

    for (const sample of glyphMutationSamples) {
      const { columns, phases, rates } = sample;
      for (let index = 0; index < columns.length; index += 1) {
        if (digitAt(columns[index], phases[index], rates[index], 0)
          !== digitAt(columns[index], phases[index], rates[index], seconds)) changed += 1;
        total += 1;
      }
    }
    return total ? changed / total : 0;
  }

  function addGlyphInstances() {
    const plane = new THREE.PlaneGeometry(1, 1);
    const scratch = new THREE.Object3D();
    const depthOrder = { rear: 1, side: 3, front: 4, 'front-edge': 5 };
    folderRoot.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const projectedGlyphXs = glyphs.map(({ point }) => folderRoot.localToWorld(point.clone()).project(camera).x);
    const projectedGlyphMinX = Math.min(...projectedGlyphXs);
    const projectedGlyphWidth = Math.max(0.000001, Math.max(...projectedGlyphXs) - projectedGlyphMinX);
    let renderGroups = 0;
    const groups = [];

    for (const depth of ['rear', 'side', 'front', 'front-edge']) {
      const atDepth = glyphs.filter((glyph) => glyph.depth === depth);
      if (!atDepth.length) continue;

      const geometry = plane.clone();
      const columns = Float32Array.from(atDepth, (glyph) => glyph.digit);
      const scanOrder = Float32Array.from(atDepth, (glyph) => {
        const projectedX = folderRoot.localToWorld(glyph.point.clone()).project(camera).x;
        return THREE.MathUtils.clamp((projectedX - projectedGlyphMinX) / projectedGlyphWidth, 0, 1);
      });
      const phases = Float32Array.from(atDepth, () => random());
      const rates = Float32Array.from(atDepth, () => 0.35 + random() * 0.8);
      geometry.setAttribute('glyphColumn', new THREE.InstancedBufferAttribute(
        columns,
        1,
      ));
      geometry.setAttribute('pulsePhase', new THREE.InstancedBufferAttribute(
        phases,
        1,
      ));
      geometry.setAttribute('pulseRate', new THREE.InstancedBufferAttribute(
        rates,
        1,
      ));
      geometry.setAttribute('glyphScanOrder', new THREE.InstancedBufferAttribute(
        scanOrder,
        1,
      ));
      if (captureEnabled) glyphMutationSamples.push({ columns, phases, rates });
      const material = new THREE.MeshBasicMaterial({
        map: glyphAtlas,
        transparent: true,
        opacity: depth === 'rear' ? 0.68 : depth === 'front-edge' ? 0.94 : 0.98,
        depthWrite: true,
        alphaTest: 0.025,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const pointerReactive = depth === 'front' || depth === 'front-edge';
      configureGlyphMaterial(material, pointerReactive);
      if (pointerReactive) pointerGlyphMaterials.push(material);
      idleGlyphMaterials.push(material);

      const instances = new THREE.InstancedMesh(geometry, material, atDepth.length);
      instances.name = `binary-glyphs-${depth}`;
      instances.renderOrder = depthOrder[depth];
      instances.frustumCulled = false;
      atDepth.forEach((glyph, index) => {
        scratch.position.copy(glyph.point);
        scratch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), glyph.normal);
        scratch.scale.set(glyph.width, glyph.height, 1);
        scratch.updateMatrix();
        instances.setMatrixAt(index, scratch.matrix);
        instances.setColorAt(index, glyph.color);
      });
      instances.instanceMatrix.needsUpdate = true;
      if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
      folderRoot.add(instances);
      groups.push(instances);
      renderGroups += 1;
    }

    plane.dispose();
    return { groups, renderGroups };
  }

  function addNextFolderDepth({ previewPosition, previewScale, getProjectedPreviewPosition, geometryDebugScaffolds }) {
    const nextRoot = folderRoot.clone(true);
    nextRoot.name = 'next-folder-root';
    nextRoot.position.copy(previewPosition);
    nextRoot.scale.copy(previewScale);
    let glyphGroupCount = 0;

    nextRoot.traverse((object) => {
      if (object.userData.depthOccluder) return;
      if (object.userData.geometryDebugScaffold) {
        object.material = object.material.clone();
        geometryDebugScaffolds.push(object);
        return;
      }
      if (object.isInstancedMesh) {
        const material = object.material.clone();
        material.userData = {};
        const pointerReactive = object.name === 'binary-glyphs-front' || object.name === 'binary-glyphs-front-edge';
        configureGlyphMaterial(material, pointerReactive);
        object.material = material;
        idleGlyphMaterials.push(material);
        if (pointerReactive) pointerGlyphMaterials.push(material);
        glyphGroupCount += 1;
        return;
      }

      if (object.isMesh && object.material?.uniforms?.uPresence) {
        object.material = object.material.clone();
        object.material.uniforms.uPresence.value = 1;
        return;
      }

      if (object.isLineSegments && object.material?.isLineBasicMaterial) {
        object.material = object.material.clone();
        object.userData.baseOpacity = object.material.opacity;
      }
    });
    scene.add(nextRoot);
    nextRoot.position.copy(getProjectedPreviewPosition(nextRoot, previewPosition, previewScale, folderRoot));
    nextRoot.userData.glyphGroupCount = glyphGroupCount;
    return nextRoot;
  }

  return {
    glyphAtlas,
    get idleMaterials() { return idleGlyphMaterials; },
    get pointerMaterials() { return pointerGlyphMaterials; },
    addGlyphInstances,
    addNextFolderDepth,
    setTransition: setGlyphTransition,
    setBlur: setFolderAtlasBlur,
    setIdleTime,
    setIdleStrength(strength) {
      idleGlyphMaterials.forEach((material) => {
        if (material.userData.idleUniforms) material.userData.idleUniforms.strength.value = strength;
      });
    },
    measureGlyphMutationFraction,
    dispose() { glyphAtlas.dispose(); },
  };
}
