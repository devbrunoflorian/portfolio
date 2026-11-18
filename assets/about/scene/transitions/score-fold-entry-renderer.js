import { scoreRibbonData } from "../../../about-legacy/score-ribbon-data.js";
import { scoreRibbonTimeline as score } from "../../../about-legacy/score-ribbon-timeline.js";
import { createTravelProjector } from "../../../about-legacy/score-travel-geometry.js";
import { noteHeadStemPairs, projectHeadStem } from "../../../about-legacy/score-head-stems.js";

const PITCH_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const NOTE_RANGE = { first: 33, last: 35 };
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const mix = (from, to, progress) => from + (to - from) * progress;

const DARK_PALETTE = {
  staffFar: "#777184",
  staffNear: "#f0e1ff",
  note: "#d9d0e5",
  marker: "#ffe292",
  atmosphere: "rgb(73 37 118 / 21%)",
  atmosphereEdge: "rgb(8 8 14 / 0%)",
};

const LIGHT_PALETTE = {
  staffFar: "#9a919e",
  staffNear: "#28232e",
  note: "#423a4c",
  marker: "#9a6700",
  atmosphere: "rgb(107 33 168 / 7%)",
  atmosphereEdge: "rgb(243 239 234 / 0%)",
};

function blendHex(from, to, progress) {
  const parse = color => color.match(/[\da-f]{2}/gi).map(value => Number.parseInt(value, 16));
  const start = parse(from);
  const end = parse(to);
  const channels = start.map((value, index) => Math.round(mix(value, end[index], clamp(progress))));
  return `rgb(${channels.join(" ")})`;
}

const glyphById = new Map(score.pdfGlyphs.filter(glyph => glyph.noteId).map(glyph => [glyph.noteId, glyph]));
const allNotes = scoreRibbonData.systems
  .flatMap(system => system.heads)
  .filter(head => head.bar >= NOTE_RANGE.first && head.bar <= NOTE_RANGE.last)
  .flatMap(head => {
    const glyph = glyphById.get(head.id);
    if (!glyph) return [];
    return [{ id: head.id, bar: head.bar, midi: head.writtenMidi, x: glyph.x, y: glyph.y, glyph }];
  });
const headStemPairs = noteHeadStemPairs(score, allNotes);
const pairById = new Map(headStemPairs.map(pair => [pair.note.id, pair]));
const headPaths = new Map();
const barsByNumber = new Map(score.bars.map(bar => [bar.number, bar]));

function windowForWidth(width) {
  const firstBar = width <= 700 ? 34 : NOTE_RANGE.first;
  const lastBar = width <= 700 ? 34 : NOTE_RANGE.last;
  const start = barsByNumber.get(firstBar);
  const end = barsByNumber.get(lastBar);
  return {
    firstBar,
    lastBar,
    x0: start.xStart,
    x1: end.xEnd,
  };
}

function notePath(glyph) {
  let path = headPaths.get(glyph.glyph);
  if (!path) {
    path = new Path2D(score.pdfGlyphPaths[glyph.glyph]);
    headPaths.set(glyph.glyph, path);
  }
  return path;
}

/** Draws the compact 2b camera study from real source notes, without its review UI. */
export function drawScoreFoldEntry(context, width, height, pose, theme = "dark") {
  const palette = theme === "light" ? LIGHT_PALETTE : DARK_PALETTE;
  context.clearRect(0, 0, width, height);
  const atmosphere = context.createRadialGradient(width * .52, height * .52, 4, width * .52, height * .52, width * .53);
  atmosphere.addColorStop(0, palette.atmosphere);
  atmosphere.addColorStop(1, palette.atmosphereEdge);
  context.fillStyle = atmosphere;
  context.fillRect(0, 0, width, height);

  const view = windowForWidth(width);
  const project = createTravelProjector(width, height, score, pose, view, .2, true);
  const queue = [];
  const divisions = Math.max(64, Math.min(180, Math.ceil(width / 7)));
  const markerId = view.firstBar === 33 ? "guitar-33-4-1" : allNotes.find(note => note.bar === view.firstBar)?.id;

  for (let index = 0; index < divisions; index += 1) {
    const x0 = view.x0 + (view.x1 - view.x0) * index / divisions;
    const x1 = view.x0 + (view.x1 - view.x0) * (index + 1) / divisions;
    for (const y of score.staffLines) {
      const start = project(x0, y);
      const end = project(x1, y);
      const proximity = clamp((start.perspective - .4) / .9);
      queue.push({ depth: (start.depth + end.depth) / 2, paint() {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = blendHex(palette.staffFar, palette.staffNear, proximity);
        context.globalAlpha = .48 + proximity * .52;
        context.lineWidth = Math.max(.65, start.perspective * 1.2);
        context.stroke();
      } });
    }
  }

  for (const edge of [
    barsByNumber.get(view.firstBar).xStart,
    ...Array.from({ length: view.lastBar - view.firstBar + 1 }, (_, index) => barsByNumber.get(view.firstBar + index).xEnd),
  ]) {
    for (let y = -8; y < 0; y += .25) {
      const start = project(edge, y);
      const end = project(edge, y + .25);
      queue.push({ depth: (start.depth + end.depth) / 2 + .2, paint() {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = palette.staffNear;
        context.globalAlpha = .72;
        context.lineWidth = Math.max(.75, start.perspective * 1.4);
        context.stroke();
      } });
    }
  }

  for (const note of allNotes) {
    if (note.bar < view.firstBar || note.bar > view.lastBar) continue;
    const point = project(note.x, note.y);
    const pair = pairById.get(note.id);
    const shape = pair?.stem ? projectHeadStem(pair, project) : null;
    const marker = note.id === markerId;
    const color = marker ? palette.marker : palette.note;
    if (note.y > 0) {
      for (let y = 2; y <= note.y; y += 2) {
        const left = project(note.x - 1.6, y);
        const right = project(note.x + 1.6, y);
        queue.push({ depth: (left.depth + right.depth) / 2 + .25, paint() {
          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.strokeStyle = color;
          context.globalAlpha = marker ? .9 : .72;
          context.lineWidth = Math.max(.8, point.perspective);
          context.stroke();
        } });
      }
    }

    if (shape) queue.push({ depth: point.depth + .01, paint() {
      context.beginPath();
      context.moveTo(shape.contact.x, shape.contact.y);
      context.lineTo(shape.end.x, shape.end.y);
      context.strokeStyle = color;
      context.globalAlpha = marker ? 1 : .85;
      context.lineWidth = Math.max(.65, pair.stem.width * point.scale);
      context.stroke();
    } });

    queue.push({ depth: point.depth + .02, paint() {
      const path = notePath(note.glyph);
      context.save();
      context.translate(point.x, point.y);
      context.scale(note.glyph.scaleX * point.scale, note.glyph.scaleY * point.scale);
      context.fillStyle = color;
      context.globalAlpha = marker ? 1 : .88;
      context.fill(path);
      context.restore();
      if (marker) {
        const radius = Math.max(6, point.scale * 3);
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.strokeStyle = palette.marker;
        context.globalAlpha = .9;
        context.lineWidth = 1.2;
        context.stroke();
      }
    } });
  }

  queue.sort((left, right) => left.depth - right.depth);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const item of queue) item.paint();
  context.globalAlpha = 1;
}
