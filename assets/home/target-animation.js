import * as THREE from "three";

const TARGET_LOCAL = Object.freeze({
  crossStart: 0.20,
  crossDuration: 0.40,
  orbitStart: 0.20,
  orbitDuration: 1.60,
  settleStart: 2.20,
  settleEnd: 3.00,
});
const RUNNER_PHASES = Object.freeze([0.04, 0.38, 0.72]);
const RUNNER_TAIL_SEGMENTS = 12;
const RUNNER_TAIL_SPAN = 0.11;
const SECONDARY_STATIC_OPACITY = 0.045;
const PRIMARY_STATIC_OPACITY = 0.09;

function normalizePath(data) {
  return data.replace(/\s+/g, "");
}

function getSvgSubpaths(data) {
  const starts = Array.from(data.matchAll(/[Mm]/g), (match) => match.index);
  return starts.map((start, index) => data.slice(start, starts[index + 1] ?? data.length).trim());
}

function isTargetSubpath(element, data) {
  if (!element.closest(".construction-secondary")) return false;
  const normalized = normalizePath(data);
  return normalized === "M0350H640"
    || normalized === "M32024V676"
    || /^M(?:98|122)/.test(normalized);
}

function splitCross(data) {
  const normalized = normalizePath(data);
  if (normalized === "M0350H640") return ["M320 350H0", "M320 350H640"];
  if (normalized === "M32024V676") return ["M320 350V24", "M320 350V676"];
  return [data];
}

function getLineSchedule(data) {
  const normalized = normalizePath(data);
  if (normalized.startsWith("M320350V") || normalized.startsWith("M320350H")) {
    return { start: TARGET_LOCAL.crossStart, duration: TARGET_LOCAL.crossDuration, opacity: 0.40 };
  }
  const reverse = normalized.startsWith("M122");
  return {
    start: reverse ? 0.78 : 0.60,
    duration: reverse ? 0.92 : 0.90,
    opacity: 0.30,
    reverse,
  };
}

export function createTargetAnimation(svg, renderer, camera, scene) {
  if (!svg) return null;
  camera.updateMatrixWorld(true);
  const canvasRect = renderer.domElement.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return null;

  const planeDepth = -0.19;
  const traceNormal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const tracePoint = new THREE.Vector3(0, 0, planeDepth);
  const tracePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(traceNormal, tracePoint);
  const raycaster = new THREE.Raycaster();
  const canvasPoint = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();
  const segments = [];
  const runners = [];
  const retainedPaths = [];

  function projectSvgPoint(x, y, matrix) {
    const screenX = matrix.a * x + matrix.c * y + matrix.e;
    const screenY = matrix.b * x + matrix.d * y + matrix.f;
    canvasPoint.set(
      ((screenX - canvasRect.left) / canvasRect.width) * 2 - 1,
      -((screenY - canvasRect.top) / canvasRect.height) * 2 + 1,
    );
    raycaster.setFromCamera(canvasPoint, camera);
    raycaster.ray.intersectPlane(tracePlane, worldPoint);
    return new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
  }

  const initialMatrix = svg.getScreenCTM();
  if (!initialMatrix) return null;
  const initialTargetCenter = projectSvgPoint(320, 350, initialMatrix).clone();
  const currentTargetCenter = new THREE.Vector3();
  let lastTargetScreenX = initialMatrix.a * 320 + initialMatrix.c * 350 + initialMatrix.e;
  let lastTargetScreenY = initialMatrix.b * 320 + initialMatrix.d * 350 + initialMatrix.f;

  function sampleSvgPath(element, data, matrix, spacing = 3.5) {
    const original = element.getAttribute("d") ?? "";
    element.setAttribute("d", data);
    try {
      const length = element.getTotalLength();
      const count = Math.max(2, Math.ceil(length / spacing));
      return Array.from({ length: count + 1 }, (_, index) => {
        const point = element.getPointAtLength(length * index / count);
        return projectSvgPoint(point.x, point.y, matrix);
      });
    } finally {
      element.setAttribute("d", original);
    }
  }

  function addSegment(from, to, along0, along1, start, duration, opacity, mode) {
    segments.push({ from, to, along0, along1, start, duration, opacity, mode });
  }

  function addStaticAndAnimatedPath(points, schedule, staticOpacity) {
    for (let index = 1; index < points.length; index++) {
      addSegment(points[index - 1], points[index], 0, 1, 0, 1, staticOpacity, 0);
      addSegment(
        points[index - 1], points[index], (index - 1) / (points.length - 1), index / (points.length - 1),
        schedule.start, schedule.duration, schedule.opacity, 1,
      );
    }
  }

  const targetPathElements = Array.from(svg.querySelectorAll(".construction-secondary > path"));
  for (const element of targetPathElements) {
    const source = element.getAttribute("d") ?? "";
    const matrix = element.getScreenCTM();
    if (!source || !matrix) continue;

    // Filter source subpaths first; expanding the cross before this filter drops all four arms.
    const originalTargetPaths = getSvgSubpaths(source).filter((data) => isTargetSubpath(element, data));
    const targetPaths = originalTargetPaths.flatMap(splitCross);
    for (const data of targetPaths) {
      const schedule = getLineSchedule(data);
      const points = sampleSvgPath(element, data, matrix);
      if (schedule.reverse) points.reverse();
      addStaticAndAnimatedPath(points, schedule, SECONDARY_STATIC_OPACITY);
      retainedPaths.push(normalizePath(data));
    }
  }

  const rings = [];
  const circleElements = Array.from(svg.querySelectorAll(
    ".construction-secondary > circle, .construction-primary > circle",
  ));
  for (const element of circleElements) {
    const matrix = element.getScreenCTM();
    if (!matrix) continue;
    const cx = Number(element.getAttribute("cx"));
    const cy = Number(element.getAttribute("cy"));
    const radius = Number(element.getAttribute("r"));
    const count = Math.max(160, Math.ceil(Math.PI * 2 * radius / 3.5));
    const points = Array.from({ length: count + 1 }, (_, index) => {
      const angle = -Math.PI / 2 + index / count * Math.PI * 2;
      return projectSvgPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, matrix);
    });
    const outer = radius >= 230;
    const schedule = outer
      ? { start: TARGET_LOCAL.orbitStart, duration: TARGET_LOCAL.orbitDuration, opacity: 0.44 }
      : { start: 0.58, duration: 1.34, opacity: 0.34 };
    addStaticAndAnimatedPath(
      points,
      schedule,
      outer ? SECONDARY_STATIC_OPACITY : PRIMARY_STATIC_OPACITY,
    );
    if (outer) rings.push({ points, phases: RUNNER_PHASES });
    retainedPaths.push(`circle:r${radius}`);
  }

  const positions = [];
  const alongValues = [];
  const starts = [];
  const durations = [];
  const opacities = [];
  const modes = [];
  for (const segment of segments) {
    positions.push(...segment.from.toArray(), ...segment.to.toArray());
    alongValues.push(segment.along0, segment.along1);
    starts.push(segment.start, segment.start);
    durations.push(segment.duration, segment.duration);
    opacities.push(segment.opacity, segment.opacity);
    modes.push(segment.mode, segment.mode);
  }

  for (const ring of rings) {
    for (const phase of ring.phases) {
      const runner = {
        points: ring.points,
        phase,
        start: TARGET_LOCAL.orbitStart,
        duration: TARGET_LOCAL.orbitDuration,
        pointIndex: -1,
        tailStartVertex: positions.length / 3,
        tailSegments: RUNNER_TAIL_SEGMENTS,
        current: new THREE.Vector3(),
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
      };
      runners.push(runner);
      for (let index = 0; index < RUNNER_TAIL_SEGMENTS; index++) {
        const intensity = 1 - index / RUNNER_TAIL_SEGMENTS;
        const pointA = samplePathPoint(ring.points, phase - index * RUNNER_TAIL_SPAN / RUNNER_TAIL_SEGMENTS, runner.from);
        const pointB = samplePathPoint(ring.points, phase - (index + 1) * RUNNER_TAIL_SPAN / RUNNER_TAIL_SEGMENTS, runner.to);
        positions.push(...pointA.toArray(), ...pointB.toArray());
        alongValues.push(intensity, intensity);
        starts.push(runner.start, runner.start);
        durations.push(runner.duration, runner.duration);
        opacities.push(0.72, 0.72);
        modes.push(2, 2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(alongValues, 1));
  geometry.setAttribute("aStart", new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute("aDuration", new THREE.Float32BufferAttribute(durations, 1));
  geometry.setAttribute("aOpacity", new THREE.Float32BufferAttribute(opacities, 1));
  geometry.setAttribute("aMode", new THREE.Float32BufferAttribute(modes, 1));

  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aAlong;
      attribute float aStart;
      attribute float aDuration;
      attribute float aOpacity;
      attribute float aMode;
      varying float vAlong;
      varying float vStart;
      varying float vDuration;
      varying float vOpacity;
      varying float vMode;
      void main() {
        vAlong = aAlong;
        vStart = aStart;
        vDuration = aDuration;
        vOpacity = aOpacity;
        vMode = aMode;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vAlong;
      varying float vStart;
      varying float vDuration;
      varying float vOpacity;
      varying float vMode;
      void main() {
        vec3 graphite = vec3(0.24, 0.25, 0.26);
        vec3 crimson = vec3(1.0, 0.006, 0.024);
        if (vMode < 0.5) {
          gl_FragColor = vec4(graphite, vOpacity);
        } else {
          float settle = smoothstep(2.20, 3.00, uTime);
          if (vMode < 1.5) {
            float progress = clamp((uTime - vStart) / max(vDuration, 0.001), 0.0, 1.0);
            if (uTime < vStart || vAlong > progress) discard;
            float tipEnabled = 1.0 - smoothstep(0.975, 1.0, progress);
            float tip = (1.0 - smoothstep(0.0, 0.018, abs(progress - vAlong))) * tipEnabled;
            float age = max(0.0, (progress - vAlong) * vDuration);
            float shortTrail = exp(-age * 6.0);
            float alpha = min(1.0, vOpacity + tip * 0.7 + shortTrail * 0.10);
            gl_FragColor = vec4(crimson, alpha * (1.0 - settle));
          } else {
            if (uTime < vStart) discard;
            float alpha = vOpacity * vAlong * (1.0 - settle);
            gl_FragColor = vec4(crimson, alpha);
          }
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const tracing = new THREE.LineSegments(geometry, lineMaterial);
  tracing.name = "home-target-tracing";
  tracing.renderOrder = 2;
  tracing.frustumCulled = false;

  const anchorPositions = [];
  const anchorStarts = [];
  const anchorTypes = [];
  const anchorSizes = [];
  const anchorData = Array.from(svg.querySelectorAll(".construction-anchors circle"));
  for (const element of anchorData) {
    const matrix = element.getScreenCTM();
    if (!matrix) continue;
    anchorPositions.push(...projectSvgPoint(
      Number(element.getAttribute("cx")), Number(element.getAttribute("cy")), matrix,
    ).toArray());
    anchorStarts.push(0);
    anchorTypes.push(0); // Cardinal anchors persist into the graphite final state.
    anchorSizes.push(4.6);
  }
  const centerMatrix = svg.querySelector(".construction-primary circle")?.getScreenCTM();
  if (centerMatrix) {
    anchorPositions.push(...projectSvgPoint(320, 350, centerMatrix).toArray());
    anchorStarts.push(0);
    anchorTypes.push(1); // Impact origin extinguishes after the traveling glow.
    anchorSizes.push(5.2);
  }
  for (const runner of runners) {
    runner.pointIndex = anchorStarts.length;
    const startPoint = samplePathPoint(runner.points, runner.phase, runner.current);
    anchorPositions.push(...startPoint.toArray());
    anchorStarts.push(runner.start);
    anchorTypes.push(2);
    anchorSizes.push(5.0);
  }

  const anchorGeometry = new THREE.BufferGeometry();
  anchorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(anchorPositions, 3).setUsage(THREE.DynamicDrawUsage));
  anchorGeometry.setAttribute("aStart", new THREE.Float32BufferAttribute(anchorStarts, 1));
  anchorGeometry.setAttribute("aType", new THREE.Float32BufferAttribute(anchorTypes, 1));
  anchorGeometry.setAttribute("aSize", new THREE.Float32BufferAttribute(anchorSizes, 1));
  const anchorMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aStart;
      attribute float aType;
      attribute float aSize;
      uniform float uTime;
      varying float vAlpha;
      varying float vPulse;
      varying float vType;
      void main() {
        float settle = smoothstep(2.20, 3.00, uTime);
        float age = max(0.0, uTime - aStart);
        float pulse = exp(-age * 8.0);
        float persistent = 1.0 - step(0.5, aType);
        float transient = 1.0 - smoothstep(2.20, 3.00, uTime);
        vAlpha = persistent > 0.5 ? 0.88 : transient * (0.56 + pulse * 0.38);
        vAlpha = mix(vAlpha, 0.86, smoothstep(2.65, 3.00, uTime) * persistent);
        vPulse = pulse * transient;
        vType = aType;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize + vPulse * (aType > 1.5 ? 1.8 : 2.2);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vPulse;
      varying float vType;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float radius = length(p) * 2.0;
        float core = 1.0 - smoothstep(0.38, 0.82, radius);
        float halo = exp(-radius * 6.0) * vPulse * 0.2;
        gl_FragColor = vec4(1.0, 0.006, 0.024, core * vAlpha + halo);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const anchors = new THREE.Points(anchorGeometry, anchorMaterial);
  anchors.name = "home-target-anchors";
  anchors.renderOrder = 3;
  anchors.frustumCulled = false;

  const group = new THREE.Group();
  group.name = "home-target-animation";
  group.add(tracing, anchors);
  scene.add(group);

  const diagnostics = {
    retainedPaths,
    rings: rings.length,
    runners: runners.length,
    drawCalls: 2,
    screenProbe: (() => {
      const matrix = svg.getScreenCTM();
      const target = projectSvgPoint(320, 104, matrix).clone().project(camera);
      return {
        source: [matrix.a * 320 + matrix.c * 104 + matrix.e, matrix.b * 320 + matrix.d * 104 + matrix.f],
        rendered: [canvasRect.left + (target.x + 1) * canvasRect.width / 2, canvasRect.top + (1 - target.y) * canvasRect.height / 2],
      };
    })(),
  };
  console.info("[Home Target] geometry", diagnostics);
  let disposed = false;
  const tailPosition = geometry.attributes.position;

  function updateRunner(runner, localSeconds) {
    const progress = THREE.MathUtils.clamp((localSeconds - runner.start) / runner.duration, 0, 1);
    const pathProgress = runner.phase + progress;
    samplePathPoint(runner.points, pathProgress, runner.current);
    anchorGeometry.attributes.position.setXYZ(
      runner.pointIndex, runner.current.x, runner.current.y, runner.current.z,
    );
    for (let index = 0; index < runner.tailSegments; index++) {
      const head = pathProgress - index * RUNNER_TAIL_SPAN / runner.tailSegments;
      const tail = pathProgress - (index + 1) * RUNNER_TAIL_SPAN / runner.tailSegments;
      samplePathPoint(runner.points, head, runner.from);
      samplePathPoint(runner.points, tail, runner.to);
      const vertex = runner.tailStartVertex + index * 2;
      tailPosition.setXYZ(vertex, runner.from.x, runner.from.y, runner.from.z);
      tailPosition.setXYZ(vertex + 1, runner.to.x, runner.to.y, runner.to.z);
    }
  }

  function setTime(localSeconds) {
    const time = Number.isFinite(localSeconds) ? localSeconds : 0;
    lineMaterial.uniforms.uTime.value = time;
    anchorMaterial.uniforms.uTime.value = time;
    for (const runner of runners) updateRunner(runner, time);
    tailPosition.needsUpdate = true;
    anchorGeometry.attributes.position.needsUpdate = true;
  }

  function setPointerOffset() {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const screenX = matrix.a * 320 + matrix.c * 350 + matrix.e;
    const screenY = matrix.b * 320 + matrix.d * 350 + matrix.f;
    if (Math.abs(screenX - lastTargetScreenX) < 0.01 && Math.abs(screenY - lastTargetScreenY) < 0.01) return;
    canvasPoint.set(
      ((screenX - canvasRect.left) / canvasRect.width) * 2 - 1,
      -((screenY - canvasRect.top) / canvasRect.height) * 2 + 1,
    );
    raycaster.setFromCamera(canvasPoint, camera);
    if (!raycaster.ray.intersectPlane(tracePlane, currentTargetCenter)) return;
    group.position.copy(currentTargetCenter).sub(initialTargetCenter);
    lastTargetScreenX = screenX;
    lastTargetScreenY = screenY;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    geometry.dispose();
    lineMaterial.dispose();
    anchorGeometry.dispose();
    anchorMaterial.dispose();
  }

  function setVisible(visible) {
    if (!disposed) group.visible = Boolean(visible);
  }

  setTime(0);
  setPointerOffset();
  setVisible(false);
  return { object: group, setTime, updatePointer: setPointerOffset, setVisible, dispose, diagnostics };
}

function samplePathPoint(points, progress, target) {
  const normalized = ((progress % 1) + 1) % 1;
  const scaled = normalized * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  return target.copy(points[index]).lerp(points[index + 1], scaled - index);
}
