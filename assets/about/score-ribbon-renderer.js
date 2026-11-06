function createProjector(width, height, study) {
  const rangeX = study.x1 - study.x0;
  const rangeY = study.y1 - study.y0;
  const horizontalInset = width < 520 ? 22 : 56;
  const verticalInset = width < 520 ? 44 : 76;
  const unitScale = Math.min((width - horizontalInset * 2) / rangeX, (height - verticalInset) / rangeY);
  const cameraDistance = 600;
  const xInset = (width - rangeX * unitScale) / 2;
  const staffMiddle = (study.staffLines[0] + study.staffLines.at(-1)) / 2;

  return (x, y) => {
    const u = (x - study.x0) / rangeX;
    const phase = (u * .9 - .16) * Math.PI * 2;
    const z = -10 + 50 * Math.sin(phase);
    const perspective = cameraDistance / (cameraDistance - z);
    const bend = Math.sin(phase) * height * .12;
    return {
      x: xInset + (x - study.x0) * unitScale * perspective,
      y: height * .5 + (y - staffMiddle) * unitScale * perspective + bend * perspective,
      scale: unitScale * perspective,
      perspective,
      depth: z,
      u,
    };
  };
}

function samplePdfCommand(command) {
  const points = command.points.map(([x, y]) => ({ x, y }));
  if (command.kind === "polyline") return points;

  const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
  if (command.kind === "l") {
    const [start, end] = points;
    const steps = Math.max(1, Math.ceil(distance(start, end) / 4));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    });
  }

  if (command.kind === "c") {
    const [start, firstControl, secondControl, end] = points;
    const estimate = distance(start, firstControl) + distance(firstControl, secondControl) + distance(secondControl, end);
    const steps = Math.max(8, Math.ceil(estimate / 4));
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

function pdfDrawingPaths(drawing) {
  const paths = [];
  let current = [];
  for (const command of drawing.commands) {
    const samples = samplePdfCommand(command);
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

function cropClipPath(context, project, study) {
  const points = [];
  const steps = 32;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(study.x0 + (study.x1 - study.x0) * t, study.y0));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(study.x1, study.y0 + (study.y1 - study.y0) * t));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(study.x1 - (study.x1 - study.x0) * t, study.y1));
  }
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push(project(study.x0, study.y1 - (study.y1 - study.y0) * t));
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => context.lineTo(point.x, point.y));
  context.closePath();
  context.clip();
}

function drawPdfRibbon(context, project, study) {
  const pixelRatio = context.getTransform().a || 1;
  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = context.canvas.width;
  inkCanvas.height = context.canvas.height;
  const inkContext = inkCanvas.getContext("2d");
  inkContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  inkContext.save();
  cropClipPath(inkContext, project, study);
  inkContext.lineJoin = "round";
  inkContext.lineCap = "round";
  inkContext.fillStyle = "#a99db8";
  inkContext.strokeStyle = "#a99db8";

  for (const drawing of study.pdfDrawings) {
    for (const path of pdfDrawingPaths(drawing)) {
      if (path.length < 2) continue;
      const projected = path.map(point => project(point.x, point.y));
      inkContext.beginPath();
      inkContext.moveTo(projected[0].x, projected[0].y);
      projected.slice(1).forEach(point => inkContext.lineTo(point.x, point.y));
      if (drawing.close) inkContext.closePath();
      if (drawing.fill) inkContext.fill();
      if (drawing.stroke) {
        const averageScale = projected.reduce((sum, point) => sum + point.scale, 0) / projected.length;
        inkContext.lineWidth = Math.max(.65, drawing.width * averageScale);
        inkContext.stroke();
      }
    }
  }

  for (const glyph of study.pdfGlyphs) {
    const definition = study.pdfGlyphPaths[glyph.glyph];
    if (!definition) continue;
    const point = project(glyph.x, glyph.y);
    inkContext.save();
    inkContext.translate(point.x, point.y);
    inkContext.scale(glyph.scaleX * point.scale, glyph.scaleY * point.scale);
    inkContext.fill(new Path2D(definition));
    inkContext.restore();
  }
  inkContext.restore();
  context.save();
  context.globalAlpha = .48;
  context.drawImage(inkCanvas, 0, 0, context.canvas.width / pixelRatio, context.canvas.height / pixelRatio);
  context.restore();
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

function blendColor(far, near, progress) {
  const parse = value => value.match(/[\da-f]{2}/gi).map(channel => Number.parseInt(channel, 16));
  const a = parse(far);
  const b = parse(near);
  const amount = Math.max(0, Math.min(1, progress));
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)).join(" ")})`;
}

function drawRibbonVoice(context, track, project, study) {
  const notes = study.voices
    .filter(event => event.track === track)
    .sort((left, right) => left.beat - right.beat)
    .map(event => ({ x: event.x, y: staffYForMidi(event.writtenMidi, study) }));
  const points = voiceRibbonPoints(notes, project);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
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
  for (const note of notes) {
    const point = project(note.x, note.y);
    const radius = Math.max(2, Math.min(4.2, point.scale * 2.1));
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = track === 1 ? "#83bdff" : "#d0afff";
    context.fill();
  }
  context.restore();
}

export function drawScoreRibbon(context, width, height, study) {
  context.clearRect(0, 0, width, height);
  const atmosphere = context.createRadialGradient(width * .52, height * .52, 4, width * .52, height * .52, width * .53);
  atmosphere.addColorStop(0, "rgb(73 37 118 / 24%)");
  atmosphere.addColorStop(1, "rgb(8 8 14 / 0%)");
  context.fillStyle = atmosphere;
  context.fillRect(0, 0, width, height);

  const project = createProjector(width, height, study);
  drawPdfRibbon(context, project, study);
  drawRibbonVoice(context, 1, project, study);
  drawRibbonVoice(context, 2, project, study);
}
