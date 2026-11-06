// A reusable written pattern with separate, stable note identities at render time.
// Bars 18–20 repeat this figure in the current score; define its notes once.
const tripletFigure = Object.freeze([
  [0, 52], [8, 66], [16, 67], [24, 74], [32, 67], [40, 66],
  [48, 52], [56, 66], [64, 67], [72, 74], [80, 67], [88, 66],
].map(([beatTick, pitch]) => Object.freeze({ beatTick, durationTicks: 8, pitch, tuplet: [3, 2] })));

export const scoreGridStudy = Object.freeze({
  beatsPerBar: 4,
  subdivisionsPerBeat: 24,
  pixelsPerBeat: 80,
  barWidth: 320,
  cropTop: 120,
  cropHeight: 252,
  staffTop: 176.5,
  staffBottom: 272.5,
  staffLineGap: 24,
  patterns: Object.freeze({
    "triplet-figure": Object.freeze({ sourceBar: 18, events: tripletFigure }),
  }),
  bars: Object.freeze([
    Object.freeze({ number: 18, pattern: "triplet-figure" }),
    Object.freeze({ number: 19, pattern: "triplet-figure" }),
    Object.freeze({ number: 20, pattern: "triplet-figure" }),
  ]),
});
