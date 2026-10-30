export function createLabsBackground(ctx, glyphs) {
  const { THREE, Reflector, folderRoot, scene } = ctx;

  function addFloor() {
    folderRoot.updateMatrixWorld(true);
    const activeWorldBounds = new THREE.Box3().setFromPoints(
      glyphs.map((glyph) => folderRoot.localToWorld(glyph.point.clone())),
    );
    const floorCenter = activeWorldBounds.getCenter(new THREE.Vector3());
    const floorAnchor = new THREE.Vector2(floorCenter.x, floorCenter.z);
    const floorShader = {
      uniforms: {
        ...Reflector.ReflectorShader.uniforms,
        reflectionStrength: { value: 0.72 },
        reflectionTexelSize: { value: new THREE.Vector2(1 / 700, 1 / 420) },
      },
      vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vFloorPosition;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vFloorPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float reflectionStrength;
        uniform vec2 reflectionTexelSize;
        varying vec4 vUv;
        varying vec3 vFloorPosition;
        void main() {
          vec2 uv = vUv.xy / vUv.w;
          float blurStep = reflectionTexelSize.y;
          vec3 reflected = texture2D(tDiffuse, uv).rgb * 0.24;
          reflected += texture2D(tDiffuse, uv + vec2(0.0, blurStep * 1.5)).rgb * 0.18;
          reflected += texture2D(tDiffuse, uv - vec2(0.0, blurStep * 1.5)).rgb * 0.18;
          reflected += texture2D(tDiffuse, uv + vec2(0.0, blurStep * 4.0)).rgb * 0.12;
          reflected += texture2D(tDiffuse, uv - vec2(0.0, blurStep * 4.0)).rgb * 0.12;
          reflected += texture2D(tDiffuse, uv + vec2(0.0, blurStep * 8.0)).rgb * 0.08;
          reflected += texture2D(tDiffuse, uv - vec2(0.0, blurStep * 8.0)).rgb * 0.08;
          float xFade = 1.0 - smoothstep(2.2, 3.4, abs(vFloorPosition.x - 0.3));
          float zFade = 1.0 - smoothstep(0.2, 2.5, abs(vFloorPosition.z - 0.8));
          float fade = xFade * zFade;
          gl_FragColor = vec4(reflected * vec3(0.38, 0.56, 0.78), fade * reflectionStrength);
        }
      `,
    };
    const floor = new Reflector(new THREE.PlaneGeometry(14, 10), {
      clipBias: 0.003,
      textureWidth: 700,
      textureHeight: 420,
      color: 0x080d14,
      multisample: 0,
      shader: floorShader,
    });
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.018;
    floor.material.transparent = true;
    floor.material.depthWrite = false;
    floor.material.toneMapped = false;
    floor.renderOrder = 0;

    const floorOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.ShaderMaterial({
        uniforms: { floorAnchor: { value: floorAnchor } },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec2 floorAnchor;
          varying vec3 vWorldPosition;

          float guideRing(float distanceFromCenter, float radius) {
            float antialias = max(fwidth(distanceFromCenter), 0.006);
            return 1.0 - smoothstep(antialias, antialias * 2.2, abs(distanceFromCenter - radius));
          }

          void main() {
            vec2 floorOffset = vWorldPosition.xz - floorAnchor;
            float radialDistance = length(floorOffset);
            float spatialFade = 1.0 - smoothstep(5.2, 9.5, radialDistance);

            vec2 gridCoordinate = floorOffset / 0.92;
            vec2 gridDerivative = max(fwidth(gridCoordinate), vec2(0.0001));
            vec2 gridDistance = abs(fract(gridCoordinate - 0.5) - 0.5) / gridDerivative;
            float grid = 1.0 - min(min(gridDistance.x, gridDistance.y), 1.0);

            float innerRing = guideRing(radialDistance, 1.55);
            float outerRing = guideRing(radialDistance, 3.25);
            float pool = exp(-dot(floorOffset / vec2(3.0, 1.85), floorOffset / vec2(3.0, 1.85)) * 2.1);

            float gridAlpha = grid * 0.045 * spatialFade;
            float ringAlpha = (innerRing * 0.06 + outerRing * 0.04) * spatialFade;
            float poolAlpha = pool * 0.03;
            float alpha = min(gridAlpha + ringAlpha + poolAlpha, 0.08);
            vec3 floorBlue = mix(vec3(0.018, 0.09, 0.21), vec3(0.035, 0.22, 0.48), pool);
            gl_FragColor = vec4(floorBlue, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    floorOverlay.position.z = 0.004;
    floorOverlay.renderOrder = 0.25;
    floor.add(floorOverlay);
    scene.add(floor);
    return floor;
  }

  const floor = addFloor();
  return {
    floor,
    dispose() {
      scene.remove(floor);
      floor.dispose();
      floor.geometry.dispose();
      floor.children.forEach((object) => {
        object.geometry?.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material?.dispose();
        }
      });
    },
  };
}
