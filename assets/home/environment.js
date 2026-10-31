import * as THREE from "three";
import { homeCapture } from "../home-capture.js";

function createObsidianGeometry(width, height, depth, cut) {
  const x = width / 2;
  const z = depth / 2;
  const bevel = Math.min(width, depth) * 0.12;
  const perimeter = [
    [-x + bevel, -z], [x - bevel, -z], [x, -z + bevel], [x, z - bevel],
    [x - bevel, z], [-x + bevel, z], [-x, z - bevel], [-x, -z + bevel],
  ];
  const rings = [
    perimeter.map(([px, pz]) => [px, 0, pz]),
    perimeter.map(([px, pz]) => [px, height - bevel * 1.5 + px * cut, pz]),
    perimeter.map(([px, pz]) => [px * 0.86, height + px * cut, pz * 0.86]),
  ];
  const positions = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < perimeter.length; i++) {
      const next = (i + 1) % perimeter.length;
      positions.push(
        ...rings[ring][i], ...rings[ring + 1][i], ...rings[ring][next],
        ...rings[ring][next], ...rings[ring + 1][i], ...rings[ring + 1][next],
      );
    }
  }
  for (let i = 1; i < perimeter.length - 1; i++) {
    positions.push(...rings[2][0], ...rings[2][i + 1], ...rings[2][i]);
    positions.push(...rings[0][0], ...rings[0][i], ...rings[0][i + 1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createReflectionMap(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x020202);
  const panels = [
    { position: [-4, 2, 3], size: [1.1, 6], color: 0xc5c9cf, intensity: 2.4 },
    { position: [-1.5, 1, 6], size: [3, 3.5], color: 0x8d9095, intensity: 1.2 },
    { position: [3, 3, 2], size: [0.35, 5], color: 0x858990, intensity: 1.3 },
    { position: [0, 5, -2], size: [5, 0.7], color: 0x74777e, intensity: 1.1 },
    { position: [5, 0.5, -1], size: [0.16, 4], color: 0xe71930, intensity: 1.5 },
  ];
  for (const panel of panels) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...panel.size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(panel.color).multiplyScalar(panel.intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...panel.position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const map = generator.fromScene(studio, 0.035, 0.1, 30, { size: 128 });
  generator.dispose();
  for (const panel of studio.children) {
    panel.geometry.dispose();
    panel.material.dispose();
  }
  return map;
}

function createSignalPoints(positions, color, opacity = 0.8) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aStrength", new THREE.Float32BufferAttribute(positions.filter((_, index) => index % 3 === 0).map(() => 1), 1));
  return new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      attribute float aStrength;
      varying float vStrength;
      void main() {
        vStrength = aStrength;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(85.0 / -viewPosition.z, 6.0, 15.0) * mix(0.65, 1.0, aStrength);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vStrength;
      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.04, 0.22, radius);
        float halo = exp(-radius * 7.5) * (1.0 - smoothstep(0.65, 1.0, radius));
        vec3 color = uColor * (1.0 + core * 0.2);
        float alpha = min(1.0, core * step(0.98, vStrength) + halo * 0.16 * vStrength);
        gl_FragColor = vec4(color, alpha * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
}

function projectedPathLength(geometry, camera, width, height, scaleX = 1) {
  const positions = geometry.attributes.position;
  const previous = new THREE.Vector3();
  const current = new THREE.Vector3();
  let length = 0;
  for (let index = 0; index < positions.count; index++) {
    current.fromBufferAttribute(positions, index);
    current.x *= scaleX;
    current.project(camera);
    current.x *= width / 2;
    current.y *= height / 2;
    if (index) length += Math.hypot(current.x - previous.x, current.y - previous.y);
    previous.copy(current);
  }
  return length;
}

function createEdgeSignal(points) {
  const path = new THREE.CurvePath();
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    path.add(new THREE.LineCurve3(points[i - 1], points[i]));
    distances.push(distances[i - 1] + points[i - 1].distanceTo(points[i]));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(distances.map((distance) => distance / path.getLength()), 1));
  const line = new THREE.Line(geometry, new THREE.ShaderMaterial({
    uniforms: { uHead: { value: 0 }, uOpacity: { value: 0 }, uPersist: { value: 0 } },
    vertexShader: `
      attribute float aAlong;
      varying float vAlong;
      void main() {
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uHead;
      uniform float uOpacity;
      uniform float uPersist;
      varying float vAlong;
      void main() {
        float tail = uHead - vAlong;
        float movingFront = smoothstep(-0.004, 0.008, tail) * (1.0 - smoothstep(0.02, 0.13, tail));
        float tracedPath = step(vAlong, uHead);
        float alpha = mix(movingFront, tracedPath, uPersist);
        gl_FragColor = vec4(1.35, 0.012, 0.035, alpha * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const trail = createSignalPoints(new Array(36).fill(0), 0xff1230, 0);
  trail.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < 12; i++) trail.geometry.attributes.aStrength.setX(i, (1 - i / 12) ** 2);
  trail.frustumCulled = false;
  return {
    path, line, trail,
    duration: 1,
  };
}

function createFloorStreak(position) {
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 1.1), new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float width = exp(-abs(vUv.x - 0.5) * 22.0);
        float lengthFade = pow(vUv.y, 2.0) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        gl_FragColor = vec4(1.35, 0.012, 0.04, width * lengthFade * uOpacity * 0.6);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  streak.rotation.x = -Math.PI / 2;
  streak.position.copy(position);
  streak.position.z += 0.62;
  return streak;
}

export function createSpatialEnvironment(scene, floorY, renderer, camera, { openingMode = false } = {}) {
  const backgroundScene = new THREE.Scene();
  backgroundScene.background = new THREE.Color(0x070809);
  backgroundScene.fog = new THREE.Fog(0x070809, 7, 15);
  for (const light of scene.children.filter((object) => object.isLight)) {
    backgroundScene.add(light.clone());
  }
  const group = new THREE.Group();
  group.name = "obsidian-background";
  backgroundScene.add(group);
  const signalGroup = new THREE.Group();
  signalGroup.name = "ephemeral-edge-lights";
  scene.add(signalGroup);
  const signals = [];
  const reflectionMap = createReflectionMap(renderer);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x0c0d0f,
    metalness: 0.12,
    roughness: 0.20,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    envMap: reflectionMap.texture,
    envMapIntensity: 1.05,
    flatShading: true,
  });
  // The center stays open; overlapping flanks establish three distances.
  const columns = [
    { position: [-2.75, -4.8], size: [0.65, 3.0, 0.65], rotation: -0.08, cut: -0.16 },
    { position: [2.7, -4.6], size: [0.8, 2.85, 0.7], rotation: 0.12, cut: 0.18 },
    { position: [-1.85, -3.1], size: [0.5, 2.35, 0.6], rotation: 0.06, cut: -0.24 },
    { position: [1.8, -3.0], size: [0.65, 2.1, 0.6], rotation: -0.14, cut: 0.18 },
    { position: [-2.45, -2.1], size: [0.72, 1.65, 0.7], rotation: -0.12, cut: 0.12 },
    { position: [2.7, -1.9], size: [0.85, 1.7, 0.75], rotation: 0.08, cut: -0.15 },
    { position: [-1.5, -1.4], size: [0.58, 0.68, 0.7], rotation: 0.05, cut: -0.12 },
    { position: [1.5, -1.25], size: [0.72, 0.9, 0.7], rotation: -0.12, cut: 0.16 },
    { position: [3.65, -3.2], size: [0.65, 2.9, 0.6], rotation: -0.1, cut: -0.18 },
  ];
  const monoliths = [];
  const columnDetails = [];
  const monolithOutlines = [];
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x9ca0a8, transparent: true, opacity: 0.05, depthWrite: false,
  });
  const whiteAnchors = [];
  const guidePositions = [];
  for (const column of columns) {
    const geometry = createObsidianGeometry(...column.size, column.cut);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(column.position[0], floorY, column.position[1]);
    mesh.rotation.y = column.rotation;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), edgeMaterial));
    group.add(mesh);
    monoliths.push(mesh);
    const bevel = Math.min(column.size[0], column.size[2]) * 0.12;
    const edgeX = -column.size[0] / 2 + bevel;
    mesh.updateMatrix();
    const anchor = new THREE.Vector3(
      edgeX, column.size[1] - bevel * 1.5 + edgeX * column.cut, column.size[2] / 2 + 0.008,
    ).applyMatrix4(mesh.matrix);
    whiteAnchors.push(...anchor.toArray());
    guidePositions.push(anchor.x, floorY, anchor.z, anchor.x, anchor.y + 0.35, anchor.z);
    const baseLeft = new THREE.Vector3(anchor.x, floorY + 0.016, anchor.z);
    const topRight = new THREE.Vector3(
      -edgeX, column.size[1] - bevel * 1.5 - edgeX * column.cut, column.size[2] / 2 + 0.008,
    ).applyMatrix4(mesh.matrix);
    const baseRight = new THREE.Vector3(topRight.x, floorY + 0.016, topRight.z);
    const signal = createEdgeSignal([baseLeft, anchor, topRight, baseRight]);
    signal.streak = createFloorStreak(baseLeft);
    signals.push(signal);
    const backRight = new THREE.Vector3(
      -edgeX, column.size[1] - bevel * 1.5 - edgeX * column.cut, -column.size[2] / 2,
    ).applyMatrix4(mesh.matrix);
    const outline = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([baseLeft, anchor, anchor, topRight, topRight, baseRight, topRight, backRight]),
      new THREE.LineBasicMaterial({
        color: 0xa9aeb5, transparent: true,
        opacity: 0.06 + 0.1 * Math.max(0, 1 + column.position[1] / 5), depthWrite: false,
      }),
    );
    monolithOutlines.push(outline);
    const detail = new THREE.Group();
    detail.add(signal.line, signal.trail, outline);
    columnDetails.push(detail);
    signalGroup.add(detail);
  }
  const guides = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(guidePositions, 3)),
    new THREE.LineBasicMaterial({ color: 0x8a8b90, transparent: true, opacity: 0.07, depthWrite: false }),
  );
  group.add(guides);
  const monolithAnchorPoints = createSignalPoints(whiteAnchors, 0xbec2c9, 0.3);
  signalGroup.add(monolithAnchorPoints);

  // Only distant architecture enters this depth-of-field pass.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(1, 1),
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 40 },
      uBlur: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uTexel;
      uniform float uNear;
      uniform float uFar;
      uniform float uBlur;
      varying vec2 vUv;
      void main() {
        float depth = texture2D(tDepth, vUv).x;
        float distanceToCamera = -perspectiveDepthToViewZ(depth, uNear, uFar);
        float radius = mix(0.65, 3.8, smoothstep(5.5, 10.0, distanceToCamera)) * uBlur;
        vec2 stepSize = uTexel * radius;
        vec3 color = texture2D(tColor, vUv).rgb * 0.2;
        color += texture2D(tColor, vUv + vec2(stepSize.x, 0.0)).rgb * 0.12;
        color += texture2D(tColor, vUv - vec2(stepSize.x, 0.0)).rgb * 0.12;
        color += texture2D(tColor, vUv + vec2(0.0, stepSize.y)).rgb * 0.12;
        color += texture2D(tColor, vUv - vec2(0.0, stepSize.y)).rgb * 0.12;
        color += texture2D(tColor, vUv + stepSize).rgb * 0.08;
        color += texture2D(tColor, vUv - stepSize).rgb * 0.08;
        color += texture2D(tColor, vUv + vec2(stepSize.x, -stepSize.y)).rgb * 0.08;
        color += texture2D(tColor, vUv + vec2(-stepSize.x, stepSize.y)).rgb * 0.08;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  }));
  backdrop.name = "obsidian-depth-of-field";
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -100;
  backdrop.raycast = () => {};
  scene.add(backdrop);
  // Travelling Crimson Signal Pulses (Section 5)
  const paths = [
    // 0: Vertical edge behind the knight
    [new THREE.Vector3(-1.72, floorY, -2.34), new THREE.Vector3(-1.72, 1.7, -2.34)],
    // 1: Horizontal floor edge
    [new THREE.Vector3(-3.2, floorY + 0.008, 0.8), new THREE.Vector3(3.0, floorY + 0.008, 0.8)],
    // 2: Circular construction arc
    Array.from({ length: 65 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 1.45;
      return new THREE.Vector3(
        Math.cos(angle) * 1.15,
        floorY + 0.95 + Math.sin(angle) * 1.15,
        -1.3
      );
    }),
    // 3: Edge of background monolith on the right
    [
      new THREE.Vector3(1.56, floorY, -1.97),
      new THREE.Vector3(1.56, 1.10, -1.97),
      new THREE.Vector3(2.15, 1.10, -1.97),
    ],
    // 4: Horizontal guide pulse
    [new THREE.Vector3(0.8, 1.4, -3.0), new THREE.Vector3(2.8, 1.4, -3.0)],
  ];

  const pulseMaterials = [];
  const pulses = paths.map((points, index) => {
    const pathGeo = new THREE.BufferGeometry().setFromPoints(points);
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    }
    const totalDist = distances[distances.length - 1];
    pathGeo.setAttribute(
      "aAlong",
      new THREE.Float32BufferAttribute(
        distances.map((d) => d / totalDist),
        1
      )
    );

    const pulseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPeriod: { value: [13, 19, 23, 17, 21][index] },
        uOffset: { value: [0, 6, 14, 4, 10][index] },
      },
      vertexShader: `
        attribute float aAlong;
        varying float vAlong;
        void main() {
          vAlong = aAlong;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPeriod;
        uniform float uOffset;
        varying float vAlong;
        void main() {
          float phase = mod(uTime + uOffset, uPeriod) / 3.0;
          if (phase > 1.0) discard;

          float tail = phase * 1.18 - vAlong;
          float alpha = smoothstep(0.0, 0.022, tail) * (1.0 - smoothstep(0.028, 0.17, tail)) * sin(phase * 3.14159);
          float head = (1.0 - smoothstep(0.0, 0.015, tail)) * step(0.0, tail) * sin(phase * 3.14159);
          alpha = max(alpha, head);
          if (alpha < 0.008) discard;

          gl_FragColor = vec4(1.0, 0.08, 0.15, alpha * 0.95);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    pulseMaterials.push(pulseMaterial);
    const pulseLine = new THREE.Line(pathGeo, pulseMaterial);
    signalGroup.add(pulseLine);
    return pulseLine;
  });

  const reflectionGroup = group.clone(true);
  const reflectionSignals = signalGroup.clone(true);
  reflectionGroup.add(reflectionSignals);
  reflectionGroup.visible = false;
  scene.add(reflectionGroup);

  const floorGroup = new THREE.Group();
  floorGroup.name = "obsidian-floor-guides";
  const floorPositions = [];
  for (let i = -7; i <= 7; i++) {
    floorPositions.push(i * 0.68, floorY + 0.006, -5, i * 0.68, floorY + 0.006, 3.2);
    if (i >= -6 && i <= 5) floorPositions.push(-5, floorY + 0.006, i * 0.7, 5, floorY + 0.006, i * 0.7);
  }
  const floorGrid = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(floorPositions, 3)),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.13 } },
      vertexShader: `
        varying float vDepth;
        void main() {
          vDepth = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vDepth;
        void main() {
          float fade = smoothstep(-4.8, -0.5, vDepth) * (1.0 - smoothstep(1.0, 3.3, vDepth));
          gl_FragColor = vec4(0.30, 0.32, 0.35, fade * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    }),
  );
  floorGroup.add(floorGrid);
  signals.forEach((signal) => floorGroup.add(signal.streak));
  for (const endpoints of [
    [[-3.4, floorY + 0.018, 0.7], [2.72, floorY + 0.018, 0.7]],
    [[2.04, floorY + 0.018, -2.8], [2.04, floorY + 0.018, 2.8]],
    [[-1.36, floorY + 0.018, -3.5], [-1.36, floorY + 0.018, 2.1]],
  ]) {
    const signal = createEdgeSignal(endpoints.map((point) => new THREE.Vector3(...point)));
    signals.push(signal);
    floorGroup.add(signal.line, signal.trail);
  }
  scene.add(floorGroup);
  const bufferSize = new THREE.Vector2();
  let limited = false;
  let mobileMode = false;
  let layoutInitialized = false;
  const mobileColumns = [4, 5, 6, 7];
  const svgSignals = Array.from(document.querySelectorAll(".construction-neon"));
  const pulseOffset = signals.length;
  const svgOffset = pulseOffset + pulses.length;
  const effectCount = svgOffset + svgSignals.length;
  const targetCaptureMode = homeCapture?.focusLayer === "target"
    && window.matchMedia("(min-width: 701px)").matches;
  const obsidianCaptureMode = homeCapture?.focusLayer === "obsidian"
    && window.matchMedia("(min-width: 701px)").matches;
  const floorCaptureMode = homeCapture?.focusLayer === "floor"
    && window.matchMedia("(min-width: 701px)").matches;
  let openingModeActive = openingMode;
  let targetAnimation = null;
  let targetAnimationPromise = null;
  let targetTime = 0;
  let targetVisible = false;
  let obsidianAnimation = null;
  let obsidianAnimationPromise = null;
  let obsidianTime = 0;
  let floorAnimation = null;
  let floorAnimationPromise = null;
  let floorTime = 0;
  function ensureTargetAnimation() {
    if ((!targetCaptureMode && !openingModeActive) || disposed) return null;
    if (targetAnimation) return Promise.resolve(targetAnimation);
    if (!targetAnimationPromise) {
      targetAnimationPromise = import("./target-animation.js").then(({ createTargetAnimation }) => {
        if (disposed || (!targetCaptureMode && !openingModeActive)) return null;
        targetAnimation = createTargetAnimation(
          document.querySelector(".construction-map"), renderer, camera, scene,
          { includeStaticConstruction: openingModeActive },
        );
        if (!targetAnimation) {
          document.querySelector("#scene-frame").dataset.targetCaptureError = "Target layer could not initialize.";
          return null;
        }
        targetAnimation.setTime(targetTime);
        targetAnimation.setVisible(targetVisible);
        document.querySelector("#scene-frame").dataset.targetCaptureReady = "true";
        return targetAnimation;
      }).catch((error) => {
        document.querySelector("#scene-frame").dataset.targetCaptureError = error.message;
        console.error("[Home Target] initialization failed", error);
        return null;
      });
    }
    return targetAnimationPromise;
  }
  function ensureObsidianAnimation() {
    if ((!obsidianCaptureMode && !openingModeActive) || disposed) return null;
    if (obsidianAnimation) return Promise.resolve(obsidianAnimation);
    if (!obsidianAnimationPromise) {
      obsidianAnimationPromise = import("./obsidian-background-animation.js").then(({ createObsidianBackgroundAnimation }) => {
        if (disposed || (!obsidianCaptureMode && !openingModeActive)) return null;
        obsidianAnimation = createObsidianBackgroundAnimation({
          monoliths,
          signals,
          outlines: monolithOutlines,
          anchorPoints: monolithAnchorPoints,
        });
        if (!obsidianAnimation) {
          document.querySelector("#scene-frame").dataset.obsidianCaptureError = "Obsidian layer could not initialize.";
          return null;
        }
        obsidianAnimation.setTime(obsidianTime);
        document.querySelector("#scene-frame").dataset.obsidianCaptureReady = "true";
        return obsidianAnimation;
      }).catch((error) => {
        document.querySelector("#scene-frame").dataset.obsidianCaptureError = error.message;
        console.error("[Home Obsidian] initialization failed", error);
        return null;
      });
    }
    return obsidianAnimationPromise;
  }
  function ensureFloorAnimation() {
    if ((!floorCaptureMode && !openingModeActive) || disposed) return null;
    if (floorAnimation) return Promise.resolve(floorAnimation);
    if (!floorAnimationPromise) {
      floorAnimationPromise = import("./floor-animation.js").then(({ createFloorAnimation }) => {
        if (disposed || (!floorCaptureMode && !openingModeActive)) return null;
        floorAnimation = createFloorAnimation({ floorGrid, signals: signals.slice(-3) });
        if (!floorAnimation) {
          document.querySelector("#scene-frame").dataset.floorCaptureError = "Floor layer could not initialize.";
          return null;
        }
        floorAnimation.setTime(floorTime);
        document.querySelector("#scene-frame").dataset.floorCaptureReady = "true";
        return floorAnimation;
      }).catch((error) => {
        document.querySelector("#scene-frame").dataset.floorCaptureError = error.message;
        console.error("[Home Floor] initialization failed", error);
        return null;
      });
    }
    return floorAnimationPromise;
  }
  let activeEffect = null;
  let lastEffectIndex = -1;
  let nextEffectAt = 0;
  let shownEffectIndex = -1;
  let calibratedWidth = 0;
  let calibratedHeight = 0;
  let calibratedMobile = null;
  let nextReconstructionAt = null;
  let reconstructionStartedAt = -Infinity;
  let disposed = false;
  let worldVisible = true;
  let showingReflection = false;
  let floorVisible = true;

  function syncWorldVisibility() {
    backdrop.visible = worldVisible && !showingReflection;
    reflectionGroup.visible = worldVisible && showingReflection;
    signalGroup.visible = worldVisible && !showingReflection;
    floorGroup.visible = floorCaptureMode
      ? floorVisible
      : worldVisible && !showingReflection && floorVisible;
  }
  const pulseDurations = [];
  const point = new THREE.Vector3();

  return {
    group,
    setLimited(value, mobile = false) {
      if (layoutInitialized && limited === value && mobileMode === mobile) return;
      limited = value;
      mobileMode = mobile;
      layoutInitialized = true;
      material.envMapIntensity = mobile ? 0.4 : 1.05;
      material.roughness = mobile ? 0.28 : 0.20;
      material.clearcoat = mobile ? 0.55 : 0.75;
      monoliths.forEach((mesh, index) => {
        mesh.visible = mobile ? mobileColumns.includes(index) : !value || index < 6;
        // Mobile keeps reflected edges and signals, avoiding bright solid monolith patches.
        reflectionGroup.children[index].visible = mesh.visible && !mobile;
        columnDetails[index].visible = mesh.visible;
        reflectionSignals.children[index].visible = mesh.visible;
        signals[index].streak.visible = mesh.visible;
      });
      backdrop.material.uniforms.uBlur.value = value ? 0.65 : 1;
      floorGrid.material.uniforms.uOpacity.value = value ? 0.07 : 0.13;
      pulses.forEach((pulse, index) => { pulse.visible = !value || index === 1 || (mobile && index === 2); });
    },
    update(timestamp, environment) {
      if (disposed || !environment) return;
      targetAnimation?.updatePointer();
      this.setLimited(environment.limited, Boolean(environment.mobile));
      const scaleX = mobileMode ? 0.72 : 1;
      group.scale.x = signalGroup.scale.x = reflectionGroup.scale.x = floorGroup.scale.x = scaleX;
      environment.element.dataset.monolithCount = String(monoliths.filter((mesh) => mesh.visible).length);
      const { clientWidth: width, clientHeight: height } = renderer.domElement;
      if (!width || !height) return;
      if (width !== calibratedWidth || height !== calibratedHeight || mobileMode !== calibratedMobile) {
        camera.updateMatrixWorld(true);
        // Match the existing left-to-right floor pulse in screen pixels per second.
        const speed = projectedPathLength(pulses[1].geometry, camera, width, height, scaleX) * 1.18 / 3;
        for (const signal of signals) {
          signal.duration = projectedPathLength(signal.line.geometry, camera, width, height, scaleX) / speed;
        }
        pulses.forEach((pulse, index) => {
          pulseDurations[index] = projectedPathLength(pulse.geometry, camera, width, height, scaleX) * 1.18 / speed;
        });
        for (const element of svgSignals) {
          const path = element.querySelector(".neon-rail");
          const matrix = path.getScreenCTM();
          if (!matrix) continue;
          const duration = path.getTotalLength() * Math.hypot(matrix.a, matrix.b) / speed;
          element.style.setProperty("--signal-duration", `${duration}s`);
        }
        calibratedWidth = width;
        calibratedHeight = height;
        calibratedMobile = mobileMode;
      }
      if (obsidianCaptureMode) {
        obsidianAnimation?.setTime(obsidianTime);
        group.position.x = limited ? 0 : environment.pointer.x * 0.035;
        group.position.z = limited ? 0 : environment.pointer.y * 0.025;
        signalGroup.position.copy(group.position);
        floorGroup.position.set(0, 0, 0);
        return;
      }
      if (floorCaptureMode) {
        floorAnimation?.setTime(floorTime);
        group.position.set(0, 0, 0);
        signalGroup.position.set(0, 0, 0);
        floorGroup.position.set(0, 0, 0);
        syncWorldVisibility();
        return;
      }
      if (openingModeActive) {
        targetAnimation?.updatePointer();
        group.position.x = limited ? 0 : environment.pointer.x * 0.035;
        group.position.z = limited ? 0 : environment.pointer.y * 0.025;
        signalGroup.position.copy(group.position);
        reflectionGroup.position.copy(group.position);
        floorGroup.position.set(0, 0, 0);
        syncWorldVisibility();
        return;
      }
      const eligible = [];
      for (let index = 0; index < effectCount; index++) {
        if ((index < monoliths.length && !monoliths[index].visible)
          || (limited && ((index >= pulseOffset && index < svgOffset && index !== pulseOffset + 1 && !(mobileMode && index === pulseOffset + 2))
          || index >= svgOffset))) continue;
        eligible.push(index);
      }
      if (!environment.animating || (activeEffect && (
        timestamp >= activeEffect.startedAt + activeEffect.duration
        || !eligible.includes(activeEffect.index)
      ))) {
        activeEffect = null;
      }
      if (environment.animating && !activeEffect && timestamp >= nextEffectAt) {
        const choices = eligible.filter((index) => index !== lastEffectIndex);
        const index = choices[Math.floor((homeCapture?.random ?? Math.random)() * choices.length)];
        const duration = index < pulseOffset ? signals[index].duration * 1000
          : index < svgOffset ? pulseDurations[index - pulseOffset] * 1000
            : parseFloat(svgSignals[index - svgOffset].style.getPropertyValue("--signal-duration")) * 1000;
        activeEffect = { index, startedAt: timestamp, duration, rate: 3000 / duration };
        lastEffectIndex = index;
        const quietGap = (700 + (homeCapture?.random ?? Math.random)() * 1600) * (mobileMode ? 1 + environment.phase.coherence * 0.7 : 1);
        nextEffectAt = timestamp + duration + quietGap;
      }
      const effectIndex = activeEffect?.index ?? -1;
      if (effectIndex !== shownEffectIndex) {
        svgSignals.forEach((element, index) => element.classList.toggle("is-signal-active", effectIndex === svgOffset + index));
        environment.element.dataset.activeSignal = String(effectIndex);
        shownEffectIndex = effectIndex;
      }
      for (const [index, pulse] of pulseMaterials.entries()) {
        const age = effectIndex === pulseOffset + index
          ? (timestamp - activeEffect.startedAt) / 1000 * activeEffect.rate : 4;
        // Inactive pulses stay beyond the original shader's three-second visible window.
        pulse.uniforms.uTime.value = age - pulse.uniforms.uOffset.value;
      }
      for (const [index, signal] of signals.entries()) {
        const head = effectIndex === index
          ? Math.min(1, (timestamp - activeEffect.startedAt) / activeEffect.duration) : 1;
        const fade = THREE.MathUtils.smoothstep(head, 0, 0.05)
          * (1 - THREE.MathUtils.smoothstep(head, 0.94, 1));
        signal.line.material.uniforms.uHead.value = head;
        signal.line.material.uniforms.uOpacity.value = fade * 0.9;
        signal.line.material.uniforms.uPersist.value = 0;
        signal.trail.material.uniforms.uOpacity.value = fade;
        const positions = signal.trail.geometry.attributes.position;
        const strengths = signal.trail.geometry.attributes.aStrength;
        for (let i = 0; i < 12; i++) {
          const along = head - i * 0.009;
          signal.path.getPoint(Math.max(0, along), point);
          positions.setXYZ(i, point.x, point.y, point.z);
          strengths.setX(i, along < 0 ? 0 : (1 - i / 12) ** 2);
        }
        positions.needsUpdate = true;
        strengths.needsUpdate = true;
        if (signal.streak) {
          signal.streak.material.uniforms.uOpacity.value = fade * (0.15 + 0.65 * Math.cos(head * Math.PI) ** 8);
        }
      }
      const progression = environment.progress ?? 0;
      if (nextReconstructionAt === null) nextReconstructionAt = timestamp + 13000;
      if (mobileMode && environment.animating && environment.phase.coherence < 1 && timestamp >= nextReconstructionAt) {
        reconstructionStartedAt = timestamp;
        nextReconstructionAt = timestamp + 22000 + (homeCapture?.random ?? Math.random)() * 14000;
      }
      const age = timestamp - reconstructionStartedAt;
      const shear = mobileMode && environment.animating && age < 260 ? Math.sin(age / 260 * Math.PI) * 0.022 : 0;
      for (const [index, mesh] of monoliths.entries()) {
        const offsetX = mobileMode ? (1 - progression) * (index % 2 ? 0.012 : -0.012) + (index === 5 ? shear : 0) : 0;
        const offsetY = mobileMode ? (progression - 0.5) * (index < 6 ? 0.018 : 0.034) : 0;
        mesh.position.set(columns[index].position[0] + offsetX, floorY + offsetY, columns[index].position[1]);
        columnDetails[index].position.set(offsetX, offsetY, 0);
        reflectionGroup.children[index].position.copy(mesh.position);
        reflectionSignals.children[index].position.copy(columnDetails[index].position);
      }
      group.position.x = mobileMode ? environment.pointer.x * 0.16 : limited ? 0 : environment.pointer.x * 0.035;
      group.position.y = mobileMode ? (progression - 0.5) * 0.055 : 0;
      group.position.z = mobileMode ? environment.pointer.y * 0.12 : limited ? 0 : environment.pointer.y * 0.025;
      signalGroup.position.copy(group.position);
      reflectionGroup.position.copy(group.position);
      floorGroup.position.set(mobileMode ? group.position.x * 0.2 : 0, 0, mobileMode ? group.position.z * 0.2 : 0);
    },
    render(renderer, camera) {
      if (disposed) return;
      if (targetCaptureMode || floorCaptureMode) return;
      renderer.getDrawingBufferSize(bufferSize);
      const scale = limited ? 0.45 : 0.65;
      const width = Math.max(1, Math.round(bufferSize.x * scale));
      const height = Math.max(1, Math.round(bufferSize.y * scale));
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height);
        backdrop.material.uniforms.uTexel.value.set(1 / width, 1 / height);
      }
      backdrop.material.uniforms.uNear.value = camera.near;
      backdrop.material.uniforms.uFar.value = camera.far;
      const previousTarget = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(backgroundScene, camera);
      } finally {
        renderer.setRenderTarget(previousTarget);
      }
    },
    setReflectionVisible(visible) {
      showingReflection = visible;
      syncWorldVisibility();
    },
    setWorldVisible(visible) {
      worldVisible = visible;
      syncWorldVisibility();
    },
    setFloorVisible(visible) {
      floorVisible = Boolean(visible);
      syncWorldVisibility();
    },
    async prepareOpeningLayers() {
      if (!openingModeActive) return false;
      this.setWorldVisible(false);
      this.setFloorVisible(false);
      this.setReflectionVisible(false);
      this.setTargetVisible(true);
      const results = await Promise.all([
        ensureTargetAnimation(),
        ensureObsidianAnimation(),
        ensureFloorAnimation(),
      ]);
      return !disposed && results.every(Boolean);
    },
    disableOpeningLayers() {
      if (!openingModeActive || disposed) return;
      openingModeActive = false;
      targetAnimation?.dispose();
      obsidianAnimation?.dispose();
      floorAnimation?.dispose();
      targetAnimation = null;
      obsidianAnimation = null;
      floorAnimation = null;
      targetVisible = false;
      this.setWorldVisible(true);
      this.setFloorVisible(true);
      this.setReflectionVisible(false);
    },
    setTargetTime(localSeconds) {
      targetTime = localSeconds;
      targetAnimation?.setTime(targetTime);
      ensureTargetAnimation();
    },
    setTargetVisible(visible) {
      targetVisible = Boolean(visible);
      targetAnimation?.setVisible(targetVisible);
      ensureTargetAnimation();
    },
    setObsidianTime(localSeconds) {
      obsidianTime = localSeconds;
      obsidianAnimation?.setTime(obsidianTime);
      ensureObsidianAnimation();
    },
    setFloorTime(localSeconds) {
      floorTime = localSeconds;
      floorAnimation?.setTime(floorTime);
      ensureFloorAnimation();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      targetAnimation?.dispose();
      obsidianAnimation?.dispose();
      floorAnimation?.dispose();
      const geometries = new Set();
      const materials = new Set();
      for (const root of [group, signalGroup, floorGroup, backdrop]) {
        root.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) materials.add(object.material);
        });
      }
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      target.dispose();
      reflectionMap.dispose();
      scene.remove(backdrop, reflectionGroup, floorGroup, signalGroup);
      backgroundScene.remove(group);
    },
  };
}
