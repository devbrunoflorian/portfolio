import { polygonBounds, quadTriangles } from './score-occlusion.js';

const mix = (a, b, t) => a + (b - a) * t;
const uv = (u, v) => ({ u, v });
const projectPoint = (point, project) => project(point.u, point.v);

/** Absolute PDF glyph outlines; tessellation stays in font coordinates before placement on the ribbon. */
export function glyphContours(path) {
  const tokens = path.match(/[MLHVCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi);
  const contours = [];
  let i = 0, command, current = [], point = [0, 0];
  const number = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[A-Z]$/i.test(tokens[i])) command = tokens[i++];
    if (command === 'Z') { contours.push(current); current = []; command = null; continue; }
    if (command === 'M') {
      if (current.length) contours.push(current);
      point = [number(), number()]; current = [point]; command = 'L';
    } else if (command === 'L' || command === 'H' || command === 'V') {
      point = command === 'L' ? [number(), number()] : command === 'H' ? [number(), point[1]] : [point[0], number()];
      current.push(point);
    } else if (command === 'C') {
      const a = point, b = [number(), number()], c = [number(), number()], d = [number(), number()];
      for (let step = 1; step <= 24; step++) {
        const t = step / 24, s = 1 - t;
        current.push([0, 1].map(axis => s ** 3 * a[axis] + 3 * s * s * t * b[axis] + 3 * s * t * t * c[axis] + t ** 3 * d[axis]));
      }
      point = d;
    } else throw new Error('Unsupported PDF glyph command ' + command);
  }
  if (current.length) contours.push(current);
  return contours;
}

function sampleLine(a, b, step = .25) {
  const count = Math.max(2, Math.ceil(Math.hypot(b.u - a.u, b.v - a.v) / step));
  return Array.from({ length: count + 1 }, (_, i) => uv(mix(a.u, b.u, i / count), mix(a.v, b.v, i / count)));
}

function sampleAlong(u0, u1, valueAt, anchors = []) {
  const count = Math.max(24, Math.ceil(Math.abs(u1 - u0) / .2));
  const us=[...new Set([...Array.from({length:count+1},(_,i)=>mix(u0,u1,i/count)),...anchors])].sort((a,b)=>a-b);
  return us.map(u=>uv(u,valueAt(u)));
}

function sourceEdge(beam, u, side) {
  const values = beam.drawing.commands.flatMap(command => {
    const [a, b] = command.points;
    if (Math.abs(b[0] - a[0]) < .0001 || u < Math.min(a[0], b[0]) - .0001 || u > Math.max(a[0], b[0]) + .0001) return [];
    return [mix(a[1], b[1], (u - a[0]) / (b[0] - a[0]))];
  });
  return side === 'upper' ? Math.min(...values) : Math.max(...values);
}

function snapOffset(beam, u) {
  const index = u <= beam.members[1].stem.end[0] ? 0 : 1;
  const a = beam.members[index], b = beam.members[index + 1];
  const t = (u - a.stem.end[0]) / (b.stem.end[0] - a.stem.end[0]);
  return mix(a.note.y - a.glyph.y, b.note.y - b.glyph.y, t);
}

function placedGlyph(glyph, anchor, study) {
  const contours = glyphContours(study.pdfGlyphPaths[glyph.glyph]);
  return { glyph, anchor, contours: contours.map(contour => contour.map(([x, y]) =>
    uv(anchor.u + x * glyph.scaleX, anchor.v + y * glyph.scaleY))) };
}

export function buildCompoundGroups(engraving, study) {
  const makeHead = pair => placedGlyph(pair.glyph, uv(pair.note.x, pair.note.y), study);
  const used = new Set();
  const groups = engraving.beams.map(beam => {
    const first = beam.members[0], bar = Number(first.note.id.split('-')[1]), onset = first.glyph.u;
    const group = { id: `guitar:${bar}:${onset}:voice-1`, bar, onset, voice: 1, beam, heads: [], stems: [], ledgerLines: [], accidents: [] };
    const edge = (u, side) => sourceEdge(beam, u, side) + snapOffset(beam, u);
    group.beamAt = edge;
    const contacts=beam.members.map(pair=>pair.stem.contact[0]);
    group.upper = sampleAlong(beam.drawing.minX, beam.drawing.maxX, u => edge(u, 'upper'),contacts);
    group.lower = sampleAlong(beam.drawing.minX, beam.drawing.maxX, u => edge(u, 'lower'),contacts);
    for (const pair of beam.members) {
      used.add(pair.note.id);
      group.heads.push({ ...makeHead(pair), noteId: pair.note.id });
      const contact = uv(pair.stem.contact[0], pair.note.y + pair.stem.contact[1] - pair.glyph.y);
      const u = contact.u;
      const rawEnd = pair.stem.end[1] + pair.note.y - pair.glyph.y;
      const side = Math.abs(rawEnd - edge(u, 'upper')) < Math.abs(rawEnd - edge(u, 'lower')) ? 'upper' : 'lower';
      const tip = uv(u, edge(u, side));
      group.stems.push({ noteId: pair.note.id, contact, tip, points: sampleLine(contact, tip), width: pair.stem.width });
    }
    const brackets = engraving.brackets.filter(item => item.beam === beam);
    const hooks = brackets.filter(item => Math.abs(item.command.points[0][0] - item.command.points[1][0]) < .001);
    const u0 = Math.min(...hooks.map(item => item.command.points[0][0]));
    const u1 = Math.max(...hooks.map(item => item.command.points[0][0]));
    const number = engraving.glyphs.find(item => item.beam === beam).glyph;
    const side = number.y < first.note.y ? 'upper' : 'lower';
    const direction = side === 'upper' ? -1 : 1;
    const offset = hooks.reduce((sum, item) => {
      const [a, b] = item.command.points;
      const outer = direction < 0 ? Math.min(a[1], b[1]) : Math.max(a[1], b[1]);
      return sum + outer - sourceEdge(beam, a[0], side);
    }, 0) / hooks.length;
    const hookLength = Math.abs(hooks[0].command.points[0][1] - hooks[0].command.points[1][1]);
    const horizontal = brackets.filter(item => Math.abs(item.command.points[0][0] - item.command.points[1][0]) > .001);
    const gapLeft = Math.max(...horizontal.filter(item => Math.min(...item.command.points.map(p => p[0])) < (u0 + u1) / 2).flatMap(item => item.command.points.map(p => p[0])));
    const gapRight = Math.min(...horizontal.filter(item => Math.max(...item.command.points.map(p => p[0])) > (u0 + u1) / 2).flatMap(item => item.command.points.map(p => p[0])));
    const centerU = (u0 + u1) / 2, gapFraction = (gapRight - gapLeft) / (u1 - u0);
    const at = u => edge(u, side) + offset;
    const leftEnd = centerU - (u1 - u0) * gapFraction / 2, rightStart = centerU + (u1 - u0) * gapFraction / 2;
    const left = sampleAlong(u0, leftEnd, at), right = sampleAlong(rightStart, u1, at);
    left.unshift(uv(u0, at(u0) - direction * hookLength));
    right.push(uv(u1, at(u1) - direction * hookLength));
    group.bracket = { u0, u1, centerU, side, offset, gapFraction, at, paths: [left, right], width: brackets[0].width };
    const numberContours = glyphContours(study.pdfGlyphPaths[number.glyph]).flat();
    const centerX = (Math.min(...numberContours.map(p => p[0])) + Math.max(...numberContours.map(p => p[0]))) / 2;
    const centerY = (Math.min(...numberContours.map(p => p[1])) + Math.max(...numberContours.map(p => p[1]))) / 2;
    const sourceNumberCenterV = number.y + centerY * number.scaleY;
    const normalOffset = sourceNumberCenterV - (sourceEdge(beam, centerU, side) + offset);
    group.number = { glyph: number, centerX, centerY, normalOffset,
      anchor: uv(centerU, at(centerU) + normalOffset) };
    return group;
  });
  for (const pair of engraving.pairs.filter(pair => !used.has(pair.note.id))) {
    const contact = uv(pair.stem.contact[0], pair.note.y + pair.stem.contact[1] - pair.glyph.y);
    const tip = uv(pair.stem.end[0], pair.note.y + pair.stem.end[1] - pair.glyph.y);
    const bar=Number(pair.note.id.split('-')[1]);
    groups.push({ id: `guitar:${bar}:${pair.glyph.u}:voice-1`, bar, onset: pair.glyph.u, voice: 1,
      heads: [{ ...makeHead(pair), noteId: pair.note.id }], stems: [{ contact, tip, points: sampleLine(contact, tip), width: pair.stem.width }], ledgerLines: [], accidents: [] });
  }
  for (const group of groups) {
    const ids = new Set(group.heads.map(head => head.noteId));
    for (const line of engraving.ledgerLines.filter(line => ids.has(line.pair.note.id))) group.ledgerLines.push({ width: line.width, points: sampleLine(uv(line.x0, line.y), uv(line.x1, line.y)) });
    for (const item of engraving.glyphs.filter(item => item.pair && ids.has(item.pair.note.id))) {
      group.accidents.push(placedGlyph(item.glyph, uv(item.glyph.x, item.glyph.y + item.pair.note.y - item.pair.glyph.y), study));
    }
    const all = [...group.heads.flatMap(head => head.contours.flat()), ...group.stems.flatMap(stem => stem.points),
      ...(group.upper ?? []), ...(group.lower ?? []), ...(group.bracket?.paths.flat() ?? []), ...group.accidents.flatMap(g => g.contours.flat())];
    if (group.number) all.push(group.number.anchor);
    group.u0 = Math.min(...all.map(p => p.u)); group.u1 = Math.max(...all.map(p => p.u));
    group.v0 = Math.min(...all.map(p => p.v)) - 1; group.v1 = Math.max(...all.map(p => p.v)) + 1;
    group.center = uv((group.u0 + group.u1) / 2, (group.v0 + group.v1) / 2);
    group.anchors = all;
  }
  return groups;
}

export function projectCompoundGroup(group, project) {
  // u measures arc progress, v measures staff spacing. Convert glyph widths in the
  // ribbon's intrinsic metric before projection; camera pixels never enter this conversion.
  const aspect=project.uvAspect??1;
  const contacts=group.stems.map((stem,i)=>({from:stem.contact.u,to:group.heads[i].anchor.u+(stem.contact.u-group.heads[i].anchor.u)*aspect}));
  const remapU=u=>{
    const index=contacts.length===1?0:u<=contacts[1].from?0:contacts.length-2;
    const a=contacts[index],b=contacts[Math.min(index+1,contacts.length-1)];
    return a===b?u+a.to-a.from:mix(a.to,b.to,(u-a.from)/(b.from-a.from));
  };
  const mapped=point=>uv(remapU(point.u),point.v);
  const contour = points => points.map(point => projectPoint(mapped(point), project));
  const glyphContour=(glyph,points)=>points.map(point=>projectPoint(uv(glyph.anchor.u+(point.u-glyph.anchor.u)*aspect,point.v),project));
  const upper = group.upper ? contour(group.upper) : [], lower = group.lower ? contour(group.lower) : [];
  const maskTop = contour(sampleAlong(group.u0, group.u1, () => group.v0));
  const maskBottom = contour(sampleAlong(group.u0, group.u1, () => group.v1));
  return { group, center: projectPoint(mapped(group.center), project),
    beam: [...upper, ...lower.toReversed()],
    stems: group.stems.map(stem => ({ ...stem, points: contour(stem.points) })),
    brackets: group.bracket?.paths.map(contour) ?? [], number: group.number ? projectPoint(mapped(group.number.anchor), project) : null,
    heads: group.heads.map(head => ({ ...head, contours: head.contours.map(points=>glyphContour(head,points)) })),
    accidents: group.accidents.map(item => item.contours.map(points=>glyphContour(item,points))),
    ledgers: group.ledgerLines.map(line => ({ ...line, points: contour(line.points) })),
    depthTriangles: maskTop.slice(1).flatMap((p, i) => quadTriangles([maskTop[i], p, maskBottom[i + 1], maskBottom[i]])) };
}

export function enqueueCompoundGroups(queue, context, groups, study, project, details = true) {
  const ink = '#cfc2e2', marker = 'guitar-33-4-1';
  const path = (points, close) => {
    points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
    if (close) context.closePath();
  };
  const fill = contours => { context.beginPath(); contours.forEach(points => path(points, true)); context.fill(); };
  const stroke = (points, width) => { context.beginPath(); path(points, false); context.lineWidth = width; context.stroke(); };
  for (const group of groups) {
    const shape = projectCompoundGroup(group, project);
    const all = [...shape.beam, ...shape.stems.flatMap(s => s.points), ...shape.brackets.flat(), ...shape.heads.flatMap(h => h.contours.flat()), ...shape.accidents.flat(2), ...shape.ledgers.flatMap(l => l.points)];
    if (shape.number) all.push(shape.number);
    queue.push({ kind: 'notation-group', id: group.id, range: [Math.min(...all.map(p=>p.u))-.003, Math.max(...all.map(p=>p.u))+.003],
      depth: shape.center.depth, depthTriangles: shape.depthTriangles, bounds: polygonBounds(all, Math.max(4, shape.center.scale * 5)), paint() {
        context.fillStyle = context.strokeStyle = ink;
        if (shape.beam.length) fill([shape.beam]);
        for (const stem of shape.stems) stroke(stem.points, stem.width * stem.points[0].scale);
        if (details) {
          for (const points of shape.brackets) stroke(points, group.bracket.width * points[0].scale);
          if (shape.number) {
            const number = group.number, anchor = shape.number;
            context.save(); context.translate(anchor.x, anchor.y);
            context.scale(number.glyph.scaleX * anchor.scale, number.glyph.scaleY * anchor.scale);
            context.translate(-number.centerX, -number.centerY);
            context.fill(new Path2D(study.pdfGlyphPaths[number.glyph.glyph])); context.restore();
          }
          shape.accidents.forEach(fill);
        }
        for (const line of shape.ledgers) stroke(line.points, line.width * line.points[0].scale);
        for (const head of shape.heads) {
          context.fillStyle = head.noteId === marker ? '#ffdc83' : '#cfc2e2';
          fill(head.contours);
        }
      } });
  }
}
