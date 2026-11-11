import { drawScoreRibbon, staffYForMidi } from "../score-ribbon-renderer.js";
import {
  scorePlaybackWindowAtBeat,
  scorePositionAtBeat,
  scoreRibbonTimeline,
  scoreWindowAtBeat,
  STATIC_SCORE_BEAT,
} from "../score-ribbon-timeline.js";

const PREVIEW_BEAT = STATIC_SCORE_BEAT;
const STAFF_COLORS = { ink: "#c8c0d1", blue: "#78b8ff", violet: "#c79cff" };

// One shared musical coordinate system. Chapter poses change the camera and
// material; note time and pitch stay attached to the same point on the ribbon.
const cameraStops = [
  { centerX: .23, centerY: .66, scale: .66, wave: .11, phase: -.4, spacing: 11 },
  { centerX: .46, centerY: .53, scale: .94, wave: .055, phase: .35, spacing: 11 },
  { centerX: .5, centerY: .7, scale: 1.04, wave: .014, phase: .1, spacing: 15 },
  { centerX: .22, centerY: .76, scale: .66, wave: .16, phase: -.7, spacing: 14 },
  { centerX: .5, centerY: .76, scale: .84, wave: .045, phase: .8, spacing: 11 },
  { centerX: .56, centerY: .79, scale: .92, wave: .035, phase: -.1, spacing: 11 },
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const hash = value => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0) / 4294967295;
};

function poseAt(journey, motionReduced = false) {
  const value = clamp(journey, 0, cameraStops.length - 1);
  const index = Math.min(Math.floor(value), cameraStops.length - 1);
  if (motionReduced || index === cameraStops.length - 1) return cameraStops[index];
  const next = cameraStops[index + 1];
  const t = smooth(value - index);
  return Object.fromEntries(Object.keys(cameraStops[index]).map(key => [key, mix(cameraStops[index][key], next[key], t)]));
}

function materialWeights(journey) {
  const value = clamp(journey, 0, 5);
  return {
    code: smooth(value),
    music: smooth(clamp(value - .65)) * (1 - smooth(value - 2.8)),
    art: smooth(value - 1.75) * (1 - smooth(value - 3.8)),
    games: smooth(value - 2.8) * (1 - smooth(value - 4.8)),
  };
}

export function mountScoreScene(canvas, score) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("About score canvas is missing");
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) throw new Error("Canvas 2D is unavailable for the About score scene");
  const engravedCanvas = document.createElement("canvas");
  const engravedContext = engravedCanvas.getContext("2d", { alpha: true });
  if (!engravedContext) throw new Error("Canvas 2D is unavailable for the engraved score layer");

  const tracks = new Map(score.tracks.map(track => [track.id, []]));
  for (const note of score.notes) tracks.get(note.track)?.push(note);
  for (const notes of tracks.values()) notes.sort((a, b) => a.beat - b.beat);

  const state = { journey: 0, beat: PREVIEW_BEAT, playing: false, motionReduced: false, paused: false, time: 0 };
  const voiceEvents = new Map([1, 2].map(track => [track, scoreRibbonTimeline.voices.filter(event => event.track === track)]));
  const staffCenterY = staffYForMidi(71, scoreRibbonTimeline);
  const clefImage = new Image();
  clefImage.addEventListener("load", () => { if (!state.paused) draw(); }, { once: true });
  clefImage.src = "/assets/about-legacy/guitar-score/treble-clef.svg";
  let width = 0;
  let height = 0;
  let dpr = 1;
  let resizeFrame = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const engravedWidth = Math.max(1, Math.ceil(width));
    const engravedHeight = Math.max(1, Math.ceil(height));
    if (engravedCanvas.width !== engravedWidth || engravedCanvas.height !== engravedHeight) {
      engravedCanvas.width = engravedWidth;
      engravedCanvas.height = engravedHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.paused) draw();
  }

  function centerPoint(u, pose) {
    const x = width * pose.centerX + (u - .5) * width * pose.scale;
    const bend = Math.sin(u * Math.PI * 2 + pose.phase) * pose.wave;
    const returnBend = Math.sin(u * Math.PI * 4 - pose.phase * .65) * pose.wave * .16;
    return { x, y: height * (pose.centerY + bend + returnBend) };
  }

  function staffPoint(u, pose, writtenMidi = 71) {
    const base = centerPoint(u, pose);
    const scoreY = staffYForMidi(writtenMidi, scoreRibbonTimeline);
    const stepsFromMiddle = (scoreY - staffCenterY) / scoreRibbonTimeline.halfStep;
    return {
      x: base.x,
      y: base.y - (scoreY - staffCenterY) * pose.spacing * .5,
      step: stepsFromMiddle,
    };
  }

  function pathStaff(pose, lineIndex, start = 0, end = 1, steps = 128) {
    for (let index = 0; index <= steps; index += 1) {
      const u = mix(start, end, index / steps);
      const point = centerPoint(u, pose);
      point.y += lineIndex * pose.spacing;
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
  }

  function drawStaff(pose, weights, opacity = 1) {
    const foreground = Math.max(weights.music, weights.art, weights.games);
    const lineAlpha = .19 + foreground * .31;
    for (let line = -2; line <= 2; line += 1) {
      context.beginPath();
      pathStaff(pose, line, .012, .988);
      context.globalAlpha = lineAlpha * opacity;
      context.strokeStyle = line === 0 ? "#b8adc5" : STAFF_COLORS.ink;
      context.lineWidth = weights.music > .72 ? 1.25 : .85;
      context.shadowColor = "rgba(161, 133, 214, .25)";
      context.shadowBlur = weights.music > .45 ? 4 : 1;
      context.stroke();
      context.shadowBlur = 0;
    }

    if (weights.music > .12 || weights.art > .12) {
      for (const u of [1 / 3, 2 / 3]) {
        const top = centerPoint(u, pose);
        const bottom = { ...top };
        top.y -= pose.spacing * 2.15;
        bottom.y += pose.spacing * 2.15;
        context.beginPath();
        context.moveTo(top.x, top.y);
        context.lineTo(bottom.x, bottom.y);
        context.globalAlpha = (.12 + Math.max(weights.music, weights.art) * .32) * opacity;
        context.strokeStyle = "#b8adc5";
        context.lineWidth = 1;
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function drawClef(pose, journey, gamesWeight) {
    if (!clefImage.complete || !clefImage.naturalWidth) return;
    const u = mix(.16, .035, smooth(clamp(journey / .8)));
    const point = centerPoint(u, pose);
    const tangent = centerPoint(Math.min(1, u + .012), pose);
    const angle = Math.atan2(tangent.y - point.y, tangent.x - point.x);
    const foregroundScale = mix(2.25, 1, smooth(clamp(journey / 1.5)));
    const heightPx = pose.spacing * 5.3 * foregroundScale;
    const widthPx = heightPx * .4;

    context.save();
    context.translate(point.x - widthPx * .62, point.y - heightPx * .34);
    context.rotate(angle);
    context.globalAlpha = .38 + Math.max(.18, 1 - gamesWeight) * .2;
    if (gamesWeight > .25) context.imageSmoothingEnabled = false;
    context.shadowColor = "rgba(155, 116, 223, .23)";
    context.shadowBlur = gamesWeight > .25 ? 0 : 8;
    context.drawImage(clefImage, 0, 0, widthPx, heightPx);
    context.restore();
  }

  function scoreViewAtBeat(beat) {
    const reference = scoreWindowAtBeat(STATIC_SCORE_BEAT, width);
    const fixedWidth = reference.endX - reference.startX;
    return scorePlaybackWindowAtBeat(beat, width, fixedWidth);
  }

  function notePoints(trackId, pose, view) {
    const source = voiceEvents.get(trackId) ?? [];
    const range = Math.max(.001, view.endX - view.startX);
    return source
      .filter(note => note.beat + note.duration >= view.startBeat && note.beat <= view.endBeat)
      .map(note => {
        const u = (note.x - view.startX) / range;
        return { note, u, ...staffPoint(u, pose, note.writtenMidi) };
      })
      .filter(point => point.u >= -.02 && point.u <= 1.02);
  }

  function guitarPoints(pose, view) {
    const range = Math.max(.001, view.endX - view.startX);
    return scoreRibbonTimeline.guitarHeads
      .filter(head => head.beat >= view.startBeat && head.beat <= view.endBeat)
      .map(note => {
        const u = (note.x - view.startX) / range;
        const base = centerPoint(u, pose);
        return { note, u, x: base.x, y: base.y + (note.y - staffCenterY) * pose.spacing * .5 };
      })
      .filter(point => point.u >= -.02 && point.u <= 1.02);
  }

  function drawVoiceTrace(points, color, alpha, widthPx, art = false, artRatio = 0) {
    if (points.length < 2 || alpha <= .01) return;
    context.beginPath();
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (index === 0) context.moveTo(point.x, point.y);
      else {
        const previous = points[index - 1];
        if (point.note.beat - previous.note.beat > previous.note.duration + .18) {
          context.moveTo(point.x, point.y);
          continue;
        }
        const middleX = (previous.x + point.x) * .5;
        const middleY = (previous.y + point.y) * .5;
        context.quadraticCurveTo(previous.x, previous.y, middleX, middleY);
        if (index === points.length - 1) context.lineTo(point.x, point.y);
      }
    }
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = widthPx;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = art ? color : "transparent";
    context.shadowBlur = art ? 5 : 0;
    context.stroke();
    context.shadowBlur = 0;

    if (!art || artRatio < .08) return;
    // Dry and wet passes share the note path, so the ink never drifts off pitch.
    for (let pass = 0; pass < 3; pass += 1) {
      context.beginPath();
      points.forEach((point, index) => {
        const offset = (pass - 1) * (1.2 + pass * .35);
        if (index === 0) context.moveTo(point.x, point.y + offset);
        else {
          const previous = points[index - 1];
          if (point.note.beat - previous.note.beat > previous.note.duration + .18) {
            context.moveTo(point.x, point.y + offset);
            return;
          }
          context.quadraticCurveTo(previous.x, previous.y + offset, (previous.x + point.x) * .5, (previous.y + point.y) * .5 + offset);
          if (index === points.length - 1) context.lineTo(point.x, point.y + offset);
        }
      });
      context.globalAlpha = alpha * artRatio * (pass === 1 ? .36 : .15);
      context.strokeStyle = pass === 1 ? color : (pass === 0 ? "#71aaff" : "#d5a6ff");
      context.lineWidth = pass === 1 ? widthPx * 2.7 : widthPx * .72;
      context.shadowColor = color;
      context.shadowBlur = pass === 1 ? 7 : 2;
      context.stroke();
    }
    context.shadowBlur = 0;
  }

  function drawLedger(point, pose, alpha) {
    if (Math.abs(point.step) < 5) return;
    const lowerStaffEdge = centerPoint(point.u, pose).y + pose.spacing * 2;
    const upperStaffEdge = centerPoint(point.u, pose).y - pose.spacing * 2;
    const edge = point.y > lowerStaffEdge ? lowerStaffEdge : upperStaffEdge;
    const direction = point.y > lowerStaffEdge ? 1 : -1;
    let y = edge + direction * pose.spacing * .5;
    context.globalAlpha = alpha * .48;
    context.strokeStyle = STAFF_COLORS.ink;
    context.lineWidth = .8;
    while ((direction > 0 && y <= point.y) || (direction < 0 && y >= point.y)) {
      context.beginPath();
      context.moveTo(point.x - 6, y);
      context.lineTo(point.x + 6, y);
      context.stroke();
      y += direction * pose.spacing;
    }
  }

  function drawMusicHead(point, pose, color, alpha, active) {
    drawLedger(point, pose, alpha);
    const stemDown = point.step > 0;
    const stemX = point.x + (stemDown ? -6 : 6);
    const stemEndY = point.y + (stemDown ? -24 : 24);
    context.globalAlpha = alpha * .76;
    context.strokeStyle = color;
    context.lineWidth = 1.35;
    context.beginPath();
    context.moveTo(stemX, point.y);
    context.lineTo(stemX, stemEndY);
    context.stroke();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(point.x, point.y, 6.2, 4.35, -.24, 0, Math.PI * 2);
    context.fill();
    if (active) {
      context.globalAlpha = .19;
      context.fillStyle = color;
      context.beginPath();
      context.arc(point.x, point.y, 12, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(point.x, point.y, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPigmentHead(point, color, amount, seed) {
    if (amount < .025) return;
    const radiusX = 7.4 + hash(`${seed}-rx`) * 2.3;
    const radiusY = 5.1 + hash(`${seed}-ry`) * 1.8;
    const tint = context.createRadialGradient(point.x - 1, point.y - 1, 1, point.x, point.y, radiusX * 1.75);
    tint.addColorStop(0, color);
    tint.addColorStop(.5, color);
    tint.addColorStop(1, "rgba(143, 118, 196, 0)");
    context.beginPath();
    for (let index = 0; index <= 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const jitter = .76 + hash(`${seed}-${index}`) * .42;
      const x = point.x + Math.cos(angle) * radiusX * jitter;
      const y = point.y + Math.sin(angle) * radiusY * jitter;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.globalAlpha = amount * .6;
    context.fillStyle = tint;
    context.fill();
    context.globalAlpha = amount * .77;
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.stroke();
  }

  function drawArtStem(point, color, amount, seed) {
    if (amount < .05) return;
    const stemDown = point.step > 0;
    const stemX = point.x + (stemDown ? -6 : 6);
    const endY = point.y + (stemDown ? -25 : 25);
    for (let pass = 0; pass < 4; pass += 1) {
      const offset = (hash(`${seed}-stem-${pass}`) - .5) * 3.4;
      context.globalAlpha = amount * (pass === 0 ? .36 : .17);
      context.strokeStyle = pass === 1 ? "#87adf1" : color;
      context.lineWidth = pass === 0 ? 3.4 : .9 + hash(`${seed}-width-${pass}`) * 1.2;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(stemX + offset, point.y + (stemDown ? -1 : 1));
      context.quadraticCurveTo(stemX + offset * .55 + 1, (point.y + endY) * .5, stemX + offset * .8, endY);
      context.stroke();
    }
  }

  function drawGroupBeams(points, color, alpha, artRatio = 0) {
    let group = [];
    const groups = [];
    for (const point of points) {
      const last = group.at(-1);
      const close = last && point.note.beat - last.note.beat <= Math.max(last.note.duration + .08, .55);
      if (point.note.duration <= .55 && (!last || close)) group.push(point);
      else {
        if (group.length > 1) groups.push(group);
        group = point.note.duration <= .55 ? [point] : [];
      }
    }
    if (group.length > 1) groups.push(group);
    for (const beamGroup of groups) {
      const ends = beamGroup.map(point => {
        const stemDown = point.step > 0;
        return { x: point.x + (stemDown ? -6 : 6), y: point.y + (stemDown ? -24 : 24) };
      });
      context.beginPath();
      ends.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      for (let index = ends.length - 1; index >= 0; index -= 1) context.lineTo(ends[index].x, ends[index].y + 4.2);
      context.closePath();
      context.globalAlpha = alpha * (1 - artRatio * .42);
      context.fillStyle = color;
      context.fill();
      if (artRatio > .03) {
        context.globalAlpha = alpha * artRatio * .38;
        context.strokeStyle = color;
        context.lineWidth = 8;
        context.lineCap = "round";
        context.stroke();
      }
    }
  }

  function drawNotes(trackId, beat, pose, color, alpha, view, options = {}) {
    if (alpha <= .01) return;
    const points = notePoints(trackId, pose, view);
    if (!points.length) return;
    const { voice = false, artProgress = 0, pixelProgress = 0 } = options;
    const traceAlpha = alpha * (voice ? .72 : .34);
    drawVoiceTrace(points, color, traceAlpha * (1 - artProgress * .82) * (1 - pixelProgress), voice ? 1.8 : 1, false);
    if (artProgress > .015 && voice) drawVoiceTrace(points, color, traceAlpha * artProgress * (1 - pixelProgress), 1.7, true, artProgress);
    if (!voice) drawGroupBeams(points, color, alpha * .74, artProgress);

    for (const point of points) {
      const active = state.playing && beat >= point.note.beat && beat < point.note.beat + point.note.duration;
      const noteAlpha = alpha * (voice ? .94 : .56);
      const localInk = voice ? smooth(artProgress * 1.5 - point.u * .54 + .05) : artProgress;
      const localPixel = voice ? smooth(pixelProgress * 1.55 - point.u * .54 + .05) : pixelProgress;
      if (localPixel > .02) {
        const size = 6;
        context.globalAlpha = noteAlpha * localPixel;
        context.fillStyle = color;
        context.fillRect(Math.round(point.x / size) * size, Math.round(point.y / size) * size, size, size);
      }
      drawMusicHead(point, pose, color, noteAlpha * (1 - localInk) * (1 - localPixel), active && localInk < .2);
      const pigmentAlpha = noteAlpha * localInk * (1 - localPixel);
      if (localInk > .02 && voice && localPixel < .99) {
        const seed = `${trackId}-${point.note.beat.toFixed(3)}-${point.note.writtenMidi}`;
        drawPigmentHead(point, color, pigmentAlpha, seed);
        drawArtStem(point, color, pigmentAlpha, seed);
        if (active) {
          context.globalAlpha = .22 * localInk * (1 - localPixel);
          context.fillStyle = color;
          context.beginPath();
          context.arc(point.x, point.y, 9 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawGuitarScore(pose, view, alpha, artProgress, pixelProgress) {
    if (alpha <= .01) return;
    for (const point of guitarPoints(pose, view)) {
      const localInk = smooth(artProgress * 1.35 - point.u * .4 + .04);
      const localPixel = smooth(pixelProgress * 1.5 - point.u * .4 + .04);
      const noteAlpha = alpha * (1 - localPixel);
      if (localPixel > .02) {
        const size = 5;
        context.globalAlpha = alpha * localPixel;
        context.fillStyle = STAFF_COLORS.ink;
        context.fillRect(Math.round(point.x / size) * size, Math.round(point.y / size) * size, size, size);
      }
      if (localInk > .02 && localPixel < .99) {
        drawPigmentHead(point, STAFF_COLORS.ink, noteAlpha * localInk * .65, `guitar-${point.note.id}`);
      }
      context.globalAlpha = noteAlpha * (1 - localInk) * .72;
      context.fillStyle = STAFF_COLORS.ink;
      context.beginPath();
      context.ellipse(point.x, point.y, 4.4, 3.2, -.2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawCodeBranches(pose, weight, view) {
    if (weight <= .02) return;
    const points = notePoints(1, pose, view).concat(notePoints(2, pose, view)).sort((a, b) => a.u - b.u);
    context.globalAlpha = weight * .32;
    context.strokeStyle = "#68a4ff";
    context.lineWidth = 1;
    for (const point of points) {
      const y = point.y - pose.spacing * 2.4;
      const direction = Math.round(point.note.beat * 3) % 2 ? 1 : -1;
      const elbowX = point.x + direction * 13;
      context.beginPath();
      context.moveTo(point.x, point.y - 3);
      context.lineTo(point.x, y);
      context.lineTo(elbowX, y);
      context.stroke();
      context.fillStyle = "#80bbff";
      context.beginPath();
      context.arc(elbowX, y, 1.7, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPixelStaff(pose, weight) {
    if (weight <= .02) return;
    const pixel = 6;
    for (let line = -2; line <= 2; line += 1) {
      context.beginPath();
      for (let index = 0; index <= 90; index += 1) {
        const u = index / 90;
        const point = centerPoint(u, pose);
        const x = Math.round(point.x / pixel) * pixel;
        const y = Math.round((point.y + line * pose.spacing) / pixel) * pixel;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.globalAlpha = weight * .42;
      context.strokeStyle = "#6876bf";
      context.lineWidth = pixel;
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawEngravedMusic(frame, beat, weight, view) {
    if (weight <= .005) return;
    drawScoreRibbon(engravedContext, width, height, scoreRibbonTimeline, {
      progress: 1,
      foldProgress: 1,
      viewStart: view.startX,
      viewEnd: view.endX,
      playbackBeat: frame.playing ? beat : null,
      playbackX: scorePositionAtBeat(beat),
      depthAware: false,
      verticalOffset: height * .15,
    });
    context.save();
    context.globalAlpha = weight;
    context.drawImage(engravedCanvas, 0, 0, width, height);
    context.restore();
  }

  function draw(frame = state) {
    context.clearRect(0, 0, width, height);
    const journey = frame.journey;
    const pose = poseAt(journey, frame.motionReduced);
    const weights = materialWeights(journey);
    const beat = frame.playing ? frame.beat : PREVIEW_BEAT;
    const view = scoreViewAtBeat(beat);
    const artProgress = smooth(clamp(journey - 2));
    const pixelProgress = smooth(clamp(journey - 3));
    const scoreWeight = frame.motionReduced
      ? Number(Math.round(journey) === 2)
      : smooth(clamp((journey - 1.12) / .62)) * (1 - smooth(clamp((journey - 2.08) / .56)));

    const haze = context.createLinearGradient(0, height * .25, width, height * .82);
    haze.addColorStop(0, `rgba(91, 54, 137, ${.035 + weights.art * .045})`);
    haze.addColorStop(.58, "rgba(53, 76, 151, .035)");
    haze.addColorStop(1, "rgba(21, 72, 129, .045)");
    context.fillStyle = haze;
    context.fillRect(0, 0, width, height);

    if (weights.games > .02) drawPixelStaff(pose, weights.games);
    else drawStaff(pose, weights, 1 - scoreWeight);
    context.globalAlpha = 1 - scoreWeight;
    drawClef(pose, journey, weights.games);
    context.globalAlpha = 1;

    drawGuitarScore(pose, view, (.25 + weights.music * .17) * (1 - scoreWeight), artProgress, pixelProgress);
    drawCodeBranches(pose, weights.code * (1 - weights.music), view);
    drawNotes(1, beat, pose, STAFF_COLORS.blue, .76 * (1 - scoreWeight), view, { voice: true, artProgress, pixelProgress });
    drawNotes(2, beat, pose, STAFF_COLORS.violet, .76 * (1 - scoreWeight), view, { voice: true, artProgress, pixelProgress });

    if (frame.playing && weights.music > .32 && !frame.motionReduced) {
      const cursor = centerPoint(.5, pose);
      context.globalAlpha = .36 * (1 - scoreWeight);
      context.strokeStyle = "#e5d6ff";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cursor.x, cursor.y - pose.spacing * 3.5);
      context.lineTo(cursor.x, cursor.y + pose.spacing * 3.5);
      context.stroke();
    }
    context.globalAlpha = 1;
    drawEngravedMusic(frame, beat, scoreWeight, view);
  }

  function update(nextState) {
    Object.assign(state, nextState);
    if (!state.paused) draw();
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); });
  });
  resizeObserver.observe(canvas);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  return {
    update,
    dispose() {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(resizeFrame);
      context.clearRect(0, 0, width, height);
    },
  };
}
