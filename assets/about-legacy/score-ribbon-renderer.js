import { createProjector } from "./score-ribbon-geometry.js";
const drawingBoundsCache = new WeakMap();
const drawingPathCache = new WeakMap();
const noteheadPathCache = new Map();

function drawingBounds(drawing) {
  if (Number.isFinite(drawing.minX) && Number.isFinite(drawing.maxX)) {
    return { minX: drawing.minX, maxX: drawing.maxX };
  }
  let bounds = drawingBoundsCache.get(drawing);
  if (bounds) return bounds;
  const xValues = drawing.commands.flatMap(command => command.points.map(point => point[0]));
  bounds = { minX: Math.min(...xValues), maxX: Math.max(...xValues) };
  drawingBoundsCache.set(drawing, bounds);
  return bounds;
}

function drawingPaths(drawing, sampleStep) {
  let paths = drawingPathCache.get(drawing);
  if (paths) return paths;
  paths = pdfDrawingPaths(drawing, sampleStep);
  drawingPathCache.set(drawing, paths);
  return paths;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function samplePdfCommand(command, maxLength = 4) {
  const points = command.points.map(([x, y]) => ({ x, y }));
  if (command.kind === "polyline") return points;

  const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
  if (command.kind === "l") {
    const [start, end] = points;
    const steps = Math.max(1, Math.ceil(distance(start, end) / maxLength));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    });
  }

  if (command.kind === "c") {
    const [start, firstControl, secondControl, end] = points;
    const estimate = distance(start, firstControl) + distance(firstControl, secondControl) + distance(secondControl, end);
    const steps = Math.max(8, Math.ceil(estimate / maxLength));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const inverse = 1 - t;
      return {
        x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * firstControl.x + 3 * inverse * t ** 2 * secondControl.x + t ** 3 * end.x,
        y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * firstControl.y + 3 * inverse * t ** 2 * secondControl.y + t ** 3 * end.y,
      };
    });
  }

  return points;
}

function samePdfPoint(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y) < .03;
}

function pdfDrawingPaths(drawing, sampleStep) {
  const paths = [];
  let current = [];
  for (const command of drawing.commands) {
    const samples = samplePdfCommand(command, sampleStep);
    if (current.length && samePdfPoint(current.at(-1), samples[0])) {
      current.push(...samples.slice(1));
    } else {
      if (current.length) paths.push(current);
      current = samples;
    }
  }
  if (current.length) paths.push(current);
  if (drawing.close) {
    return paths.map(path => samePdfPoint(path[0], path.at(-1)) ? path : [...path, path[0]]);
  }
  return paths;
}

function clipPolygonX(points, boundary, keepRight) {
  const result = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const insideA = keepRight ? a.x >= boundary : a.x <= boundary;
    const insideB = keepRight ? b.x >= boundary : b.x <= boundary;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (boundary - a.x) / (b.x - a.x);
      result.push({ x: boundary, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

function clipSegmentX(start, end, minimum, maximum) {
  const delta = end.x - start.x;
  if (Math.abs(delta) < .000001) return start.x < minimum || start.x > maximum ? null : [start, end];
  const atMinimum = (minimum - start.x) / delta;
  const atMaximum = (maximum - start.x) / delta;
  const enter = Math.max(0, Math.min(atMinimum, atMaximum));
  const leave = Math.min(1, Math.max(atMinimum, atMaximum));
  if (enter > leave) return null;
  const pointAt = t => ({ x: start.x + delta * t, y: start.y + (end.y - start.y) * t });
  return [pointAt(enter), pointAt(leave)];
}

function drawPdfRibbon(context, project, study, depthAware, view, queue) {
  const heads = study.pdfGlyphs.filter(glyph => glyph.noteId && glyph.x >= view.x0 - 12 && glyph.x <= view.x1 + 12);
  // Upright glyphs need upright stems at their contact column; other source vectors retain their coordinates.
  const inkPoint = (point, staff, head) => {
    if (staff) return project(point.x, point.y);
    if (!head) return project(point.x, point.y);
    const anchor = project(head.x, head.y);
    return { ...anchor, x: anchor.x + (point.x - head.x) * anchor.scale, y: anchor.y + (point.y - head.y) * anchor.scale };
  };
  const enqueue = (points, drawing, fill) => {
    if (points.length < 2) return;
    const staff = drawing.maxX - drawing.minX > 35 && points.every(point => Math.abs(point.y - points[0].y) < .03)
      && study.staffLines.some(y => Math.abs(y - points[0].y) < .05);
    const narrow = drawing.maxX - drawing.minX < 4;
    const endpoints = drawing.commands.flatMap(command => [command.points[0], command.points.at(-1)]);
    const candidates = narrow ? heads.map(head => ({ head, distance: Math.min(...endpoints.map(([x, y]) => Math.hypot(head.x - x, head.y - y))) })) : [];
    candidates.sort((a, b) => a.distance - b.distance);
    const anchor = candidates[0]?.distance < 4 ? candidates[0].head : null;
    const projected = points.map(point => inkPoint(point, staff, anchor));
    const depth = projected.reduce((sum, point) => sum + point.depth, 0) / projected.length;
    const scale = projected.reduce((sum, point) => sum + point.scale, 0) / projected.length;
    const perspective = projected[0].perspective;
    queue.push({ depth, draw() {
      context.save();
      const proximity = clamp((perspective - .6) / .7, 0, 1);
      context.globalAlpha = depthAware ? .22 + proximity * .78 : .72;
      context.strokeStyle = context.fillStyle = depthAware ? blendColor("#30394c", "#f0e1ff", proximity) : "#bbb3c6";
      context.beginPath();
      context.moveTo(projected[0].x, projected[0].y);
      projected.slice(1).forEach(point => context.lineTo(point.x, point.y));
      if (fill) { context.closePath(); context.fill(); }
      else { context.lineWidth = Math.max(.45, drawing.width * scale); context.stroke(); }
      context.restore();
    } });
  };
  for (const drawing of study.pdfDrawings) {
    const { minX, maxX } = drawingBounds(drawing);
    if (maxX < view.x0 || minX > view.x1) continue;
    for (const path of drawingPaths(drawing, study.samplingStep ?? 4)) {
      if (drawing.fill) {
        // Split filled beams into source-space slabs before projection; an entire loop cannot share one depth.
        for (let x = Math.max(minX, view.x0); x < Math.min(maxX, view.x1); x += 2) {
          const slab = clipPolygonX(clipPolygonX(path, x, true), Math.min(x + 2, view.x1), false);
          enqueue(slab, drawing, true);
        }
      }
      if (drawing.stroke) {
        for (let i = 0; i < path.length - 1; i += 1) {
          const a = path[i]; const b = path[i + 1];
          if (Math.max(a.x, b.x) < view.x0 || Math.min(a.x, b.x) > view.x1) continue;
          const clipped = clipSegmentX(a, b, view.x0, view.x1);
          if (clipped) enqueue(clipped, drawing, false);
        }
      }
    }
  }
  for (const glyph of study.pdfGlyphs) {
    if (glyph.x < view.x0 || glyph.x > view.x1) continue;
    const definition = study.pdfGlyphPaths[glyph.glyph];
    if (!definition) continue;
    let path = noteheadPathCache.get(definition);
    if (!path) { path = new Path2D(definition); noteheadPathCache.set(definition, path); }
    const point = project(glyph.x, glyph.y);
    queue.push({ depth: point.depth + .01, draw() {
      context.save();
      context.translate(point.x, point.y);
      context.scale(glyph.scaleX * point.scale, glyph.scaleY * point.scale);
      const proximity = clamp((point.perspective - .6) / .7, 0, 1);
      context.fillStyle = depthAware ? blendColor("#30394c", "#f0e1ff", proximity) : "#bbb3c6";
      context.globalAlpha = depthAware ? .28 + proximity * .72 : .8;
      context.fill(path);
      context.restore();
    } });
  }
}

export function staffYForMidi(midi, study) {
  const naturalStep = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + naturalStep[pitchClass];
  const e4 = 4 * 7 + 2;
  return study.staffBottom - (diatonic - e4) * study.halfStep;
}

export function voiceRibbonPoints(notes, project) {
  const points = [];
  for (let index = 0; index < notes.length - 1; index += 1) {
    const before = notes[Math.max(0, index - 1)];
    const start = notes[index];
    const end = notes[index + 1];
    const after = notes[Math.min(notes.length - 1, index + 2)];
    const steps = Math.max(8, Math.ceil(Math.abs(end.x - start.x) / 4));
    for (let step = index === 0 ? 0 : 1; step <= steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = .5 * ((2 * start.x) + (-before.x + end.x) * t + (2 * before.x - 5 * start.x + 4 * end.x - after.x) * t2 + (-before.x + 3 * start.x - 3 * end.x + after.x) * t3);
      const y = .5 * ((2 * start.y) + (-before.y + end.y) * t + (2 * before.y - 5 * start.y + 4 * end.y - after.y) * t2 + (-before.y + 3 * start.y - 3 * end.y + after.y) * t3);
      points.push(project(x, y));
    }
  }
  if (notes.length === 1) points.push(project(notes[0].x, notes[0].y));
  return points;
}

export function visualVoiceSegments(events, track, view, silenceTolerance = .125) {
  const byBeat = new Map();
  events
    .filter(event => event.track === track && event.x >= view.x0 - 24 && event.x <= view.x1 + 24)
    .forEach(event => {
      const previous = byBeat.get(event.beat);
      if (!previous || event.writtenMidi > previous.writtenMidi) byBeat.set(event.beat, event);
    });
  const notes = [...byBeat.values()].sort((left, right) => left.beat - right.beat);
  const segments = [];
  for (const note of notes) {
    const current = segments.at(-1);
    const previous = current?.at(-1);
    if (!previous || note.beat > previous.beat + previous.duration + silenceTolerance) {
      segments.push([note]);
    } else {
      current.push(note);
    }
  }
  return segments;
}

function blendColor(far, near, progress) {
  const parse = value => value.match(/[\da-f]{2}/gi).map(channel => Number.parseInt(channel, 16));
  const a = parse(far);
  const b = parse(near);
  const amount = Math.max(0, Math.min(1, progress));
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)).join(" ")})`;
}

function drawRibbonVoice(context, track, project, study, depthAware, view, playbackBeat = null, queue = null) {
  const segments = visualVoiceSegments(study.voices, track, view)
    .map(segment => segment.map(event => ({ ...event, y: staffYForMidi(event.writtenMidi, study) })));
  const notes = segments.flat();
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const segment of segments) {
    const points = voiceRibbonPoints(segment, project);
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const paint = () => {
      const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
      const near = track === 1 ? "#70a8ff" : "#c39aff";
      const far = track === 1 ? "#243e67" : "#49305e";
      gradient.addColorStop(0, depthAware ? blendColor(far, near, (start.perspective - .6) / .7) : near);
      gradient.addColorStop(1, depthAware ? blendColor(far, near, (end.perspective - .6) / .7) : near);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = gradient;
      context.lineWidth = depthAware
        ? Math.max(1.3, Math.min(2.8, (start.scale + end.scale) * .7))
        : 2.7;
      context.stroke();
      };
      queue.push({ depth: (start.depth + end.depth) / 2, draw: paint });
    }
  }
  for (const note of notes) {
    const point = project(note.x, note.y);
    const paint = () => {
    const radius = depthAware
      ? Math.max(2, Math.min(4.2, point.scale * 2.1))
      : Math.max(3.2, Math.min(5, point.scale * 3.2));
    const proximity = clamp((point.perspective - .6) / .7, 0, 1);
    const color = track === 1 ? "#70a8ff" : "#c39aff";
    const active = playbackBeat !== null
      && playbackBeat >= note.beat
      && playbackBeat < note.beat + Math.max(0.04, note.duration);
    const attack = active && playbackBeat - note.beat < .16;
    if (active || depthAware && proximity > .2) {
      context.save();
      context.globalAlpha = active ? .62 : proximity * .34;
      context.shadowColor = color;
      context.shadowBlur = active ? (attack ? 18 : 11) : 4 + proximity * 11;
      context.beginPath();
      context.arc(point.x, point.y, radius * (active ? (attack ? 2.1 : 1.65) : 1.15 + proximity * .45), 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.restore();
    }
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.globalAlpha = depthAware ? .46 + proximity * .54 : 1;
    context.fillStyle = color;
    context.fill();
    context.globalAlpha = 1;
    };
    queue.push({ depth: point.depth + .02, draw: paint });
  }
  context.restore();
}

export function drawScoreRibbon(context, width, height, study, motion = null) {
  context.clearRect(0, 0, width, height);
  const atmosphere = context.createRadialGradient(width * .52, height * .52, 4, width * .52, height * .52, width * .53);
  atmosphere.addColorStop(0, "rgb(73 37 118 / 24%)");
  atmosphere.addColorStop(1, "rgb(8 8 14 / 0%)");
  context.fillStyle = atmosphere;
  context.fillRect(0, 0, width, height);

  const progress = motion ? clamp(Number.isFinite(motion.progress) ? motion.progress : 0, 0, 1) : null;
  const view = motion && Number.isFinite(motion.viewStart) && Number.isFinite(motion.viewEnd)
    ? { x0: motion.viewStart, x1: motion.viewEnd }
    : study;
  const playbackBeat = Number.isFinite(motion?.playbackBeat) ? motion.playbackBeat : null;
  const foldProgress = Number.isFinite(motion?.foldProgress) ? motion.foldProgress
    : progress === null ? 1 : clamp((progress - .29) / .08, 0, 1);
  const depthAware = motion?.depthAware ?? Boolean(motion);
  const project = createProjector(width, height, study, foldProgress, view, Boolean(motion?.traveling), motion?.verticalOffset ?? 0);
  const queue = [];
  drawPdfRibbon(context, project, study, depthAware, view, queue);
  drawRibbonVoice(context, 1, project, study, depthAware, view, playbackBeat, queue);
  drawRibbonVoice(context, 2, project, study, depthAware, view, playbackBeat, queue);
  queue.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());
  if (motion?.markerNoteId) {
    const glyph = study.pdfGlyphs.find(item => item.noteId === motion.markerNoteId);
    if (glyph) {
      const point = project(glyph.x, glyph.y);
      context.save(); context.strokeStyle = "#ffe292"; context.lineWidth = 1.5;
      context.beginPath(); context.arc(point.x, point.y, Math.max(6, point.scale * 3), 0, Math.PI * 2); context.stroke(); context.restore();
    }
  }
  if (playbackBeat !== null && Number.isFinite(motion?.playbackX)) {
    const x = motion.playbackX;
    if (x >= view.x0 && x <= view.x1) {
      const top = project(x, study.y0);
      const bottom = project(x, study.y1);
      context.save();
      context.globalAlpha = .44;
      context.strokeStyle = "#f2ecff";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(top.x, top.y);
      context.lineTo(bottom.x, bottom.y);
      context.stroke();
      context.restore();
    }
  }
}
