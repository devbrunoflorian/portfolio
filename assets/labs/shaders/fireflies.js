export const FIREFLY_VERTEX_SHADER = `
        uniform float idleTime;
        uniform float idleStrength;
        attribute vec3 aDrift;
        attribute float aPhase;
        attribute float aRate;
        attribute float aSize;
        attribute float aIntensity;
        attribute float aGlyph;
        attribute float aGlyphColumn;
        attribute vec3 aRecoilOffset;
        varying float vIntensity;
        varying float vGlyph;
        varying float vGlyphColumn;
        void main() {
          float cycle = idleTime * aRate + aPhase;
          vec3 drift = vec3(
            aDrift.x * cos(cycle) + sin(idleTime * 0.37 + aPhase) * 0.012,
            aDrift.y * sin(cycle) + cos(idleTime * 0.29 + aPhase * 1.7) * 0.01,
            aDrift.z * sin(cycle * 0.63 + aPhase * 1.1) + sin(idleTime * 0.23 + aPhase * 0.7) * 0.008
          ) * idleStrength;
          float startle = smoothstep(0.01, 0.16, length(aRecoilOffset));
          vec4 viewPosition = modelViewMatrix * vec4(position + drift + aRecoilOffset, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = aSize * (32.0 / max(1.0, -viewPosition.z)) * (1.0 + startle * 1.1);
          vIntensity = aIntensity * mix(0.82, 1.0, 0.5 + 0.5 * sin(cycle * 0.7)) * (1.0 + startle * 1.6);
          vGlyph = aGlyph;
          vGlyphColumn = aGlyphColumn;
        }
      `;

export const FIREFLY_FRAGMENT_SHADER = `
        uniform sampler2D glyphAtlas;
        varying float vIntensity;
        varying float vGlyph;
        varying float vGlyphColumn;
        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
          float glow = 1.0 - smoothstep(0.04, 0.5, distanceFromCenter);
          float softHalo = exp(-distanceFromCenter * 5.5) * 0.19;
          vec2 glyphUv = vec2(gl_PointCoord.x * 0.46153846 + vGlyphColumn * 0.5 + 0.01923077, gl_PointCoord.y);
          float glyphMask = texture2D(glyphAtlas, glyphUv).a;
          float glyphCore = smoothstep(0.06, 0.62, glyphMask);
          float alpha = mix(glow, glyphCore + softHalo * glow, vGlyph) * vIntensity * 0.56;
          gl_FragColor = vec4(vec3(0.08, 0.3, 0.95), alpha);
        }
      `;
