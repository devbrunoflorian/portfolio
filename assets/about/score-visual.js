import { guitarScoreTies } from "./guitar-score-ties.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PREVIEW_BEAT = 134;
const WRITTEN_OCTAVE_OFFSET = 12;
const HEADER_SOURCE_WIDTH = 150;
const MEASURE_WIDTH = 320;
const HEIGHT = 360;
// The guitar-score header SVG places the treble staff at y=176.5–272.5.
// Keep the melody contours on that same five-line staff instead of a second lane above it.
const STAFF_TOP = 176;
const STAFF_LINE_GAP = 24;
const STAFF_BOTTOM = STAFF_TOP + STAFF_LINE_GAP * 4;
const PIXELS_PER_BEAT = 80;
const NATURAL_DIATONIC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const REST_GAP_TOLERANCE = 0.55;
const pendingSvgLoads = new Map();
const scoreMetadataCache = new WeakMap();
let nextSceneId = 1;
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function layerFor(note, tracksById) {
  const track = tracksById.get(note.track);
  if (track?.voice !== "vocal") return null;
  return /II$/.test(track.name) ? "melodyTwo" : "melodyOne";
}

function lowerBound(notes, beat) {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (notes[middle].beat < beat) low = middle + 1;
    else high = middle;
  }
  return low;
}

function scoreMetadata(score) {
  let metadata = scoreMetadataCache.get(score);
  if (metadata) return metadata;
  const tracksById = new Map(score.tracks.map(track => [track.id, track]));
  const firstVoiceBeat = new Map();
  let maxDuration = 0;
  for (const note of score.notes) {
    const layer = layerFor(note, tracksById);
    if (layer && !firstVoiceBeat.has(layer)) firstVoiceBeat.set(layer, note.beat);
    maxDuration = Math.max(maxDuration, note.duration);
  }
  metadata = { tracksById, firstVoiceBeat, maxDuration };
  scoreMetadataCache.set(score, metadata);
  return metadata;
}

function voiceNotesInLayers(score, centerBeat, windowBeats) {
  const totalBeats = score.bars * score.beatsPerBar;
  const left = Math.max(0, centerBeat - windowBeats / 2);
  const right = Math.min(totalBeats, centerBeat + windowBeats / 2);
  const { tracksById, firstVoiceBeat, maxDuration } = scoreMetadata(score);
  const earliest = Math.max(0, left - maxDuration);
  const startIndex = lowerBound(score.notes, earliest);
  const visible = [];
  for (let index = startIndex; index < score.notes.length; index += 1) {
    const note = score.notes[index];
    if (note.beat > right) break;
    if (note.beat + note.duration < left) continue;
    const layer = layerFor(note, tracksById);
    if (!layer || centerBeat < firstVoiceBeat.get(layer)) continue;
    visible.push({ ...note, layer });
  }
  return visible;
}

// Only the two melodic tracks become colored contours; every visible event is retained.
export function scoreNotesInWindow(score, centerBeat, windowBeats = 12) {
  return voiceNotesInLayers(score, centerBeat, windowBeats);
}

export function contourPoints(notes) {
  const groups = new Map();
  for (const note of notes) {
    const key = note.beat.toFixed(4);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  return [...groups.values()].map(group => ({
    beat: group[0].beat,
    midi: Math.max(...group.map(note => note.midi)),
    duration: Math.max(...group.map(note => note.duration)),
  })).sort((a, b) => a.beat - b.beat);
}

export function staffYForMidi(midi, bottomLineY = STAFF_BOTTOM, halfStepY = STAFF_LINE_GAP / 2) {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + NATURAL_DIATONIC_STEP[pitchClass];
  const e4 = 4 * 7 + 2;
  return bottomLineY - (diatonic - e4) * halfStepY;
}

export function contourYForMidi(midi, geometry) {
  return staffYForMidi(midi + WRITTEN_OCTAVE_OFFSET, geometry.staffBottomY, geometry.halfStepY);
}

function xForBeat(beat, centerBeat, geometry) {
  return geometry.cursorX + (beat - centerBeat) * geometry.pixelsPerBeat;
}

export function contourPathForNotes(notes, centerBeat, geometry) {
  const points = contourPoints(notes);
  if (!points.length) return "";

  const segments = [];
  let segment = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (next.beat - (previous.beat + previous.duration) > REST_GAP_TOLERANCE) {
      segments.push(segment);
      segment = [next];
    } else {
      segment.push(next);
    }
  }
  segments.push(segment);

  return segments.map(segmentPoints => {
    const first = segmentPoints[0];
    const firstY = contourYForMidi(first.midi, geometry);
    let path = `M ${xForBeat(first.beat, centerBeat, geometry).toFixed(1)} ${firstY.toFixed(1)}`;
    for (let index = 0; index < segmentPoints.length - 1; index += 1) {
      const current = segmentPoints[index];
      const next = segmentPoints[index + 1];
      const gapBeats = next.beat - current.beat;
      const noteEnd = Math.min(current.beat + current.duration, next.beat);
      const glideBeats = Math.min(.62, gapBeats * .58);
      const glideStart = Math.max(current.beat, Math.min(noteEnd, next.beat - glideBeats));
      const currentY = contourYForMidi(current.midi, geometry);
      const nextY = contourYForMidi(next.midi, geometry);
      const glideX = xForBeat(glideStart, centerBeat, geometry);
      const nextX = xForBeat(next.beat, centerBeat, geometry);
      if (glideStart > current.beat) path += ` L ${glideX.toFixed(1)} ${currentY.toFixed(1)}`;
      if (nextX - glideX <= .01) {
        path += ` L ${nextX.toFixed(1)} ${nextY.toFixed(1)}`;
        continue;
      }
      const reach = Math.max(1, (nextX - glideX) * .42);
      path += ` C ${(glideX + reach).toFixed(1)} ${currentY.toFixed(1)} ${(nextX - reach).toFixed(1)} ${nextY.toFixed(1)} ${nextX.toFixed(1)} ${nextY.toFixed(1)}`;
    }

    const last = segmentPoints.at(-1);
    const lastEnd = last.beat + last.duration;
    if (lastEnd > last.beat) {
      path += ` L ${xForBeat(lastEnd, centerBeat, geometry).toFixed(1)} ${contourYForMidi(last.midi, geometry).toFixed(1)}`;
    }
    return path;
  }).join(" ");
}

function geometryFor(host) {
  const mobile = window.innerWidth <= 700;
  const headerWidth = mobile ? 120 : HEADER_SOURCE_WIDTH;
  const width = mobile ? 440 : 1110;
  return {
    mobile,
    viewBox: `0 0 ${width} ${HEIGHT}`,
    width,
    height: HEIGHT,
    headerWidth,
    cursorX: headerWidth + (width - headerWidth) / 2,
    cursorY1: STAFF_TOP - 44,
    cursorY2: STAFF_BOTTOM + 94,
    pixelsPerBeat: PIXELS_PER_BEAT,
    windowBeats: (width - headerWidth) / PIXELS_PER_BEAT,
    staffBottomY: STAFF_BOTTOM,
    halfStepY: STAFF_LINE_GAP / 2,
  };
}

export function scoreStageOffsets(anchor, scale) {
  if (!anchor) return { x: 0, y: 0 };
  const geometry = geometryFor(anchor);
  const bounds = anchor.getBoundingClientRect();
  const fitScale = Math.min(window.innerWidth / geometry.width, window.innerHeight / geometry.height);
  const fitTop = (window.innerHeight - geometry.height * fitScale) / 2;
  const fitLeft = (window.innerWidth - geometry.width * fitScale) / 2;
  const staffCenterX = geometry.headerWidth + (geometry.width - geometry.headerWidth) / 2;
  const staffCenterY = (STAFF_TOP + STAFF_BOTTOM) / 2;
  const staffX = fitLeft + staffCenterX * fitScale;
  const staffY = fitTop + staffCenterY * fitScale;
  const transformedStaffX = window.innerWidth / 2 + (staffX - window.innerWidth / 2) * scale;
  const transformedStaffY = window.innerHeight / 2 + (staffY - window.innerHeight / 2) * scale;
  const targetX = bounds.left + bounds.width / 2;
  const targetY = bounds.top + bounds.height / 2;
  return {
    x: clamp(targetX - transformedStaffX, -window.innerWidth * .34, window.innerWidth * .34),
    y: clamp(targetY - transformedStaffY, -window.innerHeight * .28, window.innerHeight * .28),
  };
}

function svgElement(name, className = "") {
  const element = document.createElementNS(SVG_NS, name);
  if (className) element.setAttribute("class", className);
  return element;
}

function appendLine(parent, x1, y1, x2, y2, className) {
  const line = svgElement("line", className);
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  parent.append(line);
  return line;
}

function makeVoiceTrace(layer, parent) {
  const group = svgElement("g", `score-voice-trace-group score-voice-trace-group--${layer}`);
  const glow = svgElement("path", "score-voice-glow");
  const path = svgElement("path", "score-voice-trace");
  const held = svgElement("line", "score-voice-held");
  held.style.display = "none";
  const pulse = svgElement("circle", "score-voice-pulse");
  pulse.setAttribute("r", "12");
  pulse.style.display = "none";
  const current = svgElement("circle", "score-voice-current");
  current.setAttribute("r", "4.5");
  current.style.display = "none";
  group.append(glow, path, held, pulse, current);
  parent.append(group);
  return { group, glow, path, held, pulse, current, layer };
}

function paintVoiceTrace(trace, notes, centerBeat, geometry, live) {
  const path = contourPathForNotes(notes, centerBeat, geometry);
  trace.path.setAttribute("d", path);
  trace.glow.setAttribute("d", path);
  const activeNotes = live ? notes.filter(note => centerBeat >= note.beat && centerBeat < note.beat + note.duration) : [];
  const active = contourPoints(activeNotes).at(-1);
  if (!active) {
    trace.held.style.display = "none";
    trace.current.style.display = "none";
    trace.pulse.style.display = "none";
    return;
  }
  const x = xForBeat(active.beat, centerBeat, geometry);
  const y = contourYForMidi(active.midi, geometry);
  const elapsed = Math.max(0, centerBeat - active.beat);
  const attackEnergy = Math.exp(-elapsed * 5);
  trace.held.style.display = "";
  trace.held.setAttribute("x1", x.toFixed(1));
  trace.held.setAttribute("x2", xForBeat(Math.min(active.beat + active.duration, centerBeat + .55), centerBeat, geometry).toFixed(1));
  trace.held.setAttribute("y1", y.toFixed(1));
  trace.held.setAttribute("y2", y.toFixed(1));
  trace.current.style.display = "";
  trace.current.setAttribute("cx", String(geometry.cursorX));
  trace.current.setAttribute("cy", y.toFixed(1));
  trace.current.setAttribute("fill-opacity", String(.56 + attackEnergy * .44));
  trace.pulse.style.display = "";
  trace.pulse.setAttribute("cx", String(geometry.cursorX));
  trace.pulse.setAttribute("cy", y.toFixed(1));
  trace.pulse.setAttribute("stroke-opacity", String(.15 + attackEnergy * .58));
}

function appendScoreHeader(scene, geometry) {
  const header = svgElement("use", "score-staff-header");
  header.setAttribute("href", `#${scene.headerId}`);
  header.setAttribute("x", "0");
  header.setAttribute("y", "0");
  header.setAttribute("width", String(geometry.headerWidth));
  header.setAttribute("height", String(HEIGHT));
  scene.staff.append(header);
}

function appendStaff(scene, geometry) {
  for (let line = 0; line < 5; line += 1) {
    const y = STAFF_TOP + line * STAFF_LINE_GAP;
    appendLine(scene, geometry.headerWidth, y, geometry.width, y, "score-staff-line");
  }
}

function visibleBars(leftBeat, rightBeat, score) {
  const first = clamp(Math.floor(leftBeat / score.beatsPerBar) + 1, 1, score.bars);
  const last = clamp(Math.floor(Math.max(leftBeat, rightBeat - .001) / score.beatsPerBar) + 1, 1, score.bars);
  const bars = [];
  for (let number = first; number <= last; number += 1) bars.push(number);
  return bars;
}

function systemStartForBar(number) {
  return Math.floor((number - 1) / 3) * 3 + 1;
}

function systemPath(start) {
  return `/assets/about/guitar-score/system-${String(start).padStart(3, "0")}.svg`;
}

function loadSvgDocument(url) {
  if (!pendingSvgLoads.has(url)) {
    const request = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Score asset request failed: ${response.status}`);
      const source = await response.text();
      const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
      if (parsed.querySelector("parsererror")) throw new Error("Score asset is not valid SVG");
      return parsed;
    }).finally(() => pendingSvgLoads.delete(url));
    pendingSvgLoads.set(url, request);
  }
  return pendingSvgLoads.get(url);
}

function appendBarSymbol(scene, number, x) {
  const use = svgElement("use", "score-guitar-measure");
  use.setAttribute("href", `#${scene.measureId(number)}`);
  use.setAttribute("x", x.toFixed(2));
  use.setAttribute("y", "0");
  use.setAttribute("width", String(MEASURE_WIDTH));
  use.setAttribute("height", String(HEIGHT));
  scene.guitar.append(use);
  return use;
}

function makeScene(host, leadsHost) {
  const id = `score-scene-${nextSceneId++}`;
  const svg = svgElement("svg", "score-score-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const defs = svgElement("defs");
  const clipPath = svgElement("clipPath");
  clipPath.id = `${id}-clip`;
  clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
  const clipRect = svgElement("rect");
  clipPath.append(clipRect);
  defs.append(clipPath);
  svg.append(defs);
  host.append(svg);

  const leadsSvg = svgElement("svg", "score-score-svg score-leads-svg");
  leadsSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  leadsSvg.setAttribute("aria-hidden", "true");
  leadsSvg.setAttribute("focusable", "false");
  const leadsDefs = svgElement("defs");
  const leadsClip = svgElement("clipPath");
  leadsClip.id = `${id}-leads-clip`;
  leadsClip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const leadsClipRect = svgElement("rect");
  leadsClip.append(leadsClipRect);
  leadsDefs.append(leadsClip);
  leadsSvg.append(leadsDefs);
  leadsHost.append(leadsSvg);

  const staff = svgElement("g", "score-staff");
  svg.append(staff);
  const guitar = svgElement("g", "score-guitar-measures");
  guitar.setAttribute("clip-path", `url(#${clipPath.id})`);
  svg.append(guitar);
  const crossTies = svgElement("g", "score-guitar-ties");
  crossTies.setAttribute("clip-path", `url(#${clipPath.id})`);
  svg.append(crossTies);
  const barlines = svgElement("g", "score-measure-lines");
  barlines.setAttribute("clip-path", `url(#${clipPath.id})`);
  svg.append(barlines);
  const foreground = svgElement("g", "score-foreground-layer");
  foreground.setAttribute("clip-path", `url(#${leadsClip.id})`);
  leadsSvg.append(foreground);
  const playhead = appendLine(foreground, 0, 0, 0, 0, "score-playhead");
  playhead.style.display = "none";
  const traceLayer = svgElement("g", "score-voice-traces");
  traceLayer.setAttribute("clip-path", `url(#${leadsClip.id})`);
  const traces = [makeVoiceTrace("melodyOne", traceLayer), makeVoiceTrace("melodyTwo", traceLayer)];
  foreground.append(traceLayer);
  return {
    id, headerId: `${id}-header`, measureId: number => `${id}-bar-${String(number).padStart(3, "0")}`,
    host, leadsHost, svg, leadsSvg, defs, leadsClipRect,
    clipPath, clipRect, staff, guitar, crossTies, barlines, playhead, traces,
    geometry: null, bars: [], barMarks: new Map(), tiePaths: new Map(),
    systemDocs: new Map(), hasLiveFrame: false, playbackBeat: null, resourceVersion: 0, active: true,
  };
}

function updateBarMarks(scene, score, leftBeat, geometry) {
  scene.barlines.replaceChildren();
  scene.barMarks.clear();
  for (const number of scene.bars) {
    const group = svgElement("g", "score-measure-mark");
    const start = appendLine(group, 0, STAFF_TOP, 0, STAFF_BOTTOM, "score-barline");
    const end = appendLine(group, 0, STAFF_TOP, 0, STAFF_BOTTOM, "score-barline");
    let label = null;
    if ((number - 1) % 3 === 0) {
      label = svgElement("text", "score-measure-number");
      label.setAttribute("y", String(STAFF_TOP - 12));
      label.textContent = String(number);
      group.append(label);
    }
    scene.barlines.append(group);
    scene.barMarks.set(number, { group, start, end, label });
  }
  positionBarMarks(scene, score, leftBeat, geometry);
}

function positionBarMarks(scene, score, leftBeat, geometry) {
  for (const number of scene.bars) {
    const mark = scene.barMarks.get(number);
    if (!mark) continue;
    const x = geometry.headerWidth + ((number - 1) * score.beatsPerBar - leftBeat) * geometry.pixelsPerBeat;
    for (const line of [mark.start, mark.end]) {
      const lineX = line === mark.start ? x : x + MEASURE_WIDTH;
      line.setAttribute("x1", lineX.toFixed(1));
      line.setAttribute("x2", lineX.toFixed(1));
    }
    if (mark.label) mark.label.setAttribute("x", (x + 6).toFixed(1));
  }
}

function updateCrossTies(scene, leftBeat, rightBeat, geometry) {
  const activeIds = new Set();
  guitarScoreTies.forEach((tie, index) => {
    if (tie.fromBeat < leftBeat - 1 || tie.toBeat > rightBeat + 1) return;
    const id = String(index);
    activeIds.add(id);
    let arc = scene.tiePaths.get(id);
    if (!arc) {
      arc = svgElement("path", "score-cross-bar-tie");
      scene.tiePaths.set(id, arc);
      scene.crossTies.append(arc);
    }
    const x1 = geometry.headerWidth + (tie.fromBeat - leftBeat) * geometry.pixelsPerBeat;
    const x2 = geometry.headerWidth + (tie.toBeat - leftBeat) * geometry.pixelsPerBeat;
    const y = staffYForMidi(tie.midi + WRITTEN_OCTAVE_OFFSET, geometry.staffBottomY, geometry.halfStepY);
    arc.setAttribute("d", `M ${x1.toFixed(1)} ${(y + 2).toFixed(1)} C ${(x1 + 14).toFixed(1)} ${(y + 15).toFixed(1)} ${(x2 - 14).toFixed(1)} ${(y + 15).toFixed(1)} ${x2.toFixed(1)} ${(y + 2).toFixed(1)}`);
  });
  for (const [id, arc] of scene.tiePaths) {
    if (activeIds.has(id)) continue;
    arc.remove();
    scene.tiePaths.delete(id);
  }
}

function currentSystems(bars, score) {
  const starts = new Set(bars.map(systemStartForBar));
  const last = bars.at(-1) ?? 1;
  if (last < score.bars) starts.add(systemStartForBar(last + 1));
  return [...starts];
}

async function loadSceneResources(scene, score, onReady, version) {
  const systems = currentSystems(scene.bars, score);
  const keep = new Set(systems);
  for (const start of [...scene.systemDocs.keys()]) {
    if (!keep.has(start)) scene.systemDocs.delete(start);
  }
  try {
    const newStarts = systems.filter(start => !scene.systemDocs.has(start));
    const [headerDoc, ...systemDocs] = await Promise.all([
      scene.headerSymbol ? Promise.resolve(null) : loadSvgDocument("/assets/about/guitar-score/notation-header.svg"),
      ...newStarts.map(start => loadSvgDocument(systemPath(start))),
    ]);
    if (!scene.active || version !== scene.resourceVersion) return;
    const headerSource = scene.headerSymbol ?? headerDoc?.getElementById("score-header");
    if (!headerSource) throw new Error("Score header symbol is missing");
    if (!scene.headerSymbol) scene.headerSymbol = namespaceSvgIds(document.importNode(headerSource, true), scene.headerId);
    newStarts.forEach((start, index) => {
      if (keep.has(start)) scene.systemDocs.set(start, systemDocs[index]);
    });
    for (const start of [...scene.systemDocs.keys()]) {
      if (!keep.has(start)) scene.systemDocs.delete(start);
    }
    const symbols = scene.bars.map(number => {
      const start = systemStartForBar(number);
      const source = scene.systemDocs.get(start)?.getElementById(`bar-${String(number).padStart(3, "0")}`);
      if (!source) throw new Error(`Score measure ${number} is missing`);
      return namespaceSvgIds(document.importNode(source, true), scene.measureId(number));
    });
    scene.defs.replaceChildren(scene.clipPath, scene.headerSymbol, ...symbols);
    scene.host.dataset.scoreReady = "true";
    onReady();
  } catch (error) {
    if (!scene.active || version !== scene.resourceVersion) return;
    scene.host.dataset.scoreReady = "false";
    console.warn("The musical score could not be rendered; keeping the static score preview.", error);
  }
}

function namespaceSvgIds(root, rootId) {
  const replacements = new Map();
  for (const element of [root, ...root.querySelectorAll("[id]")]) {
    if (!element.id) continue;
    const previous = element.id;
    const next = element === root ? rootId : `${rootId}-${previous}`;
    replacements.set(previous, next);
    element.id = next;
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      let value = attribute.value;
      for (const [previous, next] of replacements) {
        value = value.replaceAll(`url(#${previous})`, `url(#${next})`);
        if (value === `#${previous}`) value = `#${next}`;
      }
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    }
  }
  return root;
}

function renderMeasures(scene, score, leftBeat, rightBeat, geometry, onReady) {
  scene.guitar.replaceChildren();
  scene.bars.forEach(number => {
    const x = geometry.headerWidth + ((number - 1) * score.beatsPerBar - leftBeat) * geometry.pixelsPerBeat;
    appendBarSymbol(scene, number, x);
  });
  updateBarMarks(scene, score, leftBeat, geometry);
  updateCrossTies(scene, leftBeat, rightBeat, geometry);
  scene.host.dataset.scoreReady = "false";
  scene.resourceVersion += 1;
  loadSceneResources(scene, score, onReady, scene.resourceVersion);
}

function updateScene(scene, score, centerBeat, scrollBeat, motionEnabled, reducedMotion, playbackSnapshot, onReady) {
  const hasPlayback = !reducedMotion && ["playing", "paused", "finished"].includes(playbackSnapshot?.state);
  if (!motionEnabled && scene.hasLiveFrame && !reducedMotion) {
    return { beat: scene.playbackBeat, bars: scene.bars, live: true, frozen: true };
  }
  const live = hasPlayback && motionEnabled;
  const geometry = geometryFor(scene.host);
  const geometryChanged = !scene.geometry || scene.geometry.viewBox !== geometry.viewBox;
  if (geometryChanged) {
    scene.geometry = geometry;
    scene.svg.setAttribute("viewBox", geometry.viewBox);
    scene.leadsSvg.setAttribute("viewBox", geometry.viewBox);
    scene.clipRect.setAttribute("x", String(geometry.headerWidth));
    scene.clipRect.setAttribute("y", "0");
    scene.clipRect.setAttribute("width", String(geometry.width - geometry.headerWidth));
    scene.clipRect.setAttribute("height", String(HEIGHT));
    scene.leadsClipRect.setAttribute("x", String(geometry.headerWidth));
    scene.leadsClipRect.setAttribute("y", "0");
    scene.leadsClipRect.setAttribute("width", String(geometry.width - geometry.headerWidth));
    scene.leadsClipRect.setAttribute("height", String(HEIGHT));
    scene.staff.replaceChildren();
    appendStaff(scene.staff, geometry);
    appendScoreHeader(scene, geometry);
    scene.playhead.setAttribute("x1", String(geometry.cursorX));
    scene.playhead.setAttribute("x2", String(geometry.cursorX));
    scene.playhead.setAttribute("y1", String(geometry.cursorY1));
    scene.playhead.setAttribute("y2", String(geometry.cursorY2));
  }
  const visualBeat = hasPlayback
    ? clamp(centerBeat, 0, score.bars * score.beatsPerBar)
    : clamp(scrollBeat ?? PREVIEW_BEAT, 0, score.bars * score.beatsPerBar);
  const leftBeat = visualBeat - (geometry.cursorX - geometry.headerWidth) / geometry.pixelsPerBeat;
  const rightBeat = leftBeat + geometry.windowBeats;
  const bars = visibleBars(leftBeat, rightBeat, score);
  const barsChanged = geometryChanged || bars.length !== scene.bars.length || bars.some((bar, index) => bar !== scene.bars[index]);
  if (barsChanged) {
    scene.bars = bars;
    renderMeasures(scene, score, leftBeat, rightBeat, geometry, onReady);
  } else {
    scene.guitar.querySelectorAll("use").forEach((use, index) => {
      const number = bars[index];
      const x = geometry.headerWidth + ((number - 1) * score.beatsPerBar - leftBeat) * geometry.pixelsPerBeat;
      use.setAttribute("x", x.toFixed(2));
    });
    positionBarMarks(scene, score, leftBeat, geometry);
    updateCrossTies(scene, leftBeat, rightBeat, geometry);
  }
  const notes = scoreNotesInWindow(score, visualBeat, geometry.windowBeats);
  for (const trace of scene.traces) {
    paintVoiceTrace(trace, notes.filter(note => note.layer === trace.layer), visualBeat, geometry, live);
  }
  scene.playhead.style.display = live ? "" : "none";
  scene.svg.dataset.playback = live ? playbackSnapshot.state : "preview";
  scene.leadsSvg.dataset.playback = live ? playbackSnapshot.state : "preview";
  scene.hasLiveFrame = live && motionEnabled;
  scene.playbackBeat = visualBeat;
  return { beat: visualBeat, bars, live, frozen: false };
}

export function createScoreVisual(root, score, onReady = () => {}) {
  const hosts = [...root.querySelectorAll("[data-score-scene]")];
  const globalLeadsHost = root.querySelector("[data-score-leads-global]");
  const scenes = hosts.map(host => {
    const leadsHost = host.querySelector("[data-score-leads]") ?? globalLeadsHost;
    return makeScene(host, leadsHost);
  });

  function update({ chapter = "music", scrollBeat = PREVIEW_BEAT, motionEnabled = true, reducedMotion = false, playbackSnapshot = null } = {}) {
    const beat = ["playing", "paused", "finished"].includes(playbackSnapshot?.state)
      ? playbackSnapshot.beat : PREVIEW_BEAT;
    let result = null;
    for (const scene of scenes) {
      const isThread = scene.host.dataset.scoreScene === "thread";
      if (!isThread && chapter !== scene.host.dataset.scoreScene) continue;
      if (!isThread) {
        const bounds = scene.host.closest("section")?.getBoundingClientRect();
        if (!bounds || bounds.bottom < 0 || bounds.top > innerHeight) continue;
      }
      result = updateScene(scene, score, beat, scrollBeat, motionEnabled, reducedMotion, playbackSnapshot, onReady);
    }
    return result;
  }

  return {
    update,
    dispose() {
      scenes.forEach(scene => {
        scene.active = false;
        scene.host.querySelector(".score-score-svg")?.remove();
        scene.leadsHost?.querySelector(".score-leads-svg")?.remove();
        delete scene.host.dataset.scoreReady;
      });
    },
  };
}
