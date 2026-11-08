import * as THREE from './vendor/three-score.min.js';
import { glyphContours } from './score-compound-groups.js';
import { HALO_HALF_WIDTH } from './score-depth-cues.js';

const MARKER = 'guitar-33-4-1';

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
export function buildRibbonGeometry(score, view, groups, engraving, voicePaths = []) {
  const attributes = { position: [], sourceUV: [], remap: [], glyphOffset: [], segmentEnd: [],
    segmentRemap: [], stroke: [], kind: [], gold: [], frontHead: [], arrivalBar: [], voice: [] };
  const point = (u, v, extra = {}) => ({ x: u, y: v, u, v, ...extra });
  function emit(a, b, c) {
    for (const p of [a, b, c]) {
      attributes.position.push(0, 0, p.t ?? 0);
      attributes.sourceUV.push(p.u, p.v);
      attributes.remap.push(p.remap ?? 0);
      attributes.glyphOffset.push(...(p.offset ?? [0, 0]));
      attributes.segmentEnd.push(...(p.end ?? [p.u, p.v]));
      attributes.segmentRemap.push(p.endRemap ?? 0);
      attributes.stroke.push(p.side ?? 0, p.width ?? 0);
      attributes.kind.push(p.kind ?? 0);
      attributes.gold.push(p.gold ?? 0);
      attributes.frontHead.push(p.head ?? 0);
      attributes.arrivalBar.push(p.arrivalBar ?? 0);
      attributes.voice.push(p.voice ?? 0);
    }
  }
  function stroke(path, width, extra = {}) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const p = { ...a, ...extra, kind: 2, end: [b.u, b.v], endRemap: b.remap ?? 0, width };
      const q = { ...p, t: 1 };
      emit({ ...p, side: -1 }, { ...p, side: 1 }, { ...q, side: 1 });
      emit({ ...p, side: -1 }, { ...q, side: 1 }, { ...q, side: -1 });
    }
  }
  function strip(top, bottom, extra = {}) {
    for (let i = 1; i < top.length; i++) {
      const a = { ...top[i - 1], ...extra }, b = { ...top[i], ...extra };
      const c = { ...bottom[i], ...extra }, d = { ...bottom[i - 1], ...extra };
      emit(a, b, c); emit(a, c, d);
    }
  }
  function noteDot(note, track) {
    const center = point(note.x, note.y, { kind: 1, voice: track });
    const segments = 16, radiusX = .4, radiusY = .32;
    for (let index = 0; index < segments; index += 1) {
      const angleA = index / segments * Math.PI * 2;
      const angleB = (index + 1) / segments * Math.PI * 2;
      const a = point(note.x, note.y, { kind: 1, voice: track,
        offset: [Math.cos(angleA) * radiusX, Math.sin(angleA) * radiusY] });
      const b = point(note.x, note.y, { kind: 1, voice: track,
        offset: [Math.cos(angleB) * radiusX, Math.sin(angleB) * radiusY] });
      emit(center, a, b);
    }
  }
  const along = v => Array.from({ length: 561 }, (_, i) => point(view.x0 + (view.x1 - view.x0) * i / 560, v));
  // A contiguous ribbon is triangulated as strips, avoiding concave-outline diagonals.
  strip(along(-4 - HALO_HALF_WIDTH), along(-4 + HALO_HALF_WIDTH), { kind: 4 });
  // Match Canvas' screen-space stroke instead of offsetting in staff-space.
  for (const y of score.staffLines) stroke(along(y), engraving.staffWidth);
  for (const bar of engraving.barlines) stroke(Array.from({ length: 33 }, (_, i) => point(bar.x, -8 + i / 4)),
    engraving.staffWidth, { arrivalBar: bar.x <= view.x0 + .01 ? 1 : 0 });

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
    if (group.upper) strip(group.upper.map(mapped), group.lower.map(mapped));
    for (let i = 0; i < group.stems.length; i++) {
      const s = group.stems[i], h = group.heads[i], tip = mapped(s.tip);
      // Head contact and beam tip are projected independently; the connecting stem
      // interpolates those exact screen anchors instead of shearing an upright glyph.
      const p = point(h.anchor.u, h.anchor.v, { kind: 3, end: [tip.u, tip.v], endRemap: tip.remap,
        offset: [s.contact.u - h.anchor.u, s.contact.v - h.anchor.v], width: s.width });
      emit({ ...p, side: -1 }, { ...p, side: 1 }, { ...p, side: 1, t: 1 });
      emit({ ...p, side: -1 }, { ...p, side: 1, t: 1 }, { ...p, side: -1, t: 1 });
    }
    for (const l of group.ledgerLines) stroke(l.points.map(mapped), l.width);
    const glyph = (g, protect = 0, anchor = g.anchor, center = [0, 0]) => {
      const contours = g.contours ?? glyphContours(score.pdfGlyphPaths[g.glyph.glyph]).map(c => c.map(([x, y]) =>
        ({ u: anchor.u + (x - center[0]) * g.glyph.scaleX, v: anchor.v + (y - center[1]) * g.glyph.scaleY })));
      fill(contours.map(c => c.map(p => point(p.u, p.v, { u: anchor.u, v: anchor.v, kind: 1,
        offset: [p.u - anchor.u, p.v - anchor.v], gold: protect, head: g.noteId ? 1 : 0 }))), emit);
    };
    for (const h of group.heads) glyph(h, h.noteId === MARKER ? 1 : 0);
    for (const a of group.accidents) glyph(a);
    for (const path of group.bracket?.paths ?? []) stroke(path.map(mapped), group.bracket.width);
    if (group.number) {
      const n = group.number, a = mapped(n.anchor);
      const contours = glyphContours(score.pdfGlyphPaths[n.glyph.glyph]).map(c => c.map(([x, y]) => {
        const offset = [(x - n.centerX) * n.glyph.scaleX, (y - n.centerY) * n.glyph.scaleY];
        return point(a.u, a.v, { x: a.u + offset[0], y: a.v + offset[1], remap: a.remap, kind: 5, offset });
      }));
      fill(contours, emit);
    }
  }
  for (const { track, notes, points } of voicePaths) {
    const contour = points.map(p => point(p.x, p.y));
    if (contour.length > 1) stroke(contour, .28, { voice: track });
    for (const note of notes) {
      if (note.x >= view.x0 && note.x <= view.x1) noteDot(note, track);
    }
  }
  const r = engraving.rest;
  if(r.x>=view.x0&&r.x<=view.x1){
    const a = point(r.x, r.y, { kind: 1 });
    const rest = [[-r.width / 2, 0], [r.width / 2, 0], [r.width / 2, r.height], [-r.width / 2, r.height]]
      .map(offset => ({ ...a, offset }));
    emit(rest[0], rest[1], rest[2]); emit(rest[0], rest[2], rest[3]);
  }
  const geometry = new THREE.BufferGeometry();
  const sizes = { position: 3, sourceUV: 2, remap: 1, glyphOffset: 2, segmentEnd: 2,
    segmentRemap: 1, stroke: 2, kind: 1, gold: 1, frontHead: 1, arrivalBar: 1, voice: 1 };
  for (const [name, values] of Object.entries(attributes)) geometry.setAttribute(name,
    new THREE.BufferAttribute(new Float32Array(values), sizes[name]).setUsage(THREE.StaticDrawUsage));
  return geometry;
}
