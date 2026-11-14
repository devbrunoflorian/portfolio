export type JourneyChapter = 'music' | 'art' | 'games';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

/** Absolute scroll sampling makes reverse scroll and large jumps deterministic. */
export function journeyState(scroll: number, start: number, travel: number) {
  const progress = clamp((scroll - start) / Math.max(1, travel));
  const entering = progress < .4;
  const presence = progress < .12
    ? 0
    : progress < .4
      ? smooth((progress - .12) / .28)
      : progress <= .6
        ? 1
        : progress < .88
          ? 1 - smooth((progress - .6) / .28)
          : 0;
  const chapter: JourneyChapter = progress < .25 ? 'music' : progress > .75 ? 'games' : 'art';
  const interactiveChapter: JourneyChapter = progress < .4 ? 'music' : progress < .88 ? 'art' : 'games';
  const depth = progress < .4
    ? (progress - .4) / .4
    : progress <= .6
      ? 0
      : (progress - .6) / .4;
  return { progress, presence, entering, chapter, interactiveChapter, depth };
}
