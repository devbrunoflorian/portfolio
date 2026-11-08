import { polygonBounds, quadTriangles } from './score-occlusion.js';

const mix = (a, b, t) => a + (b - a) * t;
const uv = (u, v) => ({ u, v });
const projectPoint = (point, project) => project(point.u, point.v);
const glyphPathCache=new WeakMap();
function reusableGlyph(study,glyph){
  let paths=glyphPathCache.get(study);
  if(!paths){paths=new Map();glyphPathCache.set(study,paths);}
  if(!paths.has(glyph))paths.set(glyph,new Path2D(study.pdfGlyphPaths[glyph]));
  return paths.get(glyph);
}

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

function interpolateAtU(anchors, u, read) {
  if (anchors.length < 2) return read(anchors[0]);
  let index = 0;
  if (u >= anchors.at(-1).u) index = anchors.length - 2;
  else while (index < anchors.length - 2 && u > anchors[index + 1].u) index += 1;
  const a = anchors[index], b = anchors[index + 1];
  const span = b.u - a.u;
  if (Math.abs(span) < 1e-7) return read(Math.abs(u - a.u) <= Math.abs(u - b.u) ? a : b);
  return mix(read(a), read(b), (u - a.u) / span);
}

function sourceEdge(drawing, u, side) {
  const values = drawing.commands.flatMap(command => {
    const [a, b] = command.points;
    if (Math.abs(b[0] - a[0]) < .0001 || u < Math.min(a[0], b[0]) - .0001 || u > Math.max(a[0], b[0]) + .0001) return [];
    return [mix(a[1], b[1], (u - a[0]) / (b[0] - a[0]))];
  });
  return side === 'upper' ? Math.min(...values) : Math.max(...values);
}

function createSnapOffset(beam) {
  const anchors = beam.members.map(pair => ({
    u: pair.stem.end[0],
    offset: pair.note.y - pair.glyph.y,
  })).sort((a, b) => a.u - b.u);
  return u => interpolateAtU(anchors, u, anchor => anchor.offset);
}

function placedGlyph(glyph, anchor, study) {
  const contours = glyphContours(study.pdfGlyphPaths[glyph.glyph]);
  return { glyph, anchor, contours: contours.map(contour => contour.map(([x, y]) =>
    uv(anchor.u + x * glyph.scaleX, anchor.v + y * glyph.scaleY))) };
}

function tupletDistance(item, glyph) {
  const xs = item.command.points.map(point => point[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return glyph.x < x0 ? x0 - glyph.x : glyph.x > x1 ? glyph.x - x1 : 0;
}

function makeTuplet(numberItem, bracketItems, allNumbers, beam, bands, offsetAt, study) {
  const number = numberItem.glyph;
  const contours = glyphContours(study.pdfGlyphPaths[number.glyph]).flat();
  const centerX = (Math.min(...contours.map(point => point[0])) + Math.max(...contours.map(point => point[0]))) / 2;
  const centerY = (Math.min(...contours.map(point => point[1])) + Math.max(...contours.map(point => point[1]))) / 2;
  const centerU = number.x + centerX * number.scaleX;
  const sourceCenterV = number.y + centerY * number.scaleY;
  const nearest = beam.members.reduce((best, pair) => {
    const distance = Math.abs(pair.note.x - centerU);
    return !best || distance < best.distance ? { pair, distance } : best;
  }, null).pair;
  const side = sourceCenterV < nearest.note.y ? 'upper' : 'lower';
  const band = bands.reduce((best, candidate) => {
    const value = candidate.edge(centerU, side);
    const distance = Number.isFinite(value) ? Math.abs(sourceCenterV - value) : Infinity;
    return !best || distance < best.distance ? { candidate, distance } : best;
  }, null)?.candidate ?? bands[0];
  const relevantBrackets = allNumbers.length <= 1 ? bracketItems : bracketItems.filter(item =>
    allNumbers.reduce((best, candidate) => !best || tupletDistance(item, candidate.glyph) < tupletDistance(item, best.glyph) ? candidate : best, null) === numberItem);
  const hooks = relevantBrackets.filter(item => Math.abs(item.command.points[0][0] - item.command.points[1][0]) < .001);
  let bracket = null;
  if (hooks.length >= 2) {
    const u0 = Math.min(...hooks.map(item => item.command.points[0][0]));
    const u1 = Math.max(...hooks.map(item => item.command.points[0][0]));
    const direction = side === 'upper' ? -1 : 1;
    const offset = hooks.reduce((sum, item) => {
      const [a, b] = item.command.points;
      const outer = direction < 0 ? Math.min(a[1], b[1]) : Math.max(a[1], b[1]);
      return sum + outer - band.edge(a[0], side);
    }, 0) / hooks.length;
    const hookLength = Math.abs(hooks[0].command.points[0][1] - hooks[0].command.points[1][1]);
    const horizontal = relevantBrackets.filter(item => Math.abs(item.command.points[0][0] - item.command.points[1][0]) > .001);
    const centerBracketU = (u0 + u1) / 2;
    const leftEdges = horizontal.filter(item => Math.min(...item.command.points.map(point => point[0])) < centerBracketU)
      .flatMap(item => item.command.points.map(point => point[0]));
    const rightEdges = horizontal.filter(item => Math.max(...item.command.points.map(point => point[0])) > centerBracketU)
      .flatMap(item => item.command.points.map(point => point[0]));
    const glyphHalfWidth = (Math.max(...contours.map(point => point[0])) - Math.min(...contours.map(point => point[0]))) * Math.abs(number.scaleX) / 2;
    const gapPadding = Math.max(.12, (u1 - u0) * .012);
    let gapLeft = leftEdges.length ? Math.max(...leftEdges) : centerU - glyphHalfWidth - gapPadding;
    let gapRight = rightEdges.length ? Math.min(...rightEdges) : centerU + glyphHalfWidth + gapPadding;
    if (!Number.isFinite(gapLeft) || !Number.isFinite(gapRight) || gapLeft >= gapRight) {
      gapLeft = centerBracketU - glyphHalfWidth - gapPadding;
      gapRight = centerBracketU + glyphHalfWidth + gapPadding;
    }
    gapLeft = Math.max(u0, gapLeft);
    gapRight = Math.min(u1, gapRight);
    const gapFraction = (gapRight - gapLeft) / (u1 - u0);
    const at = u => band.edge(u, side) + offset;
    const leftEnd = centerBracketU - (u1 - u0) * gapFraction / 2;
    const rightStart = centerBracketU + (u1 - u0) * gapFraction / 2;
    const left = sampleAlong(u0, leftEnd, at), right = sampleAlong(rightStart, u1, at);
    left.unshift(uv(u0, at(u0) - direction * hookLength));
    right.push(uv(u1, at(u1) - direction * hookLength));
    bracket = { u0, u1, centerU: centerBracketU, side, offset, gapFraction, at, paths: [left, right], width: relevantBrackets[0].width };
  }
  const anchorU = bracket?.centerU ?? centerU;
  const base = band.edge(anchorU, side);
  const numberBase = bracket?.at(anchorU) ?? base;
  const normalOffset = sourceCenterV - numberBase;
  return { glyph: number, centerX, centerY, normalOffset, anchor: uv(anchorU, numberBase + normalOffset), bracket };
}

export function buildCompoundGroups(engraving, study) {
  const makeHead = pair => placedGlyph(pair.glyph, uv(pair.note.x, pair.note.y), study);
  const used = new Set();
  const groups = engraving.beams.map(beam => {
    const first = beam.members[0], bar = Number(first.note.id.split('-')[1]), onset = first.glyph.u;
    const group = { id: `guitar:${bar}:${onset}:voice-1`, bar, onset, voice: 1, beam, heads: [], stems: [], ledgerLines: [], accidents: [], tuplets: [] };
    const offsetAt = createSnapOffset(beam);
    const drawings = beam.drawings ?? [beam.drawing];
    const contacts=beam.members.map(pair=>pair.stem.contact[0]);
    const bands = drawings.map(drawing => {
      const edge = (u, side) => sourceEdge(drawing, u, side) + offsetAt(u);
      return { drawing, edge,
        upper: sampleAlong(drawing.minX, drawing.maxX, u => edge(u, 'upper'), contacts),
        lower: sampleAlong(drawing.minX, drawing.maxX, u => edge(u, 'lower'), contacts) };
    });
    group.beamBands = bands;
    group.upper = bands[0].upper;
    group.lower = bands[0].lower;
    group.beamAt = bands[0].edge;
    for (const pair of beam.members) {
      used.add(pair.note.id);
      group.heads.push({ ...makeHead(pair), noteId: pair.note.id });
      const contact = uv(pair.stem.contact[0], pair.note.y + pair.stem.contact[1] - pair.glyph.y);
      const u = contact.u;
      const rawEnd = pair.stem.end[1] + pair.note.y - pair.glyph.y;
      const boundary = bands.flatMap(band => ['upper', 'lower'].map(side => ({ side, v: band.edge(u, side) })))
        .filter(candidate => Number.isFinite(candidate.v))
        .reduce((best, candidate) => !best || Math.abs(rawEnd - candidate.v) < Math.abs(rawEnd - best.v) ? candidate : best, null);
      const tip = uv(u, boundary?.v ?? bands[0].edge(u, 'upper'));
      group.stems.push({ noteId: pair.note.id, contact, tip, points: sampleLine(contact, tip), width: pair.stem.width });
    }
    const brackets = engraving.brackets.filter(item => item.beam === beam);
    const numberItems = engraving.glyphs.filter(item => item.beam === beam && item.glyph.text === '3');
    group.tuplets = numberItems.map(item => makeTuplet(item, brackets, numberItems, beam, bands, offsetAt, study));
    group.number = group.tuplets[0] ?? null;
    group.bracket = group.tuplets.find(item => item.bracket)?.bracket ?? null;
    return group;
  });
  for (const pair of engraving.pairs.filter(pair => !used.has(pair.note.id))) {
    if(!pair.stem){
      const bar=Number(pair.note.id.split('-')[1]);
      groups.push({id:`guitar:${bar}:${pair.glyph.u}:voice-1`,bar,onset:pair.glyph.u,voice:1,
        heads:[{...makeHead(pair),noteId:pair.note.id}],stems:[],ledgerLines:[],accidents:[]});
      continue;
    }
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
      ...(group.beamBands ?? []).flatMap(band => [...band.upper, ...band.lower]),
      ...(group.tuplets ?? []).flatMap(tuplet => [...(tuplet.bracket?.paths.flat() ?? []), tuplet.anchor]),
      ...group.accidents.flatMap(g => g.contours.flat())];
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
  const contacts=group.stems.map((stem,i)=>({u:stem.contact.u,to:group.heads[i].anchor.u+(stem.contact.u-group.heads[i].anchor.u)*aspect}))
    .sort((a,b)=>a.u-b.u)
    .filter((item,index,all)=>index===0||Math.abs(item.u-all[index-1].u)>1e-5);
  const remapU=u=>{
    if(contacts.length===0)return u;
    if(contacts.length===1)return u+contacts[0].to-contacts[0].u;
    return interpolateAtU(contacts,u,item=>item.to);
  };
  const mapped=point=>uv(remapU(point.u),point.v);
  const contour = points => points.map(point => projectPoint(mapped(point), project));
  const glyphContour=(glyph,points)=>points.map(point=>projectPoint(uv(glyph.anchor.u+(point.u-glyph.anchor.u)*aspect,point.v),project));
  const beamBands = group.beamBands?.map(band => {
    const upper = contour(band.upper), lower = contour(band.lower);
    return [...upper, ...lower.toReversed()];
  }) ?? (group.upper ? [[...contour(group.upper), ...contour(group.lower).toReversed()]] : []);
  const maskTop = contour(sampleAlong(group.u0, group.u1, () => group.v0));
  const maskBottom = contour(sampleAlong(group.u0, group.u1, () => group.v1));
  const tuplets = (group.tuplets ?? (group.number ? [group.number] : [])).map(tuplet => ({
    number: projectPoint(mapped(tuplet.anchor), project),
    brackets: tuplet.bracket?.paths.map(contour) ?? [],
    bracketWidth: tuplet.bracket?.width ?? 0,
  }));
  const beams = beamBands.flat();
  const brackets = tuplets.flatMap(tuplet => tuplet.brackets);
  return { group, center: projectPoint(mapped(group.center), project),
    beam: beams, beams: beamBands,
    stems: group.stems.map(stem => ({ ...stem, points: contour(stem.points) })),
    brackets, tuplets, number: tuplets[0]?.number ?? null,
    heads: group.heads.map(head => ({ ...head, contours: head.contours.map(points=>glyphContour(head,points)) })),
    accidents: group.accidents.map(item => item.contours.map(points=>glyphContour(item,points))),
    ledgers: group.ledgerLines.map(line => ({ ...line, points: contour(line.points) })),
    depthTriangles: maskTop.slice(1).flatMap((p, i) => quadTriangles([maskTop[i], p, maskBottom[i + 1], maskBottom[i]])) };
}

export function enqueueCompoundGroups(queue, context, groups, study, project, details = true, profile = null, cachedGlyphs = false) {
  const ink = '#cfc2e2', marker = 'guitar-33-4-1';
  const timed=(name,operation)=>profile?profile.measure(name,operation):operation();
  const path = (points, close) => {
    points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
    if (close) context.closePath();
  };
  const fill = contours => { timed('pathAssembly',()=>{context.beginPath(); contours.forEach(points => path(points, true));}); context.fill(); };
  const stroke = (points, width) => { timed('pathAssembly',()=>{context.beginPath(); path(points, false);}); context.lineWidth = width; context.stroke(); };
  for (const group of groups) {
    const shape = projectCompoundGroup(group, project);
    const all = [...shape.beam, ...shape.stems.flatMap(s => s.points), ...shape.brackets.flat(), ...shape.heads.flatMap(h => h.contours.flat()), ...shape.accidents.flat(2), ...shape.ledgers.flatMap(l => l.points)];
    if (shape.number) all.push(shape.number);
    const bounds=polygonBounds(all, Math.max(4, shape.center.scale * 5));
    if(cachedGlyphs&&(bounds.x1<0||bounds.y1<0||bounds.x0>context.canvas.width/2||bounds.y0>context.canvas.height/2))continue;
    queue.push({ kind: 'notation-group', id: group.id, range: [Math.min(...all.map(p=>p.u))-.003, Math.max(...all.map(p=>p.u))+.003],
      protectedHeads:shape.heads.map(head=>({bounds:polygonBounds(head.contours.flat(),1),depth:project(head.anchor.u,head.anchor.v).depth,marker:head.noteId===marker})),
      depth: shape.center.depth, depthTriangles: shape.depthTriangles, bounds, paint() {
        context.fillStyle = context.strokeStyle = ink;
        if (shape.beams.length) fill(shape.beams);
        for (const stem of shape.stems) stroke(stem.points, stem.width * stem.points[0].scale);
        if (details) {
          for (const [index, tuplet] of shape.tuplets.entries()) {
            const end=profile?.start('glyphs');
            const number = group.tuplets?.[index] ?? group.number, anchor = tuplet.number;
            for (const points of tuplet.brackets) stroke(points, tuplet.bracketWidth * points[0].scale);
            context.save(); context.translate(anchor.x, anchor.y);
            context.scale(number.glyph.scaleX * anchor.scale, number.glyph.scaleY * anchor.scale);
            context.translate(-number.centerX, -number.centerY);
            context.fill(cachedGlyphs?reusableGlyph(study,number.glyph.glyph):new Path2D(study.pdfGlyphPaths[number.glyph.glyph])); context.restore();
            end?.();
          }
          timed('glyphs',()=>shape.accidents.forEach(fill));
        }
        for (const line of shape.ledgers) stroke(line.points, line.width * line.points[0].scale);
        for (const head of shape.heads) {
          context.fillStyle = head.noteId === marker ? '#ffdc83' : '#cfc2e2';
          timed('glyphs',()=>fill(head.contours));
        }
      } });
  }
}
