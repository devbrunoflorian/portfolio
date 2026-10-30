export function createPointerVertexDeclarations(pointerReactive) {
  return `
varying float glyphHoverLight;${pointerReactive ? `
uniform vec2 pointerNdc;
uniform vec2 pointerViewport;
uniform float pointerStrength;` : ''}`;
}

export const POINTER_UV_VERTEX = `float pointerScale = min(1.0, pointerViewport.y / 941.0);
    vec4 glyphCenterClip = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 glyphCenterNdc = glyphCenterClip.xy / max(glyphCenterClip.w, 0.0001);
    vec2 pointerDeltaPixels = (glyphCenterNdc - pointerNdc) * pointerViewport * 0.5;
    float pointerDistance = length(pointerDeltaPixels);
    vec2 pointerDirection = pointerDistance > 0.5
      ? pointerDeltaPixels / pointerDistance
      : vec2(cos(pulsePhase * 6.2831853), sin(pulsePhase * 6.2831853));
    glyphPointerFalloff = (1.0 - smoothstep(0.0, 150.0 * pointerScale, pointerDistance)) * pointerStrength;`;

export const POINTER_PROJECT_VERTEX = `float glyphScatterHash = fract(sin(pulsePhase * 47.71 + glyphColumn * 19.19) * 43758.5453);
    float glyphScatterResponse = mix(0.14, 1.0, step(0.70, glyphScatterHash));
    float glyphScatter = 28.0 * pointerScale * glyphPointerFalloff * glyphScatterResponse * (0.82 + 0.18 * sin(pulsePhase * 6.2831853));
    vec2 glyphSwirl = vec2(-pointerDirection.y, pointerDirection.x) * 12.0 * pointerScale * glyphPointerFalloff * glyphScatterResponse;
    gl_Position.xy += (pointerDirection * glyphScatter + glyphSwirl) * (2.0 / pointerViewport) * gl_Position.w;`;

export const POINTER_FRAGMENT_LIGHT = `diffuseColor.rgb *= 1.0 + glyphHoverLight * 0.42;`;

export const POINTER_FRAGMENT_ALPHA = `(1.0 + glyphHoverLight * 0.12)`;

export const POINTER_FRAGMENT_DECLARATIONS = `varying float glyphHoverLight;`;
