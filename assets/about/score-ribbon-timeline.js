import { scoreRibbonData } from "./score-ribbon-data.js";

export const STATIC_SCORE_BEAT = 134;
export const STATIC_SCORE_WINDOW_BEATS = 12;
const SYSTEM_GAP = 0;

function interpolate(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  if (value >= anchors.at(-1)[0]) return anchors.at(-1)[1];
  const rightIndex = anchors.findIndex(anchor => anchor[0] >= value);
  const left = anchors[rightIndex - 1];
  const right = anchors[rightIndex];
  const progress = (value - left[0]) / Math.max(.000001, right[0] - left[0]);
  return left[1] + (right[1] - left[1]) * progress;
}

function sourceXRange(system) {
  const values = [system.sourceX0, system.sourceX1];
  system.glyphs.forEach(glyph => values.push(glyph.sourceX));
  system.drawings.forEach(drawing => drawing.commands.forEach(command => {
    command.sourcePoints.forEach(point => values.push(point[0]));
  }));
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}

function createTimeline() {
  const drawings = [];
  const glyphs = [];
  const voices = [];
  const bars = [];
  let cursor = 0;

  for (const system of scoreRibbonData.systems) {
    const sourceHalfStep = system.sourceHalfStep;
    const range = sourceXRange(system);
    const base = cursor - range.minimum / sourceHalfStep;
    const timelineX = sourceX => base + sourceX / sourceHalfStep;

    for (const bar of system.bars) {
      bars.push({
        ...bar,
        systemId: system.id,
        xStart: timelineX(bar.xStart),
        xEnd: timelineX(bar.xEnd),
        beatToX: bar.beatToX.map(([beat, sourceX]) => [beat, timelineX(sourceX)]),
      });
    }

    for (const drawing of system.drawings) {
      drawings.push({
        ...drawing,
        width: drawing.width / sourceHalfStep,
        commands: drawing.commands.map(command => ({
          ...command,
          points: command.sourcePoints.map(([sourceX], index) => [
            timelineX(sourceX),
            -command.points[index][1],
          ]),
        })),
      });
    }

    const firstHeadX = Math.min(...system.heads.map(head => head.x));
    for (const glyph of system.glyphs) {
      const isRepeatedSystemNumber = system.firstBar > 1
        && !glyph.noteId
        && /^\d$/.test(glyph.text)
        && glyph.sourceX < firstHeadX;
      if (isRepeatedSystemNumber) continue;
      glyphs.push({
        ...glyph,
        x: timelineX(glyph.sourceX),
        y: -glyph.v,
        scaleX: glyph.scaleX / sourceHalfStep,
        scaleY: glyph.scaleY / sourceHalfStep,
      });
    }

    for (const voice of system.voices) {
      voices.push({ ...voice });
    }

    cursor += (range.maximum - range.minimum) / sourceHalfStep + SYSTEM_GAP;
  }

  const beatAnchors = bars.flatMap((bar, index) => (
    index === bars.length - 1 ? bar.beatToX : bar.beatToX.slice(0, -1)
  ));
  voices.forEach(voice => { voice.x = interpolate(voice.beat, beatAnchors); });
  voices.sort((left, right) => left.beat - right.beat || left.track - right.track);

  return {
    x0: 0,
    x1: Math.max(0, cursor - SYSTEM_GAP),
    y0: -18,
    y1: 12,
    staffLines: [-8, -6, -4, -2, 0],
    staffBottom: 0,
    halfStep: 1,
    samplingStep: .7,
    totalBeats: scoreRibbonData.totalBeats,
    bars,
    beatAnchors,
    pdfDrawings: drawings,
    pdfGlyphs: glyphs,
    pdfGlyphPaths: scoreRibbonData.glyphPaths,
    voices,
  };
}

export const scoreRibbonTimeline = createTimeline();

export function scorePositionAtBeat(beat) {
  const safeBeat = Math.max(0, Math.min(scoreRibbonData.totalBeats, beat));
  return interpolate(safeBeat, scoreRibbonTimeline.beatAnchors);
}

export function scoreWindowAtBeat(beat, viewportWidth) {
  const visibleBars = viewportWidth <= 700 ? 1 : 3;
  const safeBeat = Math.min(Math.max(beat, 0), scoreRibbonData.totalBeats - .000001);
  const centerBar = Math.min(scoreRibbonData.bars, Math.floor(safeBeat / 4) + 1);
  const firstBar = Math.max(
    1,
    Math.min(scoreRibbonData.bars - visibleBars + 1, centerBar - Math.floor(visibleBars / 2)),
  );
  const lastBar = Math.min(scoreRibbonData.bars, firstBar + visibleBars - 1);
  const first = scoreRibbonTimeline.bars[firstBar - 1];
  const last = scoreRibbonTimeline.bars[lastBar - 1];
  return {
    startBeat: first.beatStart,
    endBeat: last.beatEnd,
    startX: first.xStart,
    endX: last.xEnd,
    firstBar,
    lastBar,
  };
}

export function scorePlaybackWindowAtBeat(beat, viewportWidth) {
  const visibleBars = viewportWidth <= 700 ? 1 : 3;
  const typicalBarWidth = [...scoreRibbonTimeline.bars]
    .map(bar => bar.xEnd - bar.xStart)
    .sort((left, right) => left - right)[Math.floor(scoreRibbonTimeline.bars.length / 2)];
  const width = typicalBarWidth * visibleBars;
  const center = scorePositionAtBeat(beat);
  const startX = Math.max(scoreRibbonTimeline.x0, Math.min(scoreRibbonTimeline.x1 - width, center - width / 2));
  const endX = Math.min(scoreRibbonTimeline.x1, startX + width);
  const visible = scoreRibbonTimeline.bars.filter(bar => bar.xEnd >= startX && bar.xStart <= endX);
  return {
    startX,
    endX,
    startBeat: visible[0]?.beatStart ?? 0,
    endBeat: visible.at(-1)?.beatEnd ?? scoreRibbonData.totalBeats,
    firstBar: visible[0]?.number ?? 1,
    lastBar: visible.at(-1)?.number ?? scoreRibbonData.bars,
  };
}
