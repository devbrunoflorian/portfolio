export const SCORE_MATERIAL = Object.freeze({
  STAFF: 0,
  HEAD: 1,
  CLEF: 2,
  TRIPLET: 3,
  ACCIDENTAL: 4,
  REST: 5,
  STEM: 6,
  BEAM: 7,
  VOICE: 8,
  SPATTER: 9,
});

const SPRITE_SIZE = 8;
const SPRITE_PATTERNS = [
  [
    '........',
    '..1221..',
    '.123321.',
    '12344321',
    '12344321',
    '.123321.',
    '..1221..',
    '........',
  ],
  [
    '..122...',
    '..1332..',
    '...3.2..',
    '....32..',
    '..1232..',
    '.23.32..',
    '..2.32..',
    '.1221...',
  ],
  [
    '.12221..',
    '13...32.',
    '.....32.',
    '....32..',
    '...122..',
    '.....32.',
    '13...32.',
    '.12221..',
  ],
  [
    '..1..1..',
    '..2..2..',
    '22222222',
    '..3..3..',
    '33333333',
    '..2..2..',
    '..1..1..',
    '........',
  ],
  [
    '..122...',
    '..1332..',
    '..3.32..',
    '..3.32..',
    '..3.32..',
    '..3.32..',
    '.12221..',
    '........',
  ],
];

const SPRITE_PALETTES = [
  [[28, 31, 53], [97, 133, 197], [132, 174, 235], [225, 242, 255]],
  [[28, 31, 53], [117, 100, 178], [99, 156, 224], [239, 224, 255]],
  [[34, 30, 52], [160, 118, 197], [225, 164, 83], [255, 224, 157]],
  [[30, 33, 54], [68, 137, 204], [182, 118, 222], [231, 240, 255]],
  [[30, 29, 48], [131, 105, 175], [193, 140, 213], [239, 218, 177]],
];

export function pixelSpriteAtlasData() {
  const width = SPRITE_SIZE * SPRITE_PATTERNS.length;
  const height = SPRITE_SIZE;
  const data = new Uint8Array(width * height * 4);
  for (let sprite = 0; sprite < SPRITE_PATTERNS.length; sprite += 1) {
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        const colorIndex = Number(SPRITE_PATTERNS[sprite][y][x] || 0);
        if (!colorIndex) continue;
        const offset = ((SPRITE_SIZE - 1 - y) * width + sprite * SPRITE_SIZE + x) * 4;
        data.set([...SPRITE_PALETTES[sprite][colorIndex - 1], 255], offset);
      }
    }
  }
  return { data, width, height, spriteSize: SPRITE_SIZE, spriteCount: SPRITE_PATTERNS.length };
}

export function createPixelSpriteAtlas(THREE) {
  const source = pixelSpriteAtlasData();
  const texture = new THREE.DataTexture(source.data, source.width, source.height, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter ?? texture.magFilter;
  texture.minFilter = THREE.NearestFilter ?? texture.minFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export const scoreMaterialShader = `
  vec4 scoreChapterWeights(float value){
    if(value<0.)return vec4(0.,1.,0.,0.);
    float journey=clamp(value,0.,5.);
    if(journey<1.)return mix(vec4(0.,1.,0.,0.),vec4(1.,0.,0.,0.),smoothstep(0.,1.,journey));
    if(journey<2.)return mix(vec4(1.,0.,0.,0.),vec4(0.,1.,0.,0.),smoothstep(0.,1.,journey-1.));
    if(journey<3.)return mix(vec4(0.,1.,0.,0.),vec4(0.,0.,1.,0.),smoothstep(0.,1.,journey-2.));
    if(journey<4.)return mix(vec4(0.,0.,1.,0.),vec4(0.,0.,0.,1.),smoothstep(0.,1.,journey-3.));
    return mix(vec4(0.,0.,0.,1.),vec4(0.,1.,0.,0.),smoothstep(0.,1.,journey-4.));
  }
  float scoreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  float scoreSpriteSlot(float material){
    if(material<.5||material>5.5)return -1.;
    if(material<1.5)return 0.;
    if(material<2.5)return 1.;
    if(material<3.5)return 2.;
    if(material<4.5)return 3.;
    if(material<5.5)return 4.;
    return -1.;
  }
  vec4 scorePixelSprite(sampler2D atlas,float material,vec2 local){
    float slot=scoreSpriteSlot(material);
    if(slot<0.)return vec4(0.);
    vec2 pixel=floor(clamp(local,vec2(0.),vec2(.9999))*8.);
    return texture2D(atlas,vec2((slot*8.+pixel.x+.5)/40.,(pixel.y+.5)/8.));
  }
  float scoreCodeTrace(vec2 local){
    float line=step(.12,local.x)*step(local.x,.78)*(1.-smoothstep(.018,.055,abs(local.y-.22)));
    float stem=(1.-smoothstep(.018,.05,abs(local.x-.72)))*step(.24,local.y)*step(local.y,.79);
    float terminal=1.-smoothstep(.11,.19,length(local-vec2(.72,.78)));
    float contact=1.-smoothstep(.1,.17,length(local-vec2(.16,.22)));
    return max(max(line,stem),max(terminal,contact));
  }
  float scoreBrushNoise(vec2 p){
    vec2 cell=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(scoreHash(cell),scoreHash(cell+vec2(1.,0.)),f.x),
      mix(scoreHash(cell+vec2(0.,1.)),scoreHash(cell+vec2(1.,1.)),f.x),f.y);
  }
  // A reversible wetting front travels along the source score, never screen space.
  float scorePigmentJourney(float value,float along){
    if(value<=2.||value>=3.)return value;
    float progress=value-2.;
    float front=smoothstep(along*.36, .64+along*.36, progress);
    return 2.+front;
  }
`;
