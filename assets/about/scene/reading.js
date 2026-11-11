/** Pick the section under the reading line, including long sections and large jumps. */
export function readingChapterIndex(bounds, readingLine) {
  if (!bounds.length) return -1;
  let best = 0;
  let distance = Infinity;
  bounds.forEach((item, index) => {
    const next = Math.max(item.top - readingLine, readingLine - item.bottom, 0);
    if (next < distance) {
      distance = next;
      best = index;
    }
  });
  return best;
}

/** Rectangles reserve the actual copy, not the empty space of its chapter. */
export function visibleReadingRegions(root, width, height) {
  const selector = ".opening-copy h1, .opening-intro, .opening-actions, .chapter-copy, .stack-panel, .chapter-heading > div, .chapter-heading > p, .art-copy, .games-copy, .about-closing h2, .closing-links, .score-frame figcaption, .music-controls > p, .about-mixer";
  return [...root.querySelectorAll(selector)].map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width)
    .slice(0, 16)
    .map(rect => [rect.left - 10, rect.top - 10, rect.right + 10, rect.bottom + 10]);
}
