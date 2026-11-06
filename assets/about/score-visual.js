const SVG_NS = "http://www.w3.org/2000/svg";
const WINDOW_BEATS = 16;
const PREVIEW_BEAT = 116;
const MAX_NOTE_DURATION = 16;
const VOICE_LIMITS = { melodyOne: 36, melodyTwo: 36 };
const WRITTEN_OCTAVE_OFFSET = 12;
const STAFF = { bottomLineY: 151, halfStepY: 5.25 };
const NATURAL_DIATONIC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function layerFor(note, tracksById) {
  const track = tracksById.get(note.track);
  if (track?.voice !== "vocal") return null;
  return /II$/.test(track.name) ? "melodyTwo" : "melodyOne";
}

function lowerBound(notes, beat) {
  let low = 0, high = notes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (notes[middle].beat < beat) low = middle + 1;
    else high = middle;
  }
  return low;
}

function sampleNotes(notes, limit, centerBeat) {
  if (notes.length <= limit) return notes;
  const selected = new Set();
  for (let index = 0; index < limit; index += 1) {
    selected.add(notes[Math.round(index * (notes.length - 1) / (limit - 1))]);
  }
  notes.filter(note => note.beat <= centerBeat && note.beat + note.duration > centerBeat)
    .slice(-4).forEach(note => selected.add(note));
  return [...selected].sort((a, b) => a.beat - b.beat || a.midi - b.midi).slice(0, limit + 4);
}

function voiceNotesInLayers(score, centerBeat, windowBeats) {
  const totalBeats = score.bars * score.beatsPerBar;
  const left = centerBeat - windowBeats / 2;
  const right = Math.min(totalBeats, centerBeat + windowBeats / 2);
  const tracksById = new Map(score.tracks.map(track => [track.id, track]));
  const byLayer = { melodyOne: [], melodyTwo: [] };
  const startIndex = lowerBound(score.notes, Math.max(0, left - MAX_NOTE_DURATION));
  for (let index = startIndex; index < score.notes.length; index += 1) {
    const note = score.notes[index];
    if (note.beat > right) break;
    if (note.beat + note.duration < left) continue;
    const layer = layerFor(note, tracksById);
    if (layer) byLayer[layer].push({ ...note, layer });
  }
  return Object.entries(VOICE_LIMITS).flatMap(([layer, limit]) => sampleNotes(byLayer[layer], limit, centerBeat));
}

// Only Melody I and II become moving traces. Guitar I stays as a real, static
// score fragment behind them; simultaneous pitches collapse to one visual line.
export function scoreNotesInWindow(score, centerBeat, windowBeats = WINDOW_BEATS) {
  return voiceNotesInLayers(score, centerBeat, windowBeats);
}

export function contourPoints(notes) {
  const groups = new Map();
  for (const note of notes) {
    const key = note.beat.toFixed(4);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  return [...groups.values()].map(group => {
    const pitches = group.map(note => note.midi).sort((a, b) => a - b);
    return {
      beat: group[0].beat,
      midi: pitches[Math.floor(pitches.length / 2)],
      duration: Math.max(...group.map(note => note.duration)),
    };
  }).sort((a, b) => a.beat - b.beat);
}

export function staffYForMidi(midi, bottomLineY = STAFF.bottomLineY, halfStepY = STAFF.halfStepY) {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + NATURAL_DIATONIC_STEP[pitchClass];
  const e4 = 4 * 7 + 2;
  return bottomLineY - (diatonic - e4) * halfStepY;
}

export function contourYForMidi(midi, geometry) {
  // The supplied MIDI pitches are an octave below the written vocal staff.
  return staffYForMidi(midi + WRITTEN_OCTAVE_OFFSET, geometry.staffBottomY, geometry.halfStepY);
}

function xForBeat(beat, centerBeat, geometry) {
  return geometry.cursorX + (beat - centerBeat) * geometry.pixelsPerBeat;
}

export function contourPathForNotes(notes, centerBeat, geometry) {
  const points = contourPoints(notes);
  if (!points.length) return "";

  const first = points[0];
  const firstY = contourYForMidi(first.midi, geometry);
  let path = `M ${xForBeat(first.beat, centerBeat, geometry).toFixed(1)} ${firstY.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const gapBeats = next.beat - current.beat;
    const noteEnd = Math.min(current.beat + current.duration, next.beat);
    const glideBeats = Math.min(.62, gapBeats * .58);
    const glideStart = Math.max(current.beat, Math.min(noteEnd, next.beat - glideBeats));
    const currentY = contourYForMidi(current.midi, geometry);
    const nextY = contourYForMidi(next.midi, geometry);
    const glideX = xForBeat(glideStart, centerBeat, geometry);
    const nextX = xForBeat(next.beat, centerBeat, geometry);
    if (glideStart > current.beat) path += ` L ${glideX.toFixed(1)} ${currentY.toFixed(1)}`;
    const reach = Math.max(1, (nextX - glideX) * .42);
    path += ` C ${(glideX + reach).toFixed(1)} ${currentY.toFixed(1)} ${(nextX - reach).toFixed(1)} ${nextY.toFixed(1)} ${nextX.toFixed(1)} ${nextY.toFixed(1)}`;
  }

  const last = points.at(-1);
  const lastEnd = last.beat + last.duration;
  if (lastEnd > last.beat) {
    path += ` L ${xForBeat(lastEnd, centerBeat, geometry).toFixed(1)} ${contourYForMidi(last.midi, geometry).toFixed(1)}`;
  }
  return path;
}

function geometryFor(host) {
  const mobile = host.getBoundingClientRect().width <= 700;
  return mobile
    ? { mobile, viewBox: "0 0 520 270", cursorX: 260, pixelsPerBeat: 45, windowBeats: 8, titleX: 116, meterX: 374, scoreX: 15, scoreY: 96, scoreWidth: 490, scoreHeight: 77, staffBottomY: 136, halfStepY: 2.75 }
    : { mobile, viewBox: "0 0 1000 270", cursorX: 500, pixelsPerBeat: 46, windowBeats: WINDOW_BEATS, titleX: 80, meterX: 835, scoreX: 32, scoreY: 75, scoreWidth: 936, scoreHeight: 145, staffBottomY: 151, halfStepY: 5.25 };
}

function svgElement(name, className = "") {
  const element = document.createElementNS(SVG_NS, name);
  if (className) element.setAttribute("class", className);
  return element;
}

function addText(svg, text, x, y, className) {
  const element = svgElement("text", className);
  element.setAttribute("x", String(x));
  element.setAttribute("y", String(y));
  element.textContent = text;
  svg.append(element);
  return element;
}

function makeVoiceTrace(layer, parent) {
  const group = svgElement("g", `score-voice-trace-group score-voice-trace-group--${layer}`);
  const path = svgElement("path", "score-voice-trace");
  const held = svgElement("line", "score-voice-held");
  held.style.display = "none";
  const current = svgElement("circle", "score-voice-current");
  current.setAttribute("r", "5.2");
  current.style.display = "none";
  group.append(path, held, current);
  parent.append(group);
  return { group, path, held, current, layer };
}

function paintVoiceTrace(trace, notes, centerBeat, geometry, live) {
  trace.path.setAttribute("d", contourPathForNotes(notes, centerBeat, geometry));
  const activeNotes = live ? notes.filter(note => centerBeat >= note.beat && centerBeat < note.beat + note.duration) : [];
  const active = contourPoints(activeNotes).at(-1);
  if (!active) {
    trace.held.style.display = "none";
    trace.current.style.display = "none";
    return;
  }

  const x1 = xForBeat(active.beat, centerBeat, geometry);
  const x2 = xForBeat(active.beat + active.duration, centerBeat, geometry);
  const y = contourYForMidi(active.midi, geometry);
  trace.held.style.display = "";
  trace.held.setAttribute("x1", x1.toFixed(1));
  trace.held.setAttribute("x2", x2.toFixed(1));
  trace.held.setAttribute("y1", y.toFixed(1));
  trace.held.setAttribute("y2", y.toFixed(1));
  trace.current.style.display = "";
  trace.current.setAttribute("cx", String(geometry.cursorX));
  trace.current.setAttribute("cy", y.toFixed(1));
}

function createScene(host, geometry) {
  const svg = svgElement("svg", "score-score-svg");
  svg.setAttribute("viewBox", geometry.viewBox);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  addText(svg, "D I S S O N Â N C I A", geometry.titleX, 29, "score-watermark-title");
  addText(svg, "106 BARS · 4/4", geometry.meterX, 29, "score-meter-label");
  const guitarScore = svgElement("image", "score-guitar-watermark");
  guitarScore.setAttribute("href", "/assets/about/guitar-score-watermark.png");
  guitarScore.setAttribute("preserveAspectRatio", "none");
  guitarScore.setAttribute("x", String(geometry.scoreX));
  guitarScore.setAttribute("y", String(geometry.scoreY));
  guitarScore.setAttribute("width", String(geometry.scoreWidth));
  guitarScore.setAttribute("height", String(geometry.scoreHeight));
  svg.append(guitarScore);

  const playhead = svgElement("line", "score-playhead");
  playhead.setAttribute("x1", String(geometry.cursorX));
  playhead.setAttribute("x2", String(geometry.cursorX));
  playhead.setAttribute("y1", "67");
  playhead.setAttribute("y2", "205");
  playhead.style.display = "none";
  svg.append(playhead);

  const traceLayer = svgElement("g", "score-voice-traces");
  const traces = Object.keys(VOICE_LIMITS).map(layer => makeVoiceTrace(layer, traceLayer));
  svg.append(traceLayer);
  host.replaceChildren(svg);
  return { host, svg, playhead, guitarScore, traces, geometry, hasLiveFrame: false };
}

export function createScoreVisual(root, score) {
  const scenes = [...root.querySelectorAll('[data-score-scene="music"]')].map(host => createScene(host, geometryFor(host)));

  function update({ chapter = "music", motionEnabled = true, playbackSnapshot = null } = {}) {
    if (chapter !== "music") return;
    const live = ["playing", "paused", "finished"].includes(playbackSnapshot?.state);
    for (const scene of scenes) {
      if (!motionEnabled && scene.hasLiveFrame) continue;
      const nextGeometry = geometryFor(scene.host);
      if (nextGeometry.mobile !== scene.geometry.mobile) {
        scene.geometry = nextGeometry;
        scene.svg.setAttribute("viewBox", nextGeometry.viewBox);
        scene.playhead.setAttribute("x1", String(nextGeometry.cursorX));
        scene.playhead.setAttribute("x2", String(nextGeometry.cursorX));
        scene.guitarScore.setAttribute("x", String(nextGeometry.scoreX));
        scene.guitarScore.setAttribute("y", String(nextGeometry.scoreY));
        scene.guitarScore.setAttribute("width", String(nextGeometry.scoreWidth));
        scene.guitarScore.setAttribute("height", String(nextGeometry.scoreHeight));
        scene.svg.querySelector(".score-watermark-title")?.setAttribute("x", String(nextGeometry.titleX));
        scene.svg.querySelector(".score-meter-label")?.setAttribute("x", String(nextGeometry.meterX));
      }
      const centerBeat = live ? clamp(playbackSnapshot.beat, 0, score.bars * score.beatsPerBar) : PREVIEW_BEAT;
      const notes = scoreNotesInWindow(score, centerBeat, scene.geometry.windowBeats);
      scene.traces.forEach(trace => {
        const voiceNotes = notes.filter(note => note.layer === trace.layer);
        paintVoiceTrace(trace, voiceNotes, centerBeat, scene.geometry, live);
      });
      scene.playhead.style.display = live ? "" : "none";
      scene.svg.dataset.playback = live ? playbackSnapshot.state : "preview";
      scene.hasLiveFrame = live;
    }
  }

  update({ motionEnabled: true });
  return {
    update,
    dispose() { scenes.forEach(scene => scene.host.replaceChildren()); },
  };
}
