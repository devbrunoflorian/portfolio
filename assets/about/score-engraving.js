import { noteHeadStemPairs } from './score-head-stems.js';
import { polygonBounds } from './score-occlusion.js';

const inRange = (x, range) => x >= range.x0 && x <= range.x1;

/** Preserve PDF beam groups; stem tips are the attachment anchors in perspective. */
export function buildEngraving(study, notes, view) {
  const pairs = noteHeadStemPairs(study, notes);
  const drawings = study.pdfDrawings.filter(d => d.maxX >= view.x0 && d.minX <= view.x1);
  const containedDrawings = drawings.filter(d => d.minX >= view.x0 && d.maxX <= view.x1);
  const beamDrawings = containedDrawings.filter(d => d.fill).map(drawing => {
    const members = pairs.filter(pair => pair.stem && pair.stem.end[0] >= drawing.minX - .3
      && pair.stem.end[0] <= drawing.maxX + .3).sort((a, b) => a.stem.end[0] - b.stem.end[0]);
    const vertices = drawing.commands.flatMap(c => c.points);
    return { drawing, members, vertices };
  }).filter(beam => beam.members.length >= 2 && beam.drawing.maxX - beam.drawing.minX > 1.5);
  const beamGroups = new Map();
  for (const candidate of beamDrawings) {
    const memberKey = candidate.members.map(pair => pair.note.id).join('|');
    const group = beamGroups.get(memberKey);
    if (group) group.drawings.push(candidate.drawing);
    else beamGroups.set(memberKey, { ...candidate, memberKey, drawings: [candidate.drawing] });
  }
  const beams = [...beamGroups.values()];
  const nearestBeam = (x, y) => beams.reduce((best, beam) => {
    const centerX=(beam.drawing.minX+beam.drawing.maxX)/2;
    const middle=beam.members.reduce((nearest,pair)=>Math.abs(pair.stem.end[0]-centerX)<Math.abs(nearest.stem.end[0]-centerX)?pair:nearest).stem.end;
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
  const glyphs = study.pdfGlyphs.filter(g => inRange(g.x, view) && !g.noteId && g.text !== '=' && g.text.trim())
    .map(glyph => {
      if (glyph.text === '3') return { glyph, beam: nearestBeam(glyph.x, glyph.y) };
      const pair = pairs.reduce((best, pair) => {
        const distance = Math.hypot(glyph.x - pair.glyph.x, glyph.y - pair.glyph.y);
        return !best || distance < best.distance ? { pair, distance } : best;
      }, null)?.pair;
      return { glyph, pair };
    });
  const bar = study.bars.find(b => b.number === 32);
  const staffWidths=study.pdfDrawings.filter(d=>d.maxX>=view.x0&&d.minX<=view.x1&&d.commands.length===1
    &&d.commands[0].kind==='l'&&Math.abs(d.commands[0].points[0][1]-d.commands[0].points[1][1])<.03
    &&study.staffLines.some(y=>Math.abs(d.commands[0].points[0][1]-y)<.04))
    .map(d=>d.width).sort((a,b)=>a-b);
  const staffWidth=staffWidths[Math.floor(staffWidths.length/2)];
  if(!staffWidth)throw new Error('Missing printed staff width');
  const barlines=[];
  const ledgerLines=[];
  for(const drawing of study.pdfDrawings)for(const command of drawing.commands){
    if(command.kind!=='l')continue;
    const [a,b]=command.points;
    if(Math.abs(a[1]-b[1])<.01&&a[1]>0&&Math.abs(a[0]-b[0])<5&&Math.min(a[0],b[0])>=view.x0&&Math.max(a[0],b[0])<=view.x1){
      const pair=pairs.reduce((best,pair)=>!best||Math.abs(pair.glyph.x-(a[0]+b[0])/2)<Math.abs(best.glyph.x-(a[0]+b[0])/2)?pair:best,null);
      const key=JSON.stringify(command.points);
      if(!ledgerLines.some(line=>line.key===key))ledgerLines.push({key,pair,x0:a[0],x1:b[0],y:Math.round(a[1]/2)*2,width:drawing.width});
    }
    if(Math.abs(a[0]-b[0])>.01||a[0]<view.x0-.01||a[0]>view.x1+.01)continue;
    if(Math.abs(Math.min(a[1],b[1])+8)>.03||Math.abs(Math.max(a[1],b[1]))>.03)continue;
    if(!barlines.some(line=>Math.abs(line.x-a[0])<.01))barlines.push({x:a[0],width:drawing.width});
  }
  return { pairs, beams, brackets: [...commands.values()], glyphs,staffWidth,barlines,ledgerLines,
    rest: { bar: 32, x: (bar.xStart + bar.xEnd) / 2, y: -6, width: 3.2, height: 1.1 } };
}

export function projectedRest(rest, project) {
  const anchor = project(rest.x, rest.y);
  const width = Math.max(12, rest.width * anchor.scale), height = Math.max(4, rest.height * anchor.scale);
  return { anchor, width, height, points: [
    { ...anchor, x: anchor.x - width / 2 }, { ...anchor, x: anchor.x + width / 2 },
    { ...anchor, x: anchor.x + width / 2, y: anchor.y + height },
    { ...anchor, x: anchor.x - width / 2, y: anchor.y + height },
  ] };
}

export function enqueueRest(queue, context, rest, project) {
  const { points, anchor } = projectedRest(rest, project);
  queue.push({ kind: 'rest', bounds: polygonBounds(points), range: [anchor.u - .012, anchor.u + .012], depth: anchor.depth + 1, paint() {
    context.beginPath(); points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
    context.closePath(); context.fillStyle = '#cfc2e2'; context.fill();
  } });
}
