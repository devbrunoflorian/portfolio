import * as THREE from './vendor/three-score.min.js';
import { glyphContours } from './score-compound-groups.js';
import { HALO_HALF_WIDTH } from './score-depth-cues.js';
import { SCORE_MATERIAL } from './score-gpu-materials.js';

const DEFAULT_MARKER = 'guitar-33-4-1';

function barAt(view, bars) {
  return bars.find(bar => Math.abs(bar.xStart - view.x0) < .02)
    ?? bars.find(bar => view.x0 >= bar.xStart - .02 && view.x0 < bar.xEnd)
    ?? bars.find(bar => bar.xStart >= view.x0 - .02);
}

export function clefHeaderAnchor(view, bars, glyph = null) {
  if (!view || !Number.isFinite(view.x0) || !Number.isFinite(view.x1) || view.x1 <= view.x0
    || !Array.isArray(bars) || !bars.length) {
    throw new RangeError('Clef header anchor requires a valid score view and bars.');
  }
  const targetBar = barAt(view, bars);
  const sourceBar = bars.find(bar => bar.number === 1) ?? bars[0];
  const sourceOffset = Number.isFinite(glyph?.x) ? glyph.x - sourceBar.xStart : 0;
  return (targetBar?.xStart ?? view.x0) + sourceOffset;
}

export function scoreSourceRange(view, bars, staffLines, includeClef = true, clefGlyph = null) {
  if (!Array.isArray(staffLines) || staffLines.length !== 5 || !staffLines.every(Number.isFinite)) {
    throw new RangeError('Source range requires five finite staff lines.');
  }
  return {
    x0: includeClef ? Math.min(view.x0, clefHeaderAnchor(view, bars, clefGlyph)) : view.x0,
    x1: view.x1,
  };
}

/** The source score already carries this outline and its original PDF placement scale. */
export function trebleClefFromTimeline(score) {
  const glyph = score.pdfGlyphs.find(item => item.glyph === 'font_3_4');
  const path = score.pdfGlyphPaths?.[glyph?.glyph];
  if (!glyph || !path || !Number.isFinite(glyph.scaleX) || !Number.isFinite(glyph.scaleY)) {
    throw new Error('The score timeline does not contain the PDF treble clef outline (font_3_4).');
  }
  return { glyph, contours: glyphContours(path) };
}

function contains(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function fill(contours, emit) {
  const rings = contours.filter(c => c.length >= 3).map(c => {
    const ring = c.slice();
    if (ring[0].x === ring.at(-1).x && ring[0].y === ring.at(-1).y) ring.pop();
    return ring;
  });
  const levels = rings.map((r, i) => rings.filter((s, j) => i !== j && contains(s, r[0])).length);
  rings.forEach((outer, i) => {
    if (levels[i] % 2) return;
    const holes = rings.filter((r, j) => levels[j] === levels[i] + 1 && contains(outer, r[0]));
    const flat = [outer, ...holes].flat();
    for (const face of THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p.x, p.y)),
      holes.map(r => r.map(p => new THREE.Vector2(p.x, p.y))))) emit(...face.map(n => flat[n]));
  });
}

/** Immutable source UVs, glyph offsets and attachment parameters; never rebuilt per pose. */
export function buildRibbonGeometry(score, view, groups, engraving, voicePaths = [], markerId = DEFAULT_MARKER, trebleClefContours = []) {
  if (!Array.isArray(score.staffLines) || score.staffLines.length !== 5) {
    throw new RangeError('The ribbon requires five staff lines.');
  }
  const lineGap = Math.abs(score.staffLines[1] - score.staffLines[0]);
  if (!Number.isFinite(lineGap) || lineGap <= 0) throw new RangeError('Staff lines must have positive spacing.');
  const attributes = { position: [], sourceUV: [], remap: [], glyphOffset: [], spriteUV: [], segmentEnd: [],
    segmentRemap: [], segmentBeat: [], stroke: [], feature: [], beat: [], noteDuration: [],
    protection: [], role: [] };
  const point = (u, v, extra = {}) => ({ x: u, y: v, u, v, ...extra });
  function emit(a, b, c) {
    for (const p of [a, b, c]) {
      attributes.position.push(0, 0, p.t ?? 0);
      attributes.sourceUV.push(p.u, p.v);
      attributes.remap.push(p.remap ?? 0);
      attributes.glyphOffset.push(...(p.offset ?? [0, 0]));
      attributes.spriteUV.push(...(p.spriteUV ?? [.5, .5]));
      attributes.segmentEnd.push(...(p.end ?? [p.u, p.v]));
      attributes.segmentRemap.push(p.endRemap ?? 0);
      attributes.segmentBeat.push(p.endBeat ?? p.beat ?? -1);
      attributes.stroke.push(p.side ?? 0, p.width ?? 0);
      attributes.feature.push(p.kind ?? 0, p.materialType ?? SCORE_MATERIAL.STAFF);
      attributes.beat.push(p.beat ?? -1);
      attributes.noteDuration.push(p.duration ?? 0);
      attributes.protection.push(p.gold ?? 0, p.head ?? 0);
      attributes.role.push(p.arrivalBar ?? 0, p.voice ?? 0);
    }
  }
  function stroke(path, width, extra = {}) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const p = { ...a, ...extra, kind: 2, end: [b.u, b.v], endRemap: b.remap ?? 0,
        endBeat: b.beat ?? a.beat ?? -1, width };
      const q = { ...p, t: 1 };
      emit({ ...p, side: -1 }, { ...p, side: 1 }, { ...q, side: 1 });
      emit({ ...p, side: -1 }, { ...q, side: 1 }, { ...q, side: -1 });
    }
  }
  function strip(top, bottom, extra = {}) {
    for (let i = 1; i < top.length; i++) {
      const a = { ...top[i - 1], ...extra }, b = { ...top[i], ...extra };
      const c = { ...bottom[i], ...extra }, d = { ...bottom[i - 1], ...extra };
      if (extra.materialType === SCORE_MATERIAL.BEAM || extra.materialType === SCORE_MATERIAL.BEAM_WASH) {
        const start = top[0].u, span = top.at(-1).u - start || 1;
        for (const [p, across] of [[a, 0], [b, 0], [c, 1], [d, 1]]) {
          p.spriteUV = [(p.u - start) / span, across];
        }
      }
      emit(a, b, c); emit(a, c, d);
    }
  }
  function noteDot(note, track) {
    const center = point(note.x, note.y, { kind: 1, voice: track, beat: note.beat,
      duration: note.duration, materialType: SCORE_MATERIAL.VOICE });
    const segments = 16, radiusX = .4, radiusY = .32;
    for (let index = 0; index < segments; index += 1) {
      const angleA = index / segments * Math.PI * 2;
      const angleB = (index + 1) / segments * Math.PI * 2;
      const a = point(note.x, note.y, { kind: 1, voice: track, beat: note.beat,
        duration: note.duration, materialType: SCORE_MATERIAL.VOICE,
        offset: [Math.cos(angleA) * radiusX, Math.sin(angleA) * radiusY] });
      const b = point(note.x, note.y, { kind: 1, voice: track, beat: note.beat,
        duration: note.duration, materialType: SCORE_MATERIAL.VOICE,
        offset: [Math.cos(angleB) * radiusX, Math.sin(angleB) * radiusY] });
      emit(center, a, b);
    }
  }
  function circuitContact(anchor, width, height, withTrace) {
    const rx=width*.78, ry=height*.78;
    const center=point(anchor.u,anchor.v,{kind:1,materialType:SCORE_MATERIAL.CODE_CONTACT,spriteUV:[.5,.5]});
    const corners=[[-1,0],[-.5,-1],[.5,-1],[1,0],[.5,1],[-.5,1]];
    const face=([x,y])=>({...center,offset:[x*rx,y*ry],spriteUV:[(x+1)/2,(y+1)/2]});
    for(let i=0;i<corners.length;i++)emit(center,face(corners[i]),face(corners[(i+1)%corners.length]));
    if(!withTrace)return;
    const offsets=[[0,0],[2,0],[4,-2],[4,-6],[8,-6]];
    const path=offsets.map(([du,dv])=>point(anchor.u,anchor.v+dv,{remap:du}));
    stroke(path,.10,{materialType:SCORE_MATERIAL.CODE_TRACE});
    const end=path.at(-1), terminal={...end,kind:1,materialType:SCORE_MATERIAL.CODE_TERMINAL};
    const q=[[-.35,-.35],[.35,-.35],[.35,.35],[-.35,.35]].map(([x,y])=>({...terminal,offset:[x,y],spriteUV:[x/.7+.5,y/.7+.5]}));
    emit(q[0],q[1],q[2]);emit(q[0],q[2],q[3]);
  }
  function pigmentDabs(anchor, seed, radius) {
    let hash = 0;
    for (const character of String(seed ?? '')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    const count = 4;
    for (let dab = 0; dab < count; dab += 1) {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const angle = dab / count * Math.PI * 2 + (hash / 0xffffffff - .5) * .38;
      const distance = radius * (.78 + (hash % 100) / 360);
      const centerOffset = [Math.cos(angle) * distance, Math.sin(angle) * distance];
      const dabRadius = radius * (.12 + ((hash >>> 8) % 100) / 900);
      const center = point(anchor.u, anchor.v, { kind: 1, materialType: SCORE_MATERIAL.SPATTER, offset: centerOffset });
      for (let side = 0; side < 7; side += 1) {
        const angleA = side / 7 * Math.PI * 2;
        const angleB = (side + 1) / 7 * Math.PI * 2;
        const a = point(anchor.u, anchor.v, { kind: 1, materialType: SCORE_MATERIAL.SPATTER,
          offset: [centerOffset[0] + Math.cos(angleA) * dabRadius, centerOffset[1] + Math.sin(angleA) * dabRadius] });
        const b = point(anchor.u, anchor.v, { kind: 1, materialType: SCORE_MATERIAL.SPATTER,
          offset: [centerOffset[0] + Math.cos(angleB) * dabRadius, centerOffset[1] + Math.sin(angleB) * dabRadius] });
        emit(center, a, b);
      }
    }
  }
  const clefSource = trebleClefContours?.glyph ? trebleClefContours : trebleClefFromTimeline(score);
  const clefGlyph = clefSource.glyph;
  const clefAnchorU = clefHeaderAnchor(view, score.bars, clefGlyph);
  const staffU = Array.from({ length: 561 }, (_, i) => view.x0 + (view.x1 - view.x0) * i / 560);
  if (clefAnchorU >= view.x0 && clefAnchorU <= view.x1) staffU.push(clefAnchorU);
  staffU.sort((a, b) => a - b);
  const along = v => staffU.map(u => point(u, v));
  // A contiguous ribbon is triangulated as strips, avoiding concave-outline diagonals.
  strip(along(-4 - HALO_HALF_WIDTH), along(-4 + HALO_HALF_WIDTH), { kind: 4, materialType: SCORE_MATERIAL.STAFF });
  // Match Canvas' screen-space stroke instead of offsetting in staff-space.
  for (const y of score.staffLines) stroke(along(y), engraving.staffWidth, { materialType: SCORE_MATERIAL.STAFF });
  for (const bar of engraving.barlines) stroke(Array.from({ length: 33 }, (_, i) => point(bar.x, -8 + i / 4)),
    engraving.staffWidth, { arrivalBar: bar.x <= view.x0 + .01 ? 1 : 0, materialType: SCORE_MATERIAL.STAFF });

  if (clefSource.contours.length) {
    const anchorU = clefAnchorU;
    // Pin the clef reference to the G line while preserving the original PDF
    // glyph origin inside each local vertex offset.
    const anchorV = score.staffLines.at(-2);
    const flat = clefSource.contours.flat();
    const bounds = { x0: Math.min(...flat.map(([x]) => x)), x1: Math.max(...flat.map(([x]) => x)),
      y0: Math.min(...flat.map(([, y]) => y)), y1: Math.max(...flat.map(([, y]) => y)) };
    const contours = clefSource.contours.map(contour => contour.map(([x, y]) => {
      const offset = [x * clefGlyph.scaleX, clefGlyph.y - anchorV + y * clefGlyph.scaleY];
      const spriteUV = [(x - bounds.x0) / (bounds.x1 - bounds.x0), (y - bounds.y0) / (bounds.y1 - bounds.y0)];
      return point(anchorU, anchorV, { x: offset[0], y: offset[1], kind: 5, materialType: SCORE_MATERIAL.CLEF, offset, spriteUV });
    }));
    fill(contours, emit);
  }

  for (const group of groups) {
    const contacts = group.stems.map((s, i) => ({ from: s.contact.u, base: group.heads[i].anchor.u,
      offset: s.contact.u - group.heads[i].anchor.u })).sort((a, b) => a.from - b.from)
      .filter((item, index, all) => index === 0 || Math.abs(item.from - all[index - 1].from) > 1e-5);
    const mapped = p => {
      if(!contacts.length)return point(p.u,p.v,{remap:0});
      if(contacts.length===1){const a=contacts[0];return point(p.u+a.base-a.from,p.v,{remap:a.offset});}
      let i=0;
      if(p.u>=contacts.at(-1).from)i=contacts.length-2;
      else while(i<contacts.length-2&&p.u>contacts[i+1].from)i++;
      const a=contacts[i],b=contacts[i+1],span=b.from-a.from;
      const t=Math.abs(span)<1e-7?0:(p.u-a.from)/span;
      return point(a.base+(b.base-a.base)*t,p.v,{remap:a.offset+(b.offset-a.offset)*t});
    };
    const paintedBeam = (upper, lower) => {
      const expand = (edge, opposite) => edge.map((p, i) => ({ ...p,
        v: (p.v + opposite[i].v) / 2 + (p.v - opposite[i].v) * .9 }));
      strip(expand(upper, lower).map(mapped), expand(lower, upper).map(mapped),
        { materialType: SCORE_MATERIAL.BEAM_WASH });
      strip(upper.map(mapped), lower.map(mapped), { materialType: SCORE_MATERIAL.BEAM });
    };
    if (group.beamBands) {
      for (const band of group.beamBands) paintedBeam(band.upper, band.lower);
    } else if (group.upper) paintedBeam(group.upper, group.lower);
    for (let i = 0; i < group.stems.length; i++) {
      const s = group.stems[i], h = group.heads[i], tip = mapped(s.tip);
      // Head contact and beam tip are projected independently; the connecting stem
      // interpolates those exact screen anchors instead of shearing an upright glyph.
      const p = point(h.anchor.u, h.anchor.v, { kind: 3, end: [tip.u, tip.v], endRemap: tip.remap,
        offset: [s.contact.u - h.anchor.u, s.contact.v - h.anchor.v], width: s.width,
        materialType: SCORE_MATERIAL.STEM });
      emit({ ...p, side: -1 }, { ...p, side: 1 }, { ...p, side: 1, t: 1 });
      emit({ ...p, side: -1 }, { ...p, side: 1, t: 1 }, { ...p, side: -1, t: 1 });
    }
    for (const l of group.ledgerLines) stroke(l.points.map(mapped), l.width, { materialType: SCORE_MATERIAL.STAFF });
    const glyph = (g, materialType, protect = 0, anchor = g.anchor, center = [0, 0], outlineScale = 1) => {
      const contours = g.contours ?? glyphContours(score.pdfGlyphPaths[g.glyph.glyph]).map(c => c.map(([x, y]) =>
        ({ u: anchor.u + (x - center[0]) * g.glyph.scaleX, v: anchor.v + (y - center[1]) * g.glyph.scaleY })));
      const flat = contours.flat();
      const x0 = Math.min(...flat.map(p => p.u)), x1 = Math.max(...flat.map(p => p.u));
      const y0 = Math.min(...flat.map(p => p.v)), y1 = Math.max(...flat.map(p => p.v));
      fill(contours.map(c => c.map(p => point(p.u, p.v, { u: anchor.u, v: anchor.v, kind: 1,
        offset: [(p.u - anchor.u) * outlineScale, (p.v - anchor.v) * outlineScale], spriteUV: [(p.u - x0) / (x1 - x0), (p.v - y0) / (y1 - y0)],
        materialType, gold: protect, head: g.noteId && materialType === SCORE_MATERIAL.HEAD ? 1 : 0 }))), emit);
    };
    for (const h of group.heads) {
      glyph(h, SCORE_MATERIAL.HEAD_WASH, 0, h.anchor, [0, 0], 1.3);
      glyph(h, SCORE_MATERIAL.HEAD, h.noteId === markerId ? 1 : 0);
      const contours = h.contours.flat();
      const width = Math.max(...contours.map(p => p.u)) - Math.min(...contours.map(p => p.u));
      const height = Math.max(...contours.map(p => p.v)) - Math.min(...contours.map(p => p.v));
      pigmentDabs(h.anchor, h.noteId, Math.max(width, height));
      circuitContact(h.anchor,width,height,h===group.heads[0]);
    }
    for (const a of group.accidents) glyph(a, SCORE_MATERIAL.ACCIDENTAL);
    const tuplets = group.tuplets ?? (group.number ? [group.number] : []);
    for (const n of tuplets) {
      for (const path of n.bracket?.paths ?? []) stroke(path.map(mapped), n.bracket.width);
      const a = mapped(n.anchor);
      const sourceContours = glyphContours(score.pdfGlyphPaths[n.glyph.glyph]);
      const flat = sourceContours.flat();
      const x0 = Math.min(...flat.map(([x]) => x)), x1 = Math.max(...flat.map(([x]) => x));
      const y0 = Math.min(...flat.map(([, y]) => y)), y1 = Math.max(...flat.map(([, y]) => y));
      const contours = sourceContours.map(c => c.map(([x, y]) => {
        const offset = [(x - n.centerX) * n.glyph.scaleX, (y - n.centerY) * n.glyph.scaleY];
        return point(a.u, a.v, { x: a.u + offset[0], y: a.v + offset[1], remap: a.remap, kind: 5,
          materialType: SCORE_MATERIAL.TRIPLET, offset,
          spriteUV: [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)] });
      }));
      fill(contours, emit);
    }
  }
  for (const { track, notes, points } of voicePaths) {
    const beatAt = x => {
      if (!notes.length) return -1;
      let index = 0;
      while (index < notes.length - 2 && x > notes[index + 1].x) index += 1;
      const a = notes[index], b = notes[Math.min(notes.length - 1, index + 1)];
      const span = b.x - a.x;
      return span > 1e-7 ? a.beat + (b.beat - a.beat) * (x - a.x) / span : a.beat;
    };
    const contour = points.map(p => point(p.x, p.y, { beat: beatAt(p.x) }));
    if (contour.length > 1) stroke(contour, .28, { voice: track, materialType: SCORE_MATERIAL.VOICE });
    for (const note of notes) {
      if (note.x >= view.x0 && note.x <= view.x1) noteDot(note, track);
    }
  }
  const r = engraving.rest;
  if(r.x>=view.x0&&r.x<=view.x1){
    const a = point(r.x, r.y, { kind: 1, materialType: SCORE_MATERIAL.REST });
    const rest = [
      { offset: [-r.width / 2, 0], spriteUV: [0, 0] }, { offset: [r.width / 2, 0], spriteUV: [1, 0] },
      { offset: [r.width / 2, r.height], spriteUV: [1, 1] }, { offset: [-r.width / 2, r.height], spriteUV: [0, 1] },
    ].map(({ offset, spriteUV }) => ({ ...a, offset, spriteUV }));
    emit(rest[0], rest[1], rest[2]); emit(rest[0], rest[2], rest[3]);
  }
  const geometry = new THREE.BufferGeometry();
  const sizes = { position: 3, sourceUV: 2, remap: 1, glyphOffset: 2, spriteUV: 2, segmentEnd: 2,
    segmentRemap: 1, segmentBeat: 1, stroke: 2, feature: 2, beat: 1, noteDuration: 1,
    protection: 2, role: 2 };
  for (const [name, values] of Object.entries(attributes)) geometry.setAttribute(name,
    new THREE.BufferAttribute(new Float32Array(values), sizes[name]).setUsage(THREE.StaticDrawUsage));
  return geometry;
}
