import * as THREE from "three";

/**
 * Procedural Multi-Ring Crystalline Monolith Geometry Generator
 * Generates unique faceted gemstone columns with multiple irregular vertical rings,
 * lateral offsets, asymmetric shoulders, and distinctive crown cuts (apex, chisel, plateau).
 */
function createMultiRingMonolithGeometry(config) {
  const {
    facets = 7,
    rings = [],
    crown = { type: "apex", apex: [0, 2.5, 0] },
    facetJitter = null,
  } = config;

  const numRings = rings.length;
  const ringVertices = [];
  const positions = [];

  const weights = facetJitter || Array.from({ length: facets }, () => 1.0);

  // 1. Calculate 3D perimeter vertices for each irregular vertical section ring
  for (let r = 0; r < numRings; r++) {
    const ring = [];
    const { y, rx, rz, twist = 0, ox = 0, oz = 0 } = rings[r];

    for (let f = 0; f < facets; f++) {
      const angle = (f / facets) * Math.PI * 2 + twist;
      const w = weights[f];
      const x = Math.cos(angle) * rx * w + ox;
      const z = Math.sin(angle) * rz * w + oz;
      ring.push([x, y, z]);
    }
    ringVertices.push(ring);
  }

  function addTriangle(p1, p2, p3) {
    positions.push(...p1, ...p2, ...p3);
  }

  function addQuad(p1, p2, p3, p4) {
    addTriangle(p1, p3, p2);
    addTriangle(p1, p4, p3);
  }

  // 2. Connect vertical section rings with triangulated facet planes
  for (let r = 0; r < numRings - 1; r++) {
    const curRing = ringVertices[r];
    const nextRing = ringVertices[r + 1];
    for (let f = 0; f < facets; f++) {
      const nextF = (f + 1) % facets;
      addQuad(curRing[f], curRing[nextF], nextRing[nextF], nextRing[f]);
    }
  }

  // 3. Construct unique crown geometry
  const topRing = ringVertices[numRings - 1];
  if (crown.type === "apex") {
    // Sharp gemstone pyramid point
    const apex = crown.apex;
    for (let f = 0; f < facets; f++) {
      const nextF = (f + 1) % facets;
      addTriangle(topRing[f], apex, topRing[nextF]);
    }
  } else if (crown.type === "chisel") {
    // Architectural chisel ridge with 2 apex points
    const p1 = crown.chisel[0];
    const p2 = crown.chisel[1];
    const half = Math.floor(facets / 2);
    for (let f = 0; f < facets; f++) {
      const nextF = (f + 1) % facets;
      const target = f < half ? p1 : p2;
      addTriangle(topRing[f], target, topRing[nextF]);
    }
    addTriangle(topRing[0], p2, p1);
    addTriangle(topRing[half], p1, p2);
  } else if (crown.type === "plateau") {
    // Beveled gemstone plateau cap
    const plateauY = crown.plateauY;
    const scale = crown.plateauScale || 0.6;
    const last = rings[numRings - 1];
    const plateauRing = topRing.map(([x, , z]) => [
      (x - last.ox) * scale + last.ox,
      plateauY,
      (z - last.oz) * scale + last.oz,
    ]);
    for (let f = 0; f < facets; f++) {
      const nextF = (f + 1) % facets;
      addQuad(topRing[f], topRing[nextF], plateauRing[nextF], plateauRing[f]);
    }
    for (let f = 1; f < facets - 1; f++) {
      addTriangle(plateauRing[0], plateauRing[f], plateauRing[f + 1]);
    }
  }

  // 4. Close bottom base ring (facing downward)
  const baseRing = ringVertices[0];
  const baseCenter = [rings[0].ox || 0, rings[0].y, rings[0].oz || 0];
  for (let f = 0; f < facets; f++) {
    const nextF = (f + 1) % facets;
    addTriangle(baseRing[f], baseRing[nextF], baseCenter);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createSpatialEnvironment(scene, floorY) {
  const group = new THREE.Group();
  group.name = "computational-environment";
  scene.add(group);

  // --------------------------------------------------------------------------
  // ASYMMETRICAL 3-TIER MONOLITH ARCHITECTURE (11 Unique Meshes)
  // Deep perspective: Foreground (z: -1.10) to Deep Background (z: -4.50)
  // Central reading corridor (x: -1.25 to +1.45) open for the knight
  // --------------------------------------------------------------------------
  const monolithConfigs = [
    // 0: Deep Background Cathedral Spire (Left)
    {
      pos: [-2.10, floorY, -4.50],
      rotY: -0.28,
      facets: 7,
      facetJitter: [1.05, 0.95, 1.10, 0.92, 1.04, 0.98, 1.02],
      rings: [
        { y: 0.0, rx: 0.28, rz: 0.26, twist: 0.00 },
        { y: 1.1, rx: 0.32, rz: 0.29, twist: 0.06, ox: 0.02 },
        { y: 2.3, rx: 0.26, rz: 0.24, twist: -0.05, ox: -0.02 },
        { y: 3.3, rx: 0.17, rz: 0.15, twist: 0.12, ox: 0.03 },
        { y: 3.75, rx: 0.08, rz: 0.07, twist: 0.20, ox: 0.04 },
      ],
      crown: { type: "apex", apex: [0.04, 3.90, 0.02] },
      mat: { transmission: 0.04, thickness: 1.0, roughness: 0.06, clearcoat: 0.30 },
    },

    // 1: Deep Background Cathedral Spire (Right)
    {
      pos: [2.25, floorY, -4.30],
      rotY: 0.20,
      facets: 6,
      facetJitter: [0.96, 1.08, 0.94, 1.05, 0.98, 1.04],
      rings: [
        { y: 0.0, rx: 0.26, rz: 0.28, twist: 0.00 },
        { y: 1.3, rx: 0.30, rz: 0.31, twist: -0.06, ox: -0.02 },
        { y: 2.5, rx: 0.23, rz: 0.22, twist: 0.08, ox: 0.03 },
        { y: 3.5, rx: 0.12, rz: 0.11, twist: 0.15, ox: -0.01 },
      ],
      crown: { type: "chisel", chisel: [[-0.08, 3.75, 0.01], [0.08, 3.68, -0.01]] },
      mat: { transmission: 0.04, thickness: 1.1, roughness: 0.06, clearcoat: 0.32 },
    },

    // 2: Deep Flank Pillar (Far Left)
    {
      pos: [-3.20, floorY, -3.80],
      rotY: -0.45,
      facets: 8,
      facetJitter: [1.02, 0.96, 1.05, 0.94, 1.06, 0.98, 1.04, 0.95],
      rings: [
        { y: 0.0, rx: 0.38, rz: 0.34, twist: 0.00 },
        { y: 0.9, rx: 0.44, rz: 0.38, twist: 0.08, ox: 0.04 },
        { y: 2.0, rx: 0.35, rz: 0.30, twist: -0.07, ox: -0.03 },
        { y: 3.1, rx: 0.22, rz: 0.18, twist: 0.14, ox: 0.02 },
      ],
      crown: { type: "plateau", plateauY: 3.30, plateauScale: 0.55 },
      mat: { transmission: 0.04, thickness: 1.0, roughness: 0.06, clearcoat: 0.28 },
    },

    // 3: Deep Flank Sentry (Far Right)
    {
      pos: [3.10, floorY, -3.50],
      rotY: 0.25,
      facets: 7,
      facetJitter: [0.94, 1.06, 0.98, 1.04, 0.95, 1.08, 0.96],
      rings: [
        { y: 0.0, rx: 0.34, rz: 0.32, twist: 0.00 },
        { y: 1.0, rx: 0.38, rz: 0.36, twist: -0.08, ox: -0.03 },
        { y: 2.1, rx: 0.28, rz: 0.25, twist: 0.10, ox: 0.04 },
        { y: 2.9, rx: 0.16, rz: 0.14, twist: 0.18, ox: -0.02 },
      ],
      crown: { type: "chisel", chisel: [[-0.07, 3.15, 0.02], [0.08, 3.05, -0.02]] },
      mat: { transmission: 0.05, thickness: 1.1, roughness: 0.06, clearcoat: 0.30 },
    },

    // 4: Midground Asymmetric Obelisk (Left of Knight)
    {
      pos: [-1.85, floorY, -2.50],
      rotY: -0.32,
      facets: 7,
      facetJitter: [1.08, 0.92, 1.12, 0.90, 1.05, 0.98, 1.02],
      rings: [
        { y: 0.0, rx: 0.30, rz: 0.28, twist: 0.00 },
        { y: 0.6, rx: 0.36, rz: 0.32, twist: 0.10, ox: 0.03 },
        { y: 1.4, rx: 0.42, rz: 0.35, twist: -0.08, ox: -0.04 }, // Prominent angular shoulder
        { y: 2.1, rx: 0.24, rz: 0.20, twist: 0.12, ox: 0.02 },
        { y: 2.6, rx: 0.12, rz: 0.10, twist: 0.22, ox: -0.02 },
      ],
      crown: { type: "apex", apex: [-0.04, 2.78, 0.03] },
      mat: { transmission: 0.06, thickness: 1.2, ior: 2.15, roughness: 0.06, clearcoat: 0.38 },
      hasFracture: true,
    },

    // 5: Midground Fractured Tower (Right of Knight)
    {
      pos: [1.95, floorY, -2.30],
      rotY: 0.12,
      facets: 8,
      facetJitter: [0.95, 1.05, 0.92, 1.10, 0.96, 1.04, 0.98, 1.06],
      rings: [
        { y: 0.0, rx: 0.36, rz: 0.32, twist: 0.00 },
        { y: 0.7, rx: 0.42, rz: 0.37, twist: -0.08, ox: -0.03 },
        { y: 1.5, rx: 0.38, rz: 0.34, twist: 0.06, ox: 0.03 },
        { y: 2.3, rx: 0.24, rz: 0.21, twist: 0.15, ox: -0.02 },
      ],
      crown: { type: "plateau", plateauY: 2.52, plateauScale: 0.58 },
      mat: { transmission: 0.06, thickness: 1.2, ior: 2.15, roughness: 0.06, clearcoat: 0.36 },
      hasFracture: true,
    },

    // 6: Midground Leaning Crystalline Column (Left)
    {
      pos: [-2.45, floorY, -2.10],
      rotY: 0.18,
      facets: 6,
      facetJitter: [1.06, 0.94, 1.08, 0.92, 1.04, 0.96],
      rings: [
        { y: 0.0, rx: 0.34, rz: 0.30, twist: 0.00 },
        { y: 0.6, rx: 0.38, rz: 0.34, twist: 0.08, ox: -0.04 },
        { y: 1.3, rx: 0.32, rz: 0.28, twist: -0.06, ox: -0.08 }, // Leaning column
        { y: 1.9, rx: 0.18, rz: 0.15, twist: 0.12, ox: -0.12 },
      ],
      crown: { type: "chisel", chisel: [[-0.08, 2.05, 0], [0.06, 1.98, 0]] },
      mat: { transmission: 0.05, thickness: 1.1, roughness: 0.06, clearcoat: 0.35 },
    },

    // 7: Midground Stepped Mass (Right)
    {
      pos: [2.50, floorY, -1.90],
      rotY: -0.20,
      facets: 8,
      facetJitter: [0.98, 1.04, 0.95, 1.06, 0.96, 1.08, 0.94, 1.02],
      rings: [
        { y: 0.0, rx: 0.40, rz: 0.35, twist: 0.00 },
        { y: 0.5, rx: 0.46, rz: 0.40, twist: 0.06, ox: 0.03 },
        { y: 1.1, rx: 0.41, rz: 0.36, twist: -0.06, ox: -0.02 },
        { y: 1.7, rx: 0.28, rz: 0.26, twist: 0.10, ox: 0.02 },
      ],
      crown: { type: "plateau", plateauY: 1.86, plateauScale: 0.62 },
      mat: { transmission: 0.05, thickness: 1.2, roughness: 0.06, clearcoat: 0.36 },
    },

    // 8: Foreground Low Cut Gemstone Mass (Near Left)
    {
      pos: [-1.25, floorY, -1.20],
      rotY: -0.15,
      facets: 7,
      facetJitter: [1.04, 0.96, 1.08, 0.92, 1.06, 0.98, 1.02],
      rings: [
        { y: 0.0, rx: 0.35, rz: 0.32, twist: 0.00 },
        { y: 0.3, rx: 0.42, rz: 0.38, twist: 0.05, ox: 0.02 },
        { y: 0.6, rx: 0.38, rz: 0.34, twist: -0.04, ox: -0.02 },
        { y: 0.9, rx: 0.28, rz: 0.26, twist: 0.08, ox: 0.01 },
      ],
      crown: { type: "plateau", plateauY: 0.98, plateauScale: 0.68 },
      mat: { transmission: 0.07, thickness: 1.3, ior: 2.20, roughness: 0.06, clearcoat: 0.42 },
    },

    // 9: Foreground Near Crystal (Near Right)
    {
      pos: [1.45, floorY, -1.10],
      rotY: 0.18,
      facets: 6,
      facetJitter: [0.94, 1.08, 0.96, 1.05, 0.98, 1.04],
      rings: [
        { y: 0.0, rx: 0.30, rz: 0.28, twist: 0.00 },
        { y: 0.4, rx: 0.36, rz: 0.32, twist: -0.06, ox: -0.02 },
        { y: 0.8, rx: 0.31, rz: 0.27, twist: 0.06, ox: 0.02 },
        { y: 1.0, rx: 0.20, rz: 0.17, twist: 0.14, ox: 0.03 },
      ],
      crown: { type: "chisel", chisel: [[-0.08, 1.15, 0.02], [0.08, 1.08, -0.02]] },
      mat: { transmission: 0.07, thickness: 1.3, ior: 2.20, roughness: 0.06, clearcoat: 0.42 },
    },

    // 10: Outer Boundary Framing Crystal (Far Right Peripheral)
    {
      pos: [3.65, floorY, -2.60],
      rotY: -0.35,
      facets: 7,
      facetJitter: [1.02, 0.98, 1.05, 0.95, 1.04, 0.97, 1.01],
      rings: [
        { y: 0.0, rx: 0.28, rz: 0.26, twist: 0.00 },
        { y: 0.7, rx: 0.32, rz: 0.30, twist: 0.06, ox: 0.02 },
        { y: 1.4, rx: 0.26, rz: 0.24, twist: -0.04, ox: -0.02 },
        { y: 2.1, rx: 0.14, rz: 0.12, twist: 0.10, ox: 0.01 },
      ],
      crown: { type: "apex", apex: [0.02, 2.32, 0.00] },
      mat: { transmission: 0.05, thickness: 1.2, roughness: 0.06, clearcoat: 0.32 },
    },
  ];

  // --------------------------------------------------------------------------
  // CREATE SEPARATE MESHES WITH PHYSICAL GEMSTONE MATERIAL (MeshPhysicalMaterial)
  // --------------------------------------------------------------------------
  const monolithMeshes = [];
  const fractureLines = [];

  monolithConfigs.forEach((cfg) => {
    const geo = createMultiRingMonolithGeometry(cfg);

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x010203, // Pure dense black obsidian (95%+ black mineral mass)
      roughness: 0.06, // Ultra-polished crystal: razor-sharp diamond pin-point glints, zero broad face flood
      metalness: 0.02,
      transmission: cfg.mat.transmission ?? 0.06, // Dense smoked mineral transmission
      thickness: cfg.mat.thickness ?? 1.0,
      ior: 2.15, // Diamond index of refraction
      attenuationColor: new THREE.Color(0x010203),
      attenuationDistance: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.06,
      opacity: 1.0,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...cfg.pos);
    mesh.rotation.y = cfg.rotY;
    mesh.userData.basePosition = mesh.position.clone();
    mesh.userData.baseRotation = mesh.rotation.clone();

    // Optional Internal Cleavage Fracture Line for selected monoliths (Section 12)
    if (cfg.hasFracture) {
      const fGeo = new THREE.BufferGeometry();
      const pY = cfg.rings[2]?.y || 1.2;
      fGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            -0.12, pY - 0.25, 0.05,
            0.15, pY + 0.35, -0.06,
            0.15, pY + 0.35, -0.06,
            0.02, pY + 0.55, 0.08,
          ],
          3
        )
      );
      const fMat = new THREE.LineBasicMaterial({
        color: 0x9ba0ad,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      });
      const fLine = new THREE.LineSegments(fGeo, fMat);
      mesh.add(fLine);
      fractureLines.push(fLine);
    }

    group.add(mesh);
    monolithMeshes.push(mesh);
  });

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
    new THREE.Float32BufferAttribute(
      [
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
      ],
      3
    )
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
    new THREE.Float32BufferAttribute(
      [
        1.65, 0.15, 1.4, 1.85, 0.15, 1.4,
        1.65, 0.15, 1.4, 1.65, 0.35, 1.4,
        2.10, -0.30, 1.2, 2.25, -0.30, 1.2,
        2.175, -0.375, 1.2, 2.175, -0.225, 1.2,
      ],
      3
    )
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
  let activeMeshIndex = 0;
  const quietGaps = [14200, 19500, 12400, 23100, 16800];

  return {
    group,
    setLimited(value) {
      if (limited === value) return;
      limited = value;
      monolithMeshes.forEach((mesh, index) => {
        mesh.visible = value ? index < 6 : true;
      });
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

      // Glitch language (Section 16): occasional, restrained mesh displacement & reconstruction
      const coherence = environment.phase?.coherence ?? 0.75;
      if (!limited && eventStart === null && time >= nextEventAt) {
        activeMeshIndex = [4, 1, 5, 8, 0, 7][eventIndex % 6];
        eventStart = time;
        eventIndex++;
      }

      if (eventStart !== null) {
        const age = time - eventStart;
        const mesh = monolithMeshes[activeMeshIndex];
        if (mesh) {
          if (age > 260 || limited) {
            // Reconstruct cleanly to original resting state
            mesh.position.copy(mesh.userData.basePosition);
            mesh.rotation.copy(mesh.userData.baseRotation);
            eventStart = null;
            nextEventAt = time + quietGaps[eventIndex % quietGaps.length] / coherence;
          } else {
            // Brief 260ms subtle crystalline shear / displacement
            const offset = Math.sin((age / 260) * Math.PI) * 0.045;
            mesh.position.x = mesh.userData.basePosition.x + offset;
            mesh.rotation.y = mesh.userData.baseRotation.y + offset * 0.75;
          }
        }
      }
    },
    dispose() {
      monolithMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      fractureLines.forEach((line) => {
        line.geometry.dispose();
        line.material.dispose();
      });
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
