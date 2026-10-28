import * as THREE from "three";

// Layout for the dark monolithic architectural blocks (x, width, height, depth, z).
// Center (x: -0.6 to +0.9) is intentionally kept open so the knight's silhouette remains authoritative.
const layout = [
  [-1.55, 0.32, 2.45, 0.30, -2.5],
  [1.75, 0.40, 1.95, 0.44, -2.2],
  [-0.98, 0.44, 0.95, 0.36, -1.5],
  [1.05, 0.36, 0.70, 0.44, -1.1],
  [-2.30, 0.58, 1.55, 0.52, -2.1],
  [2.65, 0.50, 2.60, 0.36, -3.0],
  [-0.68, 0.25, 0.42, 0.26, -0.85],
  [1.45, 0.30, 1.20, 0.52, -2.8],
  [-2.65, 0.35, 2.95, 0.25, -3.6],
  [2.15, 0.68, 0.98, 0.58, -1.6],
  [-1.35, 0.40, 1.45, 0.30, -3.5],
  [3.10, 0.30, 1.85, 0.40, -2.8],
];

export function createSpatialEnvironment(scene, floorY) {
  const group = new THREE.Group();
  group.name = "computational-environment";
  scene.add(group);

  // Instanced mesh for the structural blocks
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const totalInstances = layout.length * 2;
  const visibility = new THREE.InstancedBufferAttribute(new Float32Array(totalInstances).fill(1), 1);
  geometry.setAttribute("aVisibility", visibility);

  const blockMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float aVisibility;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vVisibility;
      void main() {
        vLocal = position;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 viewPos = viewMatrix * world;
        vViewPosition = -viewPos.xyz;
        vVisibility = aVisibility;
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: `
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vVisibility;
      void main() {
        if (vVisibility < 0.05) discard;
        vec3 p = abs(vLocal);
        
        // 1. Faceted Chamfer / Gemstone Bevels:
        // Bevel corners and vertical chamfers for angular cut planes
        float chamferDist = max(p.x + p.z * 0.95 - 0.44, max(p.y + p.x * 0.15 - 0.47, p.y + p.z * 0.15 - 0.47));
        float isChamfer = smoothstep(-0.015, 0.025, chamferDist);
        
        // Razor-sharp second-axis architectural edges
        float secondAxis = min(max(p.x, p.y), min(max(p.y, p.z), max(p.x, p.z)));
        float edge = smoothstep(0.480, 0.496, secondAxis);
        
        // 2. Controlled Normal Perturbation / Cleavage Facets:
        vec3 norm = normalize(vNormal);
        
        // Local 2D coordinates on the active face
        vec2 faceUV;
        if (p.x > p.y && p.x > p.z) faceUV = vLocal.yz;
        else if (p.y > p.x && p.y > p.z) faceUV = vLocal.xz;
        else faceUV = vLocal.xy;
        
        // Geometric facet divisions: triangular & trapezoidal crystal plane cuts
        float facet1 = step(0.0, faceUV.x + faceUV.y * 0.35);
        float facet2 = step(0.0, faceUV.x * 0.5 - faceUV.y);
        
        // Subtle normal tilt per facet (5 to 8 degrees) so adjacent planes catch light at distinct angles
        vec3 facetTilt = vec3(
          (facet1 - 0.5) * 0.14,
          (facet2 - 0.5) * 0.09,
          (facet1 * facet2 - 0.25) * 0.11
        );
        
        vec3 chamferNorm = normalize(norm + 0.45 * sign(vLocal) * vec3(1.0, 0.25, 1.0));
        vec3 facetNorm = normalize(mix(norm + facetTilt, chamferNorm, isChamfer));
        
        vec3 viewDir = normalize(vViewPosition);
        
        // Directional key light (cool silver-white left) and rim light (crimson right)
        vec3 keyDir = normalize(vec3(-2.8, 3.4, 4.2));
        vec3 redDir = normalize(vec3(3.6, 1.2, 3.0));
        
        vec3 halfKey = normalize(keyDir + viewDir);
        vec3 halfRed = normalize(redDir + viewDir);
        
        // High specular exponents: razor-sharp diamond glints (NO broad diffuse spread!)
        float specKey = pow(max(dot(facetNorm, halfKey), 0.0), 72.0);
        float specRed = pow(max(dot(facetNorm, halfRed), 0.0), 64.0);
        
        // Thin edge reflections
        float edgeKey = edge * pow(max(dot(norm, halfKey), 0.0), 32.0);
        // Crimson rim catch is strictly restricted to right-facing edges and rare chamfer facets
        float redSide = max(dot(norm, vec3(1.0, 0.0, 0.0)), 0.0);
        float edgeRed = (edge * 0.7 + isChamfer * 0.3) * pow(max(dot(norm, halfRed), 0.0), 36.0) * redSide;
        
        // 3. Overwhelmingly Black Diamond / Smoked Obsidian Base:
        // Deep charcoal/black: #060709 (90%+ perceived black)
        // ZERO red diffuse wash on any surface!
        vec3 color = vec3(0.014, 0.016, 0.020);
        
        // Architectural CAD edge hairline: subtle cool silver
        vec3 edgeColor = vec3(0.12, 0.13, 0.16);
        color = mix(color, edgeColor, edge * 0.7);
        
        // Distinct facet responses (each facet catches light differently)
        color += specKey * vec3(0.55, 0.60, 0.70);
        color += edgeKey * vec3(0.40, 0.45, 0.55);
        
        // Crimson exists ONLY as thin edge reflections and tiny facet catches (NO red wash!)
        color += specRed * vec3(0.38, 0.025, 0.045) * redSide;
        color += edgeRed * vec3(0.45, 0.03, 0.06);
        
        // Mineral grain inclusion (dark smoked gemstone texture)
        float grain = fract(sin(dot(floor(vWorld * 180.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        color *= mix(0.93, 1.0, grain) * vVisibility;
        
        // 4. Transmission / Opacity:
        // Thick smoked obsidian: 0.95 - 0.985
        // Deep dark mineral mass. Rear blocks are perceived darkly and refracted through edges/chamfers.
        float alpha = mix(0.95, 0.985, max(edge, isChamfer)) * vVisibility;
        
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: true,
  });

  const blocks = new THREE.InstancedMesh(geometry, blockMaterial, totalInstances);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blocks.frustumCulled = false;
  blocks.renderOrder = 2;
  group.add(blocks);

  const transform = new THREE.Object3D();

  function setBlock(index, offset = 0, faded = false) {
    const [x, width, height, depth, z] = layout[index];
    for (let half = 0; half < 2; half++) {
      transform.position.set(
        x + (half ? offset : 0),
        floorY + height * (0.25 + half * 0.5),
        z
      );
      transform.scale.set(width, height * 0.5 - 0.003, depth);
      transform.updateMatrix();
      blocks.setMatrixAt(index * 2 + half, transform.matrix);
      visibility.setX(index * 2 + half, half && faded ? 0 : 1);
    }
    blocks.instanceMatrix.needsUpdate = true;
    visibility.needsUpdate = true;
  }

  layout.forEach((_, index) => setBlock(index));

  // Layer B: Deep spatial floor grid
  const gridPoints = [];
  for (let i = -7; i <= 7; i++) {
    // Longitudinal lines (perspective receding towards horizon)
    gridPoints.push(i * 0.55, floorY + 0.004, -5.0, i * 0.55, floorY + 0.004, 3.0);
    // Transverse lines
    if (i >= -6 && i <= 5) {
      gridPoints.push(-4.5, floorY + 0.004, i * 0.6, 4.5, floorY + 0.004, i * 0.6);
    }
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPoints, 3));
  const grid = new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({
      color: 0x9b9a94,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
    })
  );
  group.add(grid);

  // Technical guide segments at depths z = -2.2 to -3.2
  const guidesGeometry = new THREE.BufferGeometry();
  guidesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -3.2, 1.4, -3.0, 3.2, 1.4, -3.0,
      -2.1, floorY, -3.0, -2.1, 2.4, -3.0,
      1.3, floorY, -3.0, 1.3, 2.6, -3.0,
      -0.9, 1.8, -2.4, 2.8, 1.8, -2.4,
      -2.8, 0.2, -2.8, -1.0, 0.2, -2.8,
      1.4, -0.1, -2.3, 3.2, -0.1, -2.3,
      -1.5, 2.2, -3.0, -1.5, 1.8, -3.0,
      -1.5, 2.2, -3.0, 0.3, 2.2, -3.0,
      2.4, 0.8, -2.2, 3.4, 0.8, -2.2,
      2.4, floorY, -2.2, 2.4, 1.8, -2.2,
    ], 3)
  );
  const guides = new THREE.LineSegments(
    guidesGeometry,
    new THREE.LineBasicMaterial({
      color: 0xb5b4ad,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );
  group.add(guides);

  // Optional Foreground Depth Layer (Section 8)
  const foregroundGroup = new THREE.Group();
  foregroundGroup.name = "environment-foreground";
  scene.add(foregroundGroup);

  const fgGeometry = new THREE.BufferGeometry();
  fgGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      1.65, 0.15, 1.4, 1.85, 0.15, 1.4,
      1.65, 0.15, 1.4, 1.65, 0.35, 1.4,
      2.10, -0.30, 1.2, 2.25, -0.30, 1.2,
      2.175, -0.375, 1.2, 2.175, -0.225, 1.2,
    ], 3)
  );
  const fgMesh = new THREE.LineSegments(
    fgGeometry,
    new THREE.LineBasicMaterial({
      color: 0xd8d6cf,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })
  );
  foregroundGroup.add(fgMesh);

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
          // Pulse takes 3.0s to travel, remaining period is quiet
          float phase = mod(uTime + uOffset, uPeriod) / 3.0;
          if (phase > 1.0) discard;
          
          float tail = phase * 1.18 - vAlong;
          float alpha = smoothstep(0.0, 0.022, tail) * (1.0 - smoothstep(0.028, 0.17, tail)) * sin(phase * 3.14159);
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
    group.add(pulseLine);
    return pulseLine;
  });

  let limited = false;
  let startedAt = null;
  let nextEventAt = 9200;
  let eventStart = null;
  let eventIndex = 0;
  let activeBlock = 0;
  const quietGaps = [14200, 19500, 12400, 23100, 16800];

  return {
    group,
    setLimited(value) {
      if (limited === value) return;
      limited = value;
      blocks.count = value ? 8 : totalInstances;
      guides.visible = !value;
      foregroundGroup.visible = !value;
      pulses.forEach((pulse, index) => {
        pulse.visible = !value || index === 1;
      });
      grid.material.opacity = value ? 0.05 : 0.10;
    },
    update(timestamp, environment) {
      if (!environment) return;
      this.setLimited(environment.limited);
      if (startedAt === null) startedAt = timestamp;
      const time = timestamp - startedAt;

      // Depth 3 Parallax for background blocks and grid
      group.position.x = environment.pointer.x * (limited ? 0 : 0.035);
      group.position.z = environment.pointer.y * (limited ? 0 : 0.025);

      // Depth 5 Parallax for subtle foreground fragments
      foregroundGroup.position.x = environment.pointer.x * (limited ? 0 : 0.08);
      foregroundGroup.position.y = -environment.pointer.y * (limited ? 0 : 0.06);

      // Update pulse uniforms
      const signalRate = environment.phase?.signalRate ?? 0.75;
      for (const pulse of pulseMaterials) {
        pulse.uniforms.uTime.value = (time / 1000) * signalRate;
      }

      // Glitch language (Section 4): occasional, restrained block offset & reconstruction
      const coherence = environment.phase?.coherence ?? 0.75;
      if (!limited && eventStart === null && time >= nextEventAt) {
        activeBlock = [7, 0, 9, 4, 1, 10][eventIndex % 6];
        eventStart = time;
        eventIndex++;
      }

      if (eventStart !== null) {
        const age = time - eventStart;
        if (age > 260 || limited) {
          // Reconstruct into stable shape
          setBlock(activeBlock);
          eventStart = null;
          nextEventAt = time + quietGaps[eventIndex % quietGaps.length] / coherence;
        } else {
          // Brief 260ms distortion & partial fade
          const offset = Math.sin((age / 260) * Math.PI) * 0.055;
          setBlock(activeBlock, offset, age > 90 && age < 160);
        }
      }
    },
    dispose() {
      geometry.dispose();
      blockMaterial.dispose();
      gridGeometry.dispose();
      grid.material.dispose();
      guidesGeometry.dispose();
      guides.material.dispose();
      fgGeometry.dispose();
      fgMesh.material.dispose();
      pulseMaterials.forEach((m) => m.dispose());
      scene.remove(group);
      scene.remove(foregroundGroup);
    },
  };
}
