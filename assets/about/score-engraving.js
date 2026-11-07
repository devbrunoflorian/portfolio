import { noteHeadStemPairs, projectHeadStem } from './score-head-stems.js';

const inRange = (x, range) => x >= range.x0 && x <= range.x1;
const lerp = (a, b, t) => a + (b - a) * t;

/** Preserve PDF beam groups; stem tips are the attachment anchors in perspective. */
export function buildEngraving(study, notes, view) {
  const pairs = noteHeadStemPairs(study, notes);
  const drawings = study.pdfDrawings.filter(d => d.minX >= view.x0 && d.maxX <= view.x1);
  const beams = drawings.filter(d => d.fill).map(drawing => {
    const members = pairs.filter(pair => pair.stem.end[0] >= drawing.minX - .3
      && pair.stem.end[0] <= drawing.maxX + .3).sort((a, b) => a.stem.end[0] - b.stem.end[0]);
    if (members.length !== 3) throw new Error('Expected three stems per source triplet beam');
    const vertices = drawing.commands.flatMap(c => c.points);
    return { drawing, members, vertices };
  });
  const nearestBeam = (x, y) => beams.reduce((best, beam) => {
    const middle = beam.members[1].stem.end;
    const distance = Math.hypot(x - middle[0], y - middle[1]);
    return !best || distance < best.distance ? { beam, distance } : best;
  }, null)?.beam;

  // Some PDF paths repeat earlier bracket subpaths. Paint each command only once.
  const commands = new Map();
  for (const drawing of drawings.filter(d => !d.fill && d.commands.length > 1)) {
    for (const command of drawing.commands) {
      const key = JSON.stringify(command);
      if (commands.has(key)) continue;
      const [x, y] = command.points[0];
      commands.set(key, { command, width: drawing.width, beam: nearestBeam(x, y) });
    }
  }
  const glyphs = study.pdfGlyphs.filter(g => inRange(g.x, view) && !g.noteId && g.text !== '=')
    .map(glyph => {
      if (glyph.text === '3') return { glyph, beam: nearestBeam(glyph.x, glyph.y) };
      const pair = pairs.reduce((best, pair) => {
        const distance = Math.hypot(glyph.x - pair.glyph.x, glyph.y - pair.glyph.y);
        return !best || distance < best.distance ? { pair, distance } : best;
      }, null)?.pair;
      return { glyph, pair };
    });
  const bar = study.bars.find(b => b.number === 32);
  return { pairs, beams, brackets: [...commands.values()], glyphs,
    rest: { bar: 32, x: (bar.xStart + bar.xEnd) / 2, y: -6, width: 3.2, height: 1.1 } };
}

function anchorSegment(beam, x) {
  const members = beam.members;
  const index = x <= members[1].stem.end[0] ? 0 : 1;
  const a = members[index], b = members[index + 1];
  return { a, b, t: (x - a.stem.end[0]) / (b.stem.end[0] - a.stem.end[0]) };
}

/** The surface bends the beam; an interpolated correction keeps all three tips attached. */
export function projectBeamPoint(beam, x, y, project) {
  const { a, b, t } = anchorSegment(beam, x);
  const sourceY = lerp(a.stem.end[1], b.stem.end[1], t);
  const actualA = projectHeadStem(a, project), actualB = projectHeadStem(b, project);
  const rawA = project(...a.stem.end), rawB = project(...b.stem.end);
  const raw = project(x, sourceY);
  const scale = lerp(actualA.head.scale, actualB.head.scale, t);
  return { ...raw,
    x: raw.x + lerp(actualA.end.x - rawA.x, actualB.end.x - rawB.x, t),
    y: raw.y + lerp(actualA.end.y - rawA.y, actualB.end.y - rawB.y, t) + (y - sourceY) * scale,
    scale };
}

export function projectEngravingGlyph(item, project) {
  const { glyph, beam, pair } = item;
  if (beam) return projectBeamPoint(beam, glyph.x, glyph.y, project);
  const anchor = projectHeadStem(pair, project).head;
  return { ...anchor,
    x: anchor.x + (glyph.x - pair.glyph.x) * anchor.scale,
    y: anchor.y + (glyph.y - pair.glyph.y) * anchor.scale };
}

function beamEdge(beam, x) {
  const ys = [];
  for (const command of beam.drawing.commands) {
    const [a, b] = command.points;
    if (Math.abs(a[0] - b[0]) < .0001) continue;
    if (x >= Math.min(a[0], b[0]) - .0001 && x <= Math.max(a[0], b[0]) + .0001) {
      ys.push(lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
    }
  }
  return [Math.min(...ys), Math.max(...ys)];
}

export function enqueueEngraving(queue, context, engraving, study, project) {
  const ink = '#cfc2e2';
  for (const beam of engraving.beams) {
    const { minX, maxX } = beam.drawing;
    const xs = [...new Set([minX, maxX, ...beam.members.map(p => p.stem.end[0]),
      ...Array.from({ length: 25 }, (_, i) => lerp(minX, maxX, i / 24))])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const left = beamEdge(beam, xs[i]), right = beamEdge(beam, xs[i + 1]);
      const polygon = [[xs[i], left[0]], [xs[i + 1], right[0]],
        [xs[i + 1], right[1]], [xs[i], left[1]]].map(([x, y]) => projectBeamPoint(beam, x, y, project));
      queue.push({ depth: project((xs[i] + xs[i + 1]) / 2, -4).depth + 25, paint() {
        context.beginPath(); polygon.forEach((p, j) => j ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
        context.closePath(); context.fillStyle = ink; context.fill();
      } });
    }
  }
  for (const { command, width, beam } of engraving.brackets) {
    const points = command.points;
    // Source 31–33 contains straight bracket strokes, no ties or slurs.
    const [a, b] = points;
    const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .4));
    for (let i = 0; i < count; i++) {
      const at = t => projectBeamPoint(beam, lerp(a[0], b[0], t), lerp(a[1], b[1], t), project);
      const p = at(i / count), q = at((i + 1) / count);
      queue.push({ depth: project(lerp(a[0], b[0], (i + .5) / count), -4).depth + 25, paint() {
        context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y);
        context.strokeStyle = ink; context.lineWidth = Math.max(.5, width * p.scale); context.stroke();
      } });
    }
  }
  for (const item of engraving.glyphs) {
    const p = projectEngravingGlyph(item, project), g = item.glyph;
    queue.push({ depth: project(g.x, -4).depth + 25, paint() {
      context.save(); context.translate(p.x, p.y); context.scale(g.scaleX * p.scale, g.scaleY * p.scale);
      context.fillStyle = ink; context.fill(new Path2D(study.pdfGlyphPaths[g.glyph])); context.restore();
    } });
  }
  const rest = engraving.rest;
  const corners = [[-rest.width / 2, 0], [rest.width / 2, 0], [rest.width / 2, rest.height], [-rest.width / 2, rest.height]]
    .map(([x, y]) => project(rest.x + x, rest.y + y));
  queue.push({ depth: project(rest.x, -4).depth + 25, paint() {
    context.beginPath(); corners.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
    context.closePath(); context.fillStyle = ink; context.fill();
  } });
}
