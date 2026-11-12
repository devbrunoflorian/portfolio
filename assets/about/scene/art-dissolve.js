import * as THREE from "../../about-legacy/vendor/three-score.min.js";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  uniform float uDissolve;
  varying vec2 vUv;
  const float imageOpacity = 0.58;

  mat3 sobelX = mat3(-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0);
  mat3 sobelY = mat3(-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0);

  float getImageLuminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  float sobel(vec2 uv, vec2 texelSize) {
    float gx = 0.0;
    float gy = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 offset = vec2(float(i), float(j)) * texelSize;
        float sampleValue = getImageLuminance(texture2D(uTexture, uv + offset).rgb);
        gx += sampleValue * sobelX[i + 1][j + 1];
        gy += sampleValue * sobelY[i + 1][j + 1];
      }
    }
    return sqrt(gx * gx + gy * gy);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    float viewAspect = uResolution.x / uResolution.y;
    float imageAspect = uImageResolution.x / uImageResolution.y;
    vec2 uv = vUv;
    float insideImage = 1.0;

    if (viewAspect > imageAspect) {
      float imageWidth = imageAspect / viewAspect;
      float inset = (1.0 - imageWidth) * 0.5;
      uv.x = (vUv.x - inset) / imageWidth;
      insideImage = step(inset, vUv.x) * step(vUv.x, 1.0 - inset);
    } else {
      float imageHeight = viewAspect / imageAspect;
      float inset = (1.0 - imageHeight) * 0.5;
      uv.y = (vUv.y - inset) / imageHeight;
      insideImage = step(inset, vUv.y) * step(vUv.y, 1.0 - inset);
    }

    vec4 texColor = texture2D(uTexture, clamp(uv, 0.0, 1.0));

    vec2 centeredUv = uv - vec2(0.5);
    centeredUv.x *= imageAspect;
    float dist = length(centeredUv);
    float angle = atan(centeredUv.y, centeredUv.x);
    float noiseScale = 6.0;
    vec2 pixelatedUv = floor(uv * uImageResolution / noiseScale) * noiseScale / uImageResolution;
    float blockNoise = fbm(pixelatedUv * 100.0) * 0.15;
    float angularNoise = fbm(vec2(angle * 5.0, 0.0)) * 0.15;
    float normalizedDist = (dist + blockNoise + angularNoise) / length(vec2(imageAspect * 0.5, 0.5));
    float threshold = uDissolve * 1.5;
    float fade = 1.0 - uDissolve;

    float edge = clamp(pow(sobel(uv, 1.0 / uImageResolution), 0.7) * 2.0, 0.0, 1.0);
    vec3 finalColor = texColor.rgb;
    float edgeGlow = edge * fade;
    finalColor += vec3(edgeGlow * fade);

    float dissolveMask = 1.0 - smoothstep(threshold - 0.03, threshold, normalizedDist);
    float edgeZoneWidth = 0.15 * (1.0 - uDissolve) + 0.02;
    float edgeZone = 1.0 - smoothstep(edgeZoneWidth, edgeZoneWidth + 0.04, abs(normalizedDist - threshold));
    float sparkle = hash(floor(uv * uImageResolution / 4.0)) * edgeZone;
    finalColor += vec3(sparkle * 3.0 * fade);

    gl_FragColor = vec4(finalColor, dissolveMask * texColor.a * insideImage * imageOpacity);
  }
`;

// LinearFilter is not exported by the reduced Three.js bundle used here.
const LINEAR_FILTER = 1006;

function createImageTexture(image) {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The Art image could not be prepared for the dissolve.");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const texture = new THREE.DataTexture(pixels.data, source.width, source.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = LINEAR_FILTER;
  texture.magFilter = LINEAR_FILTER;
  texture.colorSpace = "srgb";
  texture.needsUpdate = true;
  return texture;
}

export async function mountArtDissolve(image, initialProgress = 0) {
  const host = image?.parentElement;
  if (!host) throw new Error("The Art dissolve needs its image layer.");
  if (!image.complete || !image.naturalWidth) await image.decode();

  const canvas = document.createElement("canvas");
  canvas.className = "art-dissolve-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const texture = createImageTexture(image);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = "srgb";

  const uniforms = {
    uTexture: { value: texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageResolution: { value: new THREE.Vector2(image.naturalWidth, image.naturalHeight) },
    uDissolve: { value: 1 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  scene.add(new THREE.Mesh(geometry, material));

  let disposed = false;
  let contextAvailable = true;
  let lastProgress = Number.NaN;
  let lastWidth = 0;
  let lastHeight = 0;

  function render(progress) {
    if (disposed || !contextAvailable) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, Math.round(host.clientHeight * 1.12));
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      lastWidth = width;
      lastHeight = height;
      lastProgress = Number.NaN;
    }
    const nextProgress = Math.max(0, Math.min(1, progress));
    if (nextProgress === lastProgress) return;
    uniforms.uDissolve.value = nextProgress;
    lastProgress = nextProgress;
    renderer.render(scene, camera);
  }

  function showFallback() {
    host.removeAttribute("data-art-dissolve-ready");
    canvas.hidden = true;
  }

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    contextAvailable = false;
    showFallback();
  });

  host.append(canvas);
  render(initialProgress);
  canvas.hidden = false;
  host.dataset.artDissolveReady = "true";

  const resizeObserver = new ResizeObserver(() => render(lastProgress));
  resizeObserver.observe(host);

  return {
    update(progress, { reducedMotion = false, motionPaused = false } = {}) {
      if (reducedMotion) {
        showFallback();
        return;
      }
      if (!contextAvailable) { showFallback(); return; }
      if (motionPaused) return;
      canvas.hidden = false;
      host.dataset.artDissolveReady = "true";
      render(progress);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      host.removeAttribute("data-art-dissolve-ready");
      canvas.remove();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    },
  };
}
