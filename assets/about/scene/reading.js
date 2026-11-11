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
