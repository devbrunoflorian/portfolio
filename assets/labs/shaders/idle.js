export const IDLE_VERTEX_DECLARATIONS = `
attribute float glyphColumn;
attribute float glyphScanOrder;
attribute float pulsePhase;
attribute float pulseRate;
uniform float idleTime;
uniform float idleStrength;
uniform float glyphAtlasBlur;
varying float glyphPulse;
varying vec2 glyphBlurUv;`;

export function createIdleGlyphUv(flipRate, pointerFlipBoost) {
  return `#ifdef USE_MAP
    float flipRate = ${flipRate.toFixed(2)} + glyphPointerFalloff * ${pointerFlipBoost.toFixed(2)};
    float mutationTick = floor(idleTime * (0.35 + pulseRate) + pulsePhase * 13.0);
    float mutationHash = fract(sin(mutationTick * 12.9898 + pulsePhase * 78.233) * 43758.5453);
    float digitFlip = step(1.0 - flipRate, mutationHash) * idleStrength;
  float animatedColumn = mod(glyphColumn + digitFlip, 2.0);
    glyphBlurUv = vec2(vMapUv.x * 0.23076923 + (animatedColumn + 2.0) * 0.25 + 0.00961538, vMapUv.y);
    vMapUv.x = vMapUv.x * 0.23076923 + animatedColumn * 0.25 + 0.00961538;
  #endif`;
}

export const IDLE_BEGIN_VERTEX = `
    transformed.xy *= mix(1.0, 1.55, glyphAtlasBlur);
    glyphPulse = 1.0 + idleStrength * 0.035 * sin(idleTime * pulseRate + pulsePhase * 6.2831853);`;

export const IDLE_FRAGMENT_DECLARATIONS = `
uniform float glyphAtlasBlur;
varying float glyphPulse;
varying vec2 glyphBlurUv;`;

export const IDLE_ATLAS_FRAGMENT = `#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D(map, vMapUv);
    if (glyphAtlasBlur > 0.001) {
      vec4 blurredGlyphColor = texture2D(map, glyphBlurUv);
      sampledDiffuseColor = mix(sampledDiffuseColor, blurredGlyphColor, glyphAtlasBlur);
    }
    #ifdef DECODE_VIDEO_TEXTURE
      sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    #endif
    diffuseColor *= sampledDiffuseColor;
  #endif`;

export const IDLE_FRAGMENT_LIGHT = `
    diffuseColor.rgb *= mix(1.0, 1.8, glyphAtlasBlur);
    diffuseColor.rgb *= glyphPulse;`;
