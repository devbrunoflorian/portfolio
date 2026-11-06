const headings = [...document.querySelectorAll(".scroll-fill")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const fillWords = new Map();
let frameRequested = false;

function wrapWords(heading) {
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim()) textNodes.push(node);
  }

  const words = [];
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/u)) {
      if (!part) continue;
      if (/^\s+$/u.test(part)) {
        fragment.append(document.createTextNode(part));
        continue;
      }

      const word = document.createElement("span");
      word.className = "scroll-fill-word";
      word.textContent = part;
      const ink = getComputedStyle(node.parentElement).color;
      word.style.setProperty("--word-ink", ink);
      fragment.append(word);
      words.push(word);
    }
    node.replaceWith(fragment);
  }

  heading.dataset.scrollFillReady = "true";
  fillWords.set(heading, words);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateFill() {
  frameRequested = false;
  const viewportHeight = window.innerHeight;
  const startLine = viewportHeight * 0.82;
  const finishLine = viewportHeight * 0.28;

  for (const [heading, words] of fillWords) {
    const progress = motionPreference.matches
      ? 1
      : clamp((startLine - heading.getBoundingClientRect().top) / (startLine - finishLine), 0, 1);

    words.forEach((word, index) => {
      const wordProgress = clamp(progress * words.length - index, 0, 1);
      word.style.setProperty("--word-fill", `${(wordProgress * 100).toFixed(1)}%`);
    });
  }
}

function requestFillUpdate() {
  if (frameRequested) return;
  frameRequested = true;
  window.requestAnimationFrame(updateFill);
}

if (headings.length) {
  headings.forEach(wrapWords);
  requestFillUpdate();
  window.addEventListener("scroll", requestFillUpdate, { passive: true });
  window.addEventListener("resize", requestFillUpdate, { passive: true });
  motionPreference.addEventListener("change", requestFillUpdate);
  document.fonts?.ready.then(requestFillUpdate);
}
