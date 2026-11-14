export type JourneyChapter = 'music' | 'art' | 'games';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

/** Absolute scroll sampling makes reverse scroll and large jumps deterministic. */
export function journeyState(scroll: number, start: number, travel: number) {
  const progress = clamp((scroll - start) / Math.max(1, travel));
  const entering = progress <= .5;
  const presence = smooth(entering ? progress * 2 : (1 - progress) * 2);
  const chapter: JourneyChapter = progress < .25 ? 'music' : progress > .75 ? 'games' : 'art';
  return { progress, presence, entering, chapter, depth: (progress - .5) * 2 };
}
