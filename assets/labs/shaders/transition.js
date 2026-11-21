// Both the glyphs and the depth pass use the same right-to-left release.
export const TRANSFER_TIMING = `
float transferAmount(float scanOrder, float seed, float progress) {
  float order = clamp(1.0 - scanOrder + (seed - 0.5) * 0.08, 0.0, 1.0);
  return smoothstep(order * 0.35, order * 0.35 + 0.4, progress);
}
float distanceFromFolder(float mode, float amount, float progress) {
  return (mode < 1.5 ? amount : 1.0 - amount) * smoothstep(0.06, 0.22, progress);
}`;

export const TRANSITION_VERTEX_DECLARATIONS = `
${TRANSFER_TIMING}
attribute float glyphExposed;
uniform float transitionMode;
uniform float transitionProgress;
uniform float folderOpacity;
varying float glyphTransitionAlpha;`;

export const TRANSITION_COUNTERPART_DECLARATION = `uniform mat4 transitionCounterpartMatrix;`;

export const TRANSITION_PROJECT_VERTEX = `
    float glyphSeed = fract(sin(pulsePhase * 127.1 + 311.7) * 43758.5453);
    float dissolve = transferAmount(glyphScanOrder, glyphSeed, transitionProgress);
    glyphTransitionAlpha = 1.0;
    if (transitionMode > 0.5) {
      vec4 glyphLocal = instanceMatrix * vec4(transformed, 1.0);
      vec4 folderWorld = modelMatrix * glyphLocal;
      vec4 counterpartWorld = transitionCounterpartMatrix * glyphLocal;
      vec3 transferStart = transitionMode < 1.5 ? folderWorld.xyz : counterpartWorld.xyz;
      vec3 transferEnd = transitionMode < 1.5 ? counterpartWorld.xyz : folderWorld.xyz;
      float transferArc = sin(dissolve * 3.14159265) * (0.18 + glyphSeed * 0.48);
      vec3 transferPoint = mix(transferStart, transferEnd, dissolve);
      transferPoint.y += transferArc;
      transferPoint.z += sin(glyphSeed * 43.0 + dissolve * 3.14159265) * 0.12 * sin(dissolve * 3.14159265);
      vec4 transferClip = projectionMatrix * viewMatrix * vec4(transferPoint, 1.0);
      float previewBlend = smoothstep(0.06, 0.22, transitionProgress);
      gl_Position = mix(gl_Position, transferClip, previewBlend);
      glyphTransitionAlpha = transitionMode < 1.5
        ? 1.0 - dissolve
        : mix(1.0, dissolve, previewBlend);
      float detached = smoothstep(0.0, 0.025, distanceFromFolder(transitionMode, dissolve, transitionProgress));
      glyphTransitionAlpha *= mix(1.0, glyphExposed, detached);
    }`;

export const TRANSITION_FRAGMENT_DECLARATIONS = `
uniform float folderOpacity;
varying float glyphTransitionAlpha;`;

export const TRANSITION_FRAGMENT_ALPHA = `diffuseColor.a *= glyphTransitionAlpha * folderOpacity`;
