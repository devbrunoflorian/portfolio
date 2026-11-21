// The soft tile has room for the blur on all sides. The vertex shader restores its size.
export const DEFOCUS_PADDING = 1.5;

export function createGlyphAtlas(THREE) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 416;
  textureCanvas.height = 112;
  const context = textureCanvas.getContext('2d');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 92px Consolas, monospace';

  context.fillStyle = '#ffffff';
  context.fillText('0', 52, 55);
  context.fillText('1', 156, 55);
  for (let digit = 0; digit < 2; digit++) {
    const left = (2 + digit) * 104;
    context.save();
    context.beginPath();
    context.rect(left, 0, 104, 112);
    context.clip();
    context.translate(left + 52, 55);
    context.scale(1 / DEFOCUS_PADDING, 1 / DEFOCUS_PADDING);
    context.filter = 'blur(9px)';
    context.fillText(String(digit), 0, 0);
    context.restore();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
