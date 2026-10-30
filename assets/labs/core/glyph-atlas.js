export function createGlyphAtlas(THREE) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 416;
  textureCanvas.height = 112;
  const context = textureCanvas.getContext('2d');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 76px "Arial", sans-serif';

  context.fillStyle = '#ffffff';
  context.fillText('0', 52, 55);
  context.fillText('1', 156, 55);
  context.save();
  context.beginPath();
  context.rect(208, 0, 104, 112);
  context.clip();
  context.filter = 'blur(24px)';
  context.fillText('0', 260, 55);
  context.restore();
  context.save();
  context.beginPath();
  context.rect(312, 0, 104, 112);
  context.clip();
  context.filter = 'blur(24px)';
  context.fillText('1', 364, 55);
  context.restore();

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
