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

function poseAt(progress) {
  const phase = clamp(progress, 0, 1) * Math.PI * 2 * 1.25 - Math.PI / 2;
  return {
    bend: .075 + .045 * Math.sin(phase),
    depth: .075 + .035 * Math.sin(phase + .72),
    twist: .055 + .025 * Math.cos(phase - .38),
  };
}

function createProjector(width, height, study, progress = null, view = study) {
  const rangeX = view.x1 - view.x0;
  const rangeY = study.y1 - study.y0;
  const horizontalInset = width < 520 ? 22 : 56;
  const verticalInset = width < 520 ? 44 : 76;
  const unitScale = Math.min((width - horizontalInset * 2) / rangeX, (height - verticalInset) / rangeY);
  const cameraDistance = 720;
  const xInset = (width - rangeX * unitScale) / 2;
  const staffMiddle = (study.staffLines[0] + study.staffLines.at(-1)) / 2;
  const pose = progress == null ? null : poseAt(progress);

  return (x, y) => {
    const u = (x - view.x0) / rangeX;
    const phase = progress == null
      ? (u * .9 - .16) * Math.PI * 2
      : (u * .68 + progress * .92) * Math.PI * 2;
    const secondaryPhase = progress == null ? phase : (u * 1.02 - progress * .42) * Math.PI * 2;
    const wave = progress == null ? Math.sin(phase) : .84 * Math.sin(phase) + .16 * Math.sin(secondaryPhase);
    const z = progress == null ? -10 + 50 * wave : pose.depth * cameraDistance * wave;
    const perspective = cameraDistance / (cameraDistance - z);
    const bend = progress == null
      ? Math.sin(phase) * height * .12
      : height * pose.bend * wave;
    const baseX = xInset + (x - view.x0) * unitScale;
    const twist = pose ? Math.sin(phase * .48) * width * pose.twist * .075 : 0;
    return {
      x: width * .5 + (baseX - width * .5) * perspective + twist,
      y: height * .5 + (y - staffMiddle) * unitScale * perspective + bend * perspective,
      scale: unitScale * perspective,
      perspective,
      depth: z,
      u,
    };
  };
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

function cropClipPath(context, project, view, study) {
  const points = [];
  const steps = 32;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(view.x0 + (view.x1 - view.x0) * t, study.y0));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(view.x1, study.y0 + (study.y1 - study.y0) * t));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(view.x1 - (view.x1 - view.x0) * t, study.y1));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(view.x0, study.y1 - (study.y1 - study.y0) * t));
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => context.lineTo(point.x, point.y));
  context.closePath();
  context.clip();
}

function drawPdfRibbon(context, project, study, depthAware, view) {
  const inkContext = context;
  inkContext.save();
  inkContext.globalAlpha = .48;
  cropClipPath(inkContext, project, view, study);
  inkContext.lineJoin = "round";
  inkContext.lineCap = "round";
  inkContext.fillStyle = "#a99db8";
  inkContext.strokeStyle = "#a99db8";

  for (const drawing of study.pdfDrawings) {
    const { minX, maxX } = drawingBounds(drawing);
    if (maxX < view.x0 - 12 || minX > view.x1 + 12) continue;
    for (const path of drawingPaths(drawing, study.samplingStep ?? 4)) {
      if (path.length < 2) continue;
      const projected = path.map(point => project(point.x, point.y));
      inkContext.beginPath();
      inkContext.moveTo(projected[0].x, projected[0].y);
      projected.slice(1).forEach(point => inkContext.lineTo(point.x, point.y));
      if (drawing.close) inkContext.closePath();
      const averageScale = projected.reduce((sum, point) => sum + point.scale, 0) / projected.length;
      const averageDepth = projected.reduce((sum, point) => sum + point.perspective, 0) / projected.length;
      const depthAlpha = depthAware
        ? .48 * (.72 + clamp((averageDepth - .78) / .61, 0, 1) * .28)
        : .48;
      if (drawing.fill) {
        inkContext.globalAlpha = depthAlpha;
        inkContext.fill();
      }
      if (drawing.stroke) {
        inkContext.globalAlpha = depthAlpha;
        inkContext.lineWidth = Math.max(.45, drawing.width * averageScale);
        inkContext.stroke();
      }
    }
  }

  for (const glyph of study.pdfGlyphs) {
    if (glyph.x < view.x0 - 12 || glyph.x > view.x1 + 12) continue;
    const definition = study.pdfGlyphPaths[glyph.glyph];
    if (!definition) continue;
    let path = noteheadPathCache.get(definition);
    if (!path) {
      path = new Path2D(definition);
      noteheadPathCache.set(definition, path);
    }
    const point = project(glyph.x, glyph.y);
    inkContext.save();
    inkContext.translate(point.x, point.y);
    inkContext.scale(glyph.scaleX * point.scale, glyph.scaleY * point.scale);
    inkContext.globalAlpha = depthAware
      ? .48 * (.72 + clamp((point.perspective - .78) / .61, 0, 1) * .28)
      : .48;
    inkContext.fill(path);
    inkContext.restore();
  }
  inkContext.restore();
  // Vector paths and noteheads stay separate drawing objects while their shared PDF coordinates bend together.
}

function staffYForMidi(midi, study) {
  const naturalStep = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + naturalStep[pitchClass];
  const e4 = 4 * 7 + 2;
  return study.staffBottom - (diatonic - e4) * study.halfStep;
}

function voiceRibbonPoints(notes, project) {
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

function drawRibbonVoice(context, track, project, study, depthAware, view, playbackBeat = null) {
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
      const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
      const near = track === 1 ? "#83bdff" : "#d0afff";
      const far = track === 1 ? "#386fbd" : "#7947ad";
      gradient.addColorStop(0, blendColor(far, near, (start.perspective - .9) / .2));
      gradient.addColorStop(1, blendColor(far, near, (end.perspective - .9) / .2));
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = gradient;
      context.lineWidth = Math.max(1.3, Math.min(2.8, (start.scale + end.scale) * .7));
      context.stroke();
    }
  }
  for (const note of notes) {
    const point = project(note.x, note.y);
    const radius = Math.max(2, Math.min(4.2, point.scale * 2.1));
    const proximity = clamp((point.perspective - .78) / .61, 0, 1);
    const color = track === 1 ? "#83bdff" : "#d0afff";
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
  const project = createProjector(width, height, study, progress, view);
  drawPdfRibbon(context, project, study, Boolean(motion), view);
  drawRibbonVoice(context, 1, project, study, Boolean(motion), view, playbackBeat);
  drawRibbonVoice(context, 2, project, study, Boolean(motion), view, playbackBeat);
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
