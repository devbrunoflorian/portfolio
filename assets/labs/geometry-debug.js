export function createGeometryDebug(ctx, {
  folderRoots,
  scaffolds,
  fireflies,
  floor,
  render,
}) {
  const { stage, canvas } = ctx;
  const enabled = ctx.config.geometryDebugEnabled;
  let toolbar = null;
  let buttons = [];

  function setMode(mode) {
    if (!enabled) return;
    const currentSlot = Number(canvas.dataset.activeFolderSlot ?? 0);

    folderRoots.forEach((root, index) => {
      root.visible = index === currentSlot;
      root.traverse((object) => {
        if (object.isInstancedMesh) object.visible = mode !== 'solid';
        if (object.userData.depthOccluder) object.visible = mode !== 'solid';
      });
    });

    scaffolds.forEach((scaffold, index) => {
      const overlay = mode === 'overlay';
      scaffold.visible = index === currentSlot && mode !== 'binary';
      scaffold.material.color.setHex(overlay ? 0x256279 : 0x68727e);
      scaffold.material.transparent = overlay;
      scaffold.material.opacity = overlay ? 0.14 : 1;
      scaffold.material.depthTest = true;
      scaffold.material.depthWrite = !overlay;
      scaffold.material.polygonOffset = overlay;
      scaffold.material.polygonOffsetFactor = overlay ? 1 : 0;
      scaffold.material.polygonOffsetUnits = overlay ? 1 : 0;
      scaffold.material.needsUpdate = true;
      scaffold.renderOrder = 0.75;
    });

    fireflies.points.visible = false;
    floor.visible = false;
    canvas.dataset.geometryDebugMode = mode;
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.geometryMode === mode));
    });
    render();
  }

  function mount() {
    if (!enabled) return;
    const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');
    const modes = isEnglish
      ? [['solid', 'Solid GLB'], ['binary', 'Binary only'], ['overlay', 'Overlay']]
      : [['solid', 'GLB sólido'], ['binary', 'Só binários'], ['overlay', 'Sobreposição']];
    toolbar = document.createElement('div');
    toolbar.className = 'lab-geometry-debug';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', isEnglish ? 'Folder geometry comparison' : 'Comparação da geometria da pasta');

    buttons = modes.map(([mode, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.geometryMode = mode;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = label;
      button.addEventListener('click', () => setMode(mode));
      toolbar.append(button);
      return button;
    });
    document.body.append(toolbar);
    stage.dataset.geometryDebug = 'true';
  }

  return {
    mount,
    setMode,
    dispose() { toolbar?.remove(); },
  };
}
