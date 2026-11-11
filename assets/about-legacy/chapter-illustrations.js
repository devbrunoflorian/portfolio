const noOperation = () => {};

let injectedStylesheet = null;
let stylesheetUsers = 0;
let ownsInjectedStylesheet = false;

function acquireStylesheet() {
  let link = document.querySelector("link[data-chapter-illustrations]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./chapter-illustrations.css?art-image-layer-1", import.meta.url).href;
    link.dataset.chapterIllustrations = "true";
    document.head.append(link);
    injectedStylesheet = link;
    ownsInjectedStylesheet = true;
  }

  const owned = link === injectedStylesheet && ownsInjectedStylesheet;

  stylesheetUsers += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    stylesheetUsers = Math.max(0, stylesheetUsers - 1);
    if (owned && stylesheetUsers === 0 && injectedStylesheet === link) {
      link.remove();
      injectedStylesheet = null;
      ownsInjectedStylesheet = false;
    }
  };
}

function createCodeScene() {
  const scene = document.createElement("div");
  scene.className = "chapter-code-scene";
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = `
    <svg viewBox="0 0 1000 320" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id="chapter-code-trace" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#7d7ee8" />
          <stop offset="0.52" stop-color="#a992dc" />
          <stop offset="1" stop-color="#63c7e5" />
        </linearGradient>
      </defs>
      <g class="code-route-plane code-route-plane-back">
        <path pathLength="1" data-route style="--route-start: .02; --route-scale: 1.020408" d="M 28 77 H 144 L 174 48 H 318 Q 340 48 340 26 V 12 H 498" />
        <path pathLength="1" data-route style="--route-start: .16; --route-scale: 1.190476" d="M 34 224 H 123 Q 148 224 148 200 V 178 H 302 L 331 149 H 464 V 120 Q 464 98 486 98 H 646" />
        <path pathLength="1" data-route style="--route-start: .36; --route-scale: 1.5625" d="M 278 286 V 254 Q 278 234 298 234 H 468 L 492 258 H 600 H 710" />
      </g>
      <g class="code-route-plane code-route-plane-front">
        <path pathLength="1" data-route style="--route-start: .08; --route-scale: 1.086957" d="M 76 150 H 190 L 216 178 H 394 Q 418 178 418 200 V 252 H 526 Q 552 252 552 230 V 212 H 664 H 806" />
        <path pathLength="1" data-route style="--route-start: .28; --route-scale: 1.388889" d="M 456 38 V 78 Q 456 100 478 100 H 558 L 584 126 H 696 V 164 Q 696 186 718 186 H 866 L 895 156 H 968" />
        <path pathLength="1" data-route style="--route-start: .48; --route-scale: 1.923077" d="M 618 286 V 252 H 730 Q 758 252 758 224 V 192 H 868 L 897 164 H 970" />
      </g>
      <g class="code-route-terminals">
        <circle data-terminal style="--terminal-start: .2; --terminal-scale: 7.142857" cx="498" cy="12" r="3.2" />
        <rect data-terminal style="--terminal-start: .34; --terminal-scale: 7.142857" x="642" y="94" width="7" height="7" />
        <circle data-terminal style="--terminal-start: .44; --terminal-scale: 7.142857" cx="710" cy="286" r="3.2" />
        <rect data-terminal style="--terminal-start: .51; --terminal-scale: 7.142857" x="802" y="208" width="7" height="7" />
        <circle data-terminal style="--terminal-start: .59; --terminal-scale: 7.142857" cx="968" cy="156" r="3.2" />
        <rect data-terminal style="--terminal-start: .66; --terminal-scale: 7.142857" x="966" y="282" width="7" height="7" />
      </g>
    </svg>`;

  return scene;
}

function createPaintScene() {
  const scene = document.createElement("div");
  scene.className = "chapter-paint-scene";
  scene.setAttribute("aria-hidden", "true");

  const wash = document.createElement("div");
  wash.className = "chapter-paint-wash";

  const image = document.createElement("img");
  image.className = "chapter-paint-ink";
  image.dataset.artBackground = "";
  image.src = new URL("./illustrations/painted-clef.png", import.meta.url).href;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");

  const splashes = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  splashes.classList.add("chapter-paint-splashes");
  splashes.setAttribute("viewBox", "0 0 640 320");
  splashes.setAttribute("preserveAspectRatio", "none");
  splashes.setAttribute("focusable", "false");
  splashes.innerHTML = `
    <g class="paint-splash-violet" fill="currentColor">
      <circle cx="88" cy="226" r="2.6" />
      <circle cx="101" cy="216" r="1.3" />
      <circle cx="122" cy="235" r="1.8" />
      <circle cx="266" cy="54" r="1.9" />
      <circle cx="281" cy="66" r="1.1" />
      <circle cx="472" cy="210" r="2.2" />
      <circle cx="491" cy="198" r="1.2" />
      <circle cx="516" cy="219" r="1.7" />
      <path d="M 118 238 q 7 -7 13 -2 q -2 9 -12 10 z" />
      <path d="M 490 202 q 5 -8 11 -4 q 0 7 -9 9 z" />
    </g>
    <g class="paint-splash-blue" fill="currentColor">
      <circle cx="188" cy="82" r="1.5" />
      <circle cx="202" cy="72" r="2.2" />
      <circle cx="215" cy="93" r="1" />
      <circle cx="388" cy="260" r="2.4" />
      <circle cx="404" cy="248" r="1.4" />
      <circle cx="423" cy="268" r="1.1" />
      <path d="M 201 96 q 4 -6 8 -2 q -1 6 -7 7 z" />
      <path d="M 404 275 q 6 -5 10 0 q -3 7 -9 5 z" />
    </g>`;

  scene.append(wash, image, splashes);
  return { scene, wash, image, splashes };
}

export function mountChapterIllustrations(root) {
  if (!root?.querySelector) return noOperation;

  const codeAnchor = root.querySelector(".code-score-anchor");
  const paintAnchor = root.querySelector(".art-score-anchor");
  if (!codeAnchor && !paintAnchor) return noOperation;

  const releaseStylesheet = acquireStylesheet();
  const codeScene = codeAnchor && !codeAnchor.querySelector(".chapter-code-scene")
    ? createCodeScene()
    : null;
  const paintParts = paintAnchor && !paintAnchor.querySelector(".chapter-paint-scene")
    ? createPaintScene()
    : null;

  if (codeScene) codeAnchor.append(codeScene);
  if (paintParts) paintAnchor.append(paintParts.scene);

  return () => {
    codeScene?.remove();
    paintParts?.scene.remove();
    releaseStylesheet();
  };
}
