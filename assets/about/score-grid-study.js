import { scoreGridStudy } from "./score-grid-study-data.js";
import { score } from "./score.js?v=a1c14c40";
import { contourPathForNotes, contourPoints, contourYForMidi, scoreVoiceNotesInRange } from "./score-visual.js?v=score-grid-voices-1";

const SVG_NS = "http://www.w3.org/2000/svg";
const SYSTEM_GAP = 18;
const NOTEHEAD_CENTER_BIAS = 5.9;
const root = document.querySelector(".about-main");
const stage = root?.querySelector('.score-stage-spacer[data-score-anchor="music"]');
const excerptLabel = root?.querySelector("[data-score-excerpt]");
const voiceStudyMode = new URLSearchParams(window.location.search).get("score-grid-voices") === "1";
const pageController = new AbortController();
let resizeObserver;
let currentBarsPerSystem = 0;

document.body.dataset.scoreGridStudy = "true";

function addStudyStylesheet() {
  if (document.querySelector("link[data-score-grid-study-style]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./score-grid-study.css", import.meta.url);
  link.dataset.scoreGridStudyStyle = "";
  document.head.append(link);
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function stripIds(element) {
  element.removeAttribute("id");
  element.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
}

function tint(element, color) {
  element.setAttribute("fill", color);
  element.setAttribute("stroke", color);
  for (const node of element.querySelectorAll("*")) {
    const fill = node.getAttribute("fill");
    const stroke = node.getAttribute("stroke");
    if (fill && fill !== "none") node.setAttribute("fill", color);
    if (stroke && stroke !== "none") node.setAttribute("stroke", color);
  }
}

function writtenPitchY(midi) {
  const naturalStep = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + naturalStep[pitchClass];
  const e4 = 4 * 7 + 2;
  return scoreGridStudy.staffBottom - (diatonic - e4) * scoreGridStudy.staffLineGap / 2;
}

function systemStartForBar(barNumber) {
  return Math.floor((barNumber - 1) / 3) * 3 + 1;
}

function getSymbol(sourceDocument, id) {
  const symbol = sourceDocument.getElementById(id);
  if (!symbol) throw new Error(`Símbolo SVG ausente: ${id}`);
  return symbol;
}

function createHeader(sourceDocument) {
  const source = getSymbol(sourceDocument, "score-header");
  const header = svgElement("svg", {
    class: "score-grid-header",
    viewBox: `0 ${scoreGridStudy.cropTop} 150 ${scoreGridStudy.cropHeight}`,
    width: 150,
    height: scoreGridStudy.cropHeight,
    "aria-hidden": "true",
    focusable: "false",
  });
  const engraving = source.firstElementChild.cloneNode(true);
  stripIds(engraving);
  tint(engraving, "#a9a0b1");
  engraving.setAttribute("opacity", ".88");
  header.append(engraving);
  return header;
}

function createStaffLines() {
  const staff = document.createElement("div");
  staff.className = "score-grid-staff";
  staff.setAttribute("aria-hidden", "true");
  for (let line = 0; line < 5; line += 1) {
    const rule = document.createElement("i");
    rule.className = "score-grid-staff-line";
    rule.style.insetBlockStart = `${scoreGridStudy.staffTop - scoreGridStudy.cropTop + line * scoreGridStudy.staffLineGap}px`;
    staff.append(rule);
  }
  return staff;
}

function createBeatGuides() {
  const guides = document.createElement("div");
  guides.className = "score-grid-guides";
  guides.setAttribute("aria-hidden", "true");
  for (let beat = 1; beat < scoreGridStudy.beatsPerBar; beat += 1) {
    const line = document.createElement("i");
    line.className = "score-grid-beat-line";
    line.style.insetInlineStart = `${beat * scoreGridStudy.pixelsPerBeat}px`;
    guides.append(line);
  }
  return guides;
}

function getMeasureRoot(symbol) {
  return symbol.firstElementChild;
}

function createEngravingLayer(sourceMeasure, events, barNumber) {
  const layer = svgElement("svg", {
    class: "score-grid-engraving",
    viewBox: `0 ${scoreGridStudy.cropTop} ${scoreGridStudy.barWidth} ${scoreGridStudy.cropHeight}`,
    width: scoreGridStudy.barWidth,
    height: scoreGridStudy.cropHeight,
    "aria-hidden": "true",
    focusable: "false",
  });
  const engraving = getMeasureRoot(sourceMeasure).cloneNode(true);
  const eventGlyphs = [...engraving.querySelectorAll(".vf-stavenote")];
  if (eventGlyphs.length !== events.length) {
    throw new Error(`O compasso ${barNumber} tem ${events.length} eventos, mas a pauta tem ${eventGlyphs.length} glifos.`);
  }
  eventGlyphs.forEach((glyph, index) => {
    glyph.querySelectorAll("rect[opacity='0']").forEach(rect => rect.remove());
    if (!events[index].rest) glyph.remove();
    else {
      glyph.dataset.scoreEventId = `bar-${barNumber}-event-${String(index + 1).padStart(2, "0")}`;
      glyph.dataset.scoreEventType = "rest";
    }
  });
  engraving.querySelectorAll("rect[opacity='0']").forEach(rect => rect.remove());
  stripIds(engraving);
  tint(engraving, "#9f96a8");
  engraving.setAttribute("opacity", ".82");
  layer.append(engraving);
  return layer;
}

function centersFor(notehead) {
  const bounds = notehead.getBBox();
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function probeNoteBounds(sourceNotes, events, host, barNumber) {
  if (sourceNotes.length !== events.length) {
    throw new Error(`O compasso ${barNumber} tem ${events.length} eventos, mas a pauta tem ${sourceNotes.length} glifos.`);
  }
  const probe = svgElement("svg", {
    class: "score-grid-probe",
    viewBox: `0 0 ${scoreGridStudy.barWidth} 372`,
    width: scoreGridStudy.barWidth,
    height: 372,
    "aria-hidden": "true",
  });
  const clones = sourceNotes.map((sourceNote, index) => {
    const event = events[index];
    const sourceHeads = [...sourceNote.querySelectorAll(".vf-notehead")];
    if (event.rest) {
      if (event.notes.length) throw new Error(`O compasso ${barNumber} marca uma pausa com pitches.`);
      return null;
    }
    if (sourceHeads.length !== event.notes.length) {
      throw new Error(`O compasso ${barNumber}, evento ${index + 1}: ${event.notes.length} notas e ${sourceHeads.length} cabeças na pauta.`);
    }
    const clone = sourceNote.cloneNode(true);
    clone.querySelectorAll("rect[opacity='0']").forEach(rect => rect.remove());
    stripIds(clone);
    probe.append(clone);
    return clone;
  });
  host.append(probe);

  const templates = clones.map((note, index) => {
    if (!note) return null;
    const bounds = note.getBBox();
    if (!(bounds.width > 0 && bounds.height > 0)) throw new Error(`Glifo vazio no compasso ${barNumber}, evento ${index + 1}.`);
    const heads = [...note.querySelectorAll(".vf-notehead")]
      .map((element, domIndex) => ({ element, domIndex, ...centersFor(element) }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const expectedNotes = [...events[index].notes]
      .sort((a, b) => b.writtenMidi - a.writtenMidi || a.soundingMidi - b.soundingMidi);
    for (let headIndex = 0; headIndex < heads.length; headIndex += 1) {
      const error = heads[headIndex].y - writtenPitchY(expectedNotes[headIndex].writtenMidi);
      // Bravura's filled head outline has a bounding-box center about 0.5px above its musical anchor.
      if (Math.abs(error) > .75) {
        throw new Error(`Altura divergente no compasso ${barNumber}, evento ${index + 1}, cabeça ${headIndex + 1}: ${error.toFixed(2)}px.`);
      }
    }
    return { box: bounds, heads, headOrder: heads.map(head => head.domIndex), sourceNote: note };
  });
  probe.remove();
  return templates;
}

function createNoteIcon(template, event, bar, patternId, eventIndex) {
  const { box, heads, sourceNote } = template;
  const timeCell = scoreGridStudy.barWidth / (scoreGridStudy.beatsPerBar * scoreGridStudy.subdivisionsPerBeat);
  const gridX = event.beatTick * timeCell;
  const anchorHead = heads[0];
  const anchorNote = [...event.notes].sort((a, b) => b.writtenMidi - a.writtenMidi || a.soundingMidi - b.soundingMidi)[0];
  const pitchY = writtenPitchY(anchorNote.writtenMidi);
  const gridRow = Math.floor((pitchY - scoreGridStudy.cropTop) / 12) + 1;
  const gridRowY = (gridRow - 1) * 12;
  const padded = 1;
  const viewBoxX = box.x - padded;
  const viewBoxY = box.y - padded;
  const viewBox = `${viewBoxX} ${viewBoxY} ${box.width + padded * 2} ${box.height + padded * 2}`;
  const spanColumns = Math.max(1, Math.ceil((box.width + padded * 2) / timeCell));
  const spanRows = Math.max(1, Math.ceil((box.height + padded * 2) / 12));

  const icon = svgElement("svg", {
    class: "score-grid-note",
    viewBox,
    width: box.width + padded * 2,
    height: box.height + padded * 2,
    "aria-hidden": "true",
    focusable: "false",
  });
  const eventId = `bar-${bar.number}-event-${String(eventIndex + 1).padStart(2, "0")}`;
  icon.dataset.scoreEventId = eventId;
  icon.dataset.scoreEventType = "note";
  icon.dataset.beatTick = String(event.beatTick);
  icon.dataset.durationTicks = String(event.durationTicks);
  icon.dataset.patternNoteId = `${patternId}-event-${String(eventIndex + 1).padStart(2, "0")}`;
  icon.style.gridColumn = `${event.beatTick + 1} / span ${spanColumns}`;
  icon.style.gridRow = `${gridRow} / span ${spanRows}`;
  icon.style.setProperty("--note-width", `${box.width + padded * 2}px`);
  icon.style.setProperty("--note-height", `${box.height + padded * 2}px`);
  icon.style.setProperty("--note-offset-x", `${viewBoxX - gridX}px`);
  icon.style.setProperty("--note-offset-y", `${box.y - scoreGridStudy.cropTop - gridRowY - padded}px`);

  const glyph = sourceNote.cloneNode(true);
  stripIds(glyph);
  tint(glyph, "#cec5d7");
  const glyphHeadsInSourceOrder = [...glyph.querySelectorAll(".vf-notehead")];
  const glyphHeads = template.headOrder.map(index => glyphHeadsInSourceOrder[index]);
  const expectedNotes = [...event.notes]
    .sort((a, b) => b.writtenMidi - a.writtenMidi || a.soundingMidi - b.soundingMidi);
  glyphHeads.forEach((head, index) => {
    const noteId = `${eventId}-head-${String(index + 1).padStart(2, "0")}`;
    head.setAttribute("data-score-notehead-id", noteId);
    head.setAttribute("data-pattern-notehead-id", `${icon.dataset.patternNoteId}-head-${String(index + 1).padStart(2, "0")}`);
    head.setAttribute("data-written-midi", String(expectedNotes[index].writtenMidi));
    head.setAttribute("data-beat-tick", String(event.beatTick));
  });
  icon.append(glyph);

  icon.dataset.pitchCheck = "passed";
  icon.dataset.pitch = String(anchorNote.writtenMidi);
  icon.dataset.anchorX = anchorHead.x.toFixed(3);
  icon.dataset.anchorY = anchorHead.y.toFixed(3);
  return icon;
}

function createBar(sourceMeasure, bar, pattern, patternId, templates) {
  const measure = document.createElement("div");
  measure.className = "score-grid-bar";
  measure.dataset.barNumber = String(bar.number);
  measure.dataset.pattern = bar.pattern;
  measure.setAttribute("aria-hidden", "true");
  measure.style.gridTemplateRows = `repeat(${scoreGridStudy.cropHeight / 12}, 12px)`;
  measure.append(createStaffLines(), createBeatGuides(), createEngravingLayer(sourceMeasure, pattern.events, bar.number));

  const number = document.createElement("span");
  number.className = "score-grid-measure-number";
  number.textContent = String(bar.number);
  measure.append(number);

  pattern.events.forEach((event, index) => {
    if (event.rest) return;
    measure.append(createNoteIcon(templates[index], event, bar, patternId, index));
  });
  return measure;
}

function createVoiceOverlay(rowBars, rowWidth) {
  const firstBeat = (rowBars[0].number - 1) * scoreGridStudy.beatsPerBar;
  const rowBeats = rowBars.length * scoreGridStudy.beatsPerBar;
  const endBeat = firstBeat + rowBeats;
  const centerBeat = firstBeat + rowBeats / 2;
  const geometry = {
    cursorX: 150 + rowBeats / 2 * scoreGridStudy.pixelsPerBeat + NOTEHEAD_CENTER_BIAS,
    pixelsPerBeat: scoreGridStudy.pixelsPerBeat,
    staffBottomY: scoreGridStudy.staffBottom,
    halfStepY: scoreGridStudy.staffLineGap / 2,
  };
  const windowNotes = scoreVoiceNotesInRange(score, firstBeat, endBeat);
  const overlay = svgElement("svg", {
    class: "score-grid-voices",
    viewBox: `0 ${scoreGridStudy.cropTop} ${rowWidth} ${scoreGridStudy.cropHeight}`,
    width: rowWidth,
    height: scoreGridStudy.cropHeight,
    "aria-hidden": "true",
    focusable: "false",
  });
  const defs = svgElement("defs");
  const clipPath = svgElement("clipPath", { id: `score-grid-voice-clip-${rowBars[0].number}` });
  const clip = svgElement("rect", {
    x: 150,
    y: scoreGridStudy.cropTop,
    width: rowWidth - 150,
    height: scoreGridStudy.cropHeight,
  });
  clipPath.append(clip);
  defs.append(clipPath);
  overlay.append(defs);

  const traces = svgElement("g", { class: "score-grid-voice-traces", "clip-path": `url(#score-grid-voice-clip-${rowBars[0].number})` });
  for (const layer of ["melodyOne", "melodyTwo"]) {
    const layerNotes = windowNotes.filter(note => note.layer === layer);
    const pathData = contourPathForNotes(layerNotes, centerBeat, geometry);
    const group = svgElement("g", { class: `score-grid-voice score-grid-voice--${layer}` });
    const glow = svgElement("path", { class: "score-grid-voice-glow", d: pathData });
    const path = svgElement("path", { class: "score-grid-voice-trace", d: pathData });
    group.append(glow, path);

    const points = contourPoints(layerNotes).filter(point => point.beat >= firstBeat && point.beat < endBeat);
    points.forEach((point, index) => {
      const x = geometry.cursorX + (point.beat - centerBeat) * geometry.pixelsPerBeat;
      const y = contourYForMidi(point.midi, geometry);
      const noteId = `${layer}-beat-${point.beat.toFixed(4)}`;
      const halo = svgElement("circle", {
        class: "score-grid-voice-note-halo",
        cx: x.toFixed(3),
        cy: y.toFixed(3),
        r: "6",
      });
      const note = svgElement("circle", {
        class: "score-grid-voice-note",
        cx: x.toFixed(3),
        cy: y.toFixed(3),
        r: "2.6",
      });
      note.dataset.scoreVoiceEventId = `${rowBars[0].number}-${noteId}`;
      note.dataset.patternVoiceEventId = noteId;
      note.dataset.beat = point.beat.toFixed(4);
      note.dataset.midi = String(point.midi);
      note.dataset.voicePointIndex = String(index);
      group.append(halo, note);
    });
    traces.append(group);
  }
  overlay.append(traces);
  return overlay;
}

function barsPerSystemForViewport() {
  return window.matchMedia("(max-width: 700px)").matches ? 1
    : window.matchMedia("(max-width: 900px)").matches ? 2 : 3;
}

function createStudyFrame(stage, headerDocument, scoreDocuments, patterns) {
  const viewport = document.createElement("div");
  viewport.className = "score-grid-window";
  viewport.setAttribute("role", "img");
  viewport.setAttribute("aria-label", "Estudo da pauta de guitarra");

  const fit = document.createElement("div");
  fit.className = "score-grid-fit";
  const sheet = document.createElement("div");
  sheet.className = "score-grid-sheet";
  fit.append(sheet);
  viewport.append(fit);
  stage.replaceChildren(viewport);

  let systems = 0;
  let currentSheetWidth = 0;
  const updateScale = () => {
    const width = stage.clientWidth;
    const scale = Math.min(1.08, width / currentSheetWidth);
    fit.style.setProperty("--score-fit-width", `${currentSheetWidth * scale}px`);
    const sheetHeight = systems * scoreGridStudy.cropHeight + Math.max(0, systems - 1) * SYSTEM_GAP;
    fit.style.setProperty("--score-fit-height", `${sheetHeight * scale}px`);
    sheet.style.setProperty("--score-scale", String(scale));
  };

  const renderBars = () => {
    const barsPerSystem = barsPerSystemForViewport();
    currentBarsPerSystem = barsPerSystem;
    currentSheetWidth = 150 + barsPerSystem * scoreGridStudy.barWidth;
    const rows = [];
    for (let index = 0; index < scoreGridStudy.bars.length; index += barsPerSystem) {
      rows.push(scoreGridStudy.bars.slice(index, index + barsPerSystem));
    }
    systems = rows.length;
    sheet.style.setProperty("--score-row-width", `${currentSheetWidth}px`);
    sheet.style.setProperty("--bars-per-system", String(barsPerSystem));
    sheet.replaceChildren();

    for (const rowBars of rows) {
      const row = document.createElement("div");
      row.className = "score-grid-system";
      row.dataset.firstBar = String(rowBars[0].number);
      row.dataset.lastBar = String(rowBars.at(-1).number);
      row.append(createHeader(headerDocument));
      for (const bar of rowBars) {
        const patternId = bar.pattern;
        const entry = patterns.get(patternId);
        row.append(createBar(entry.source, bar, entry.pattern, patternId, entry.templates));
      }
      for (let empty = rowBars.length; empty < barsPerSystem; empty += 1) {
        const spacer = document.createElement("div");
        spacer.className = "score-grid-blank";
        spacer.setAttribute("aria-hidden", "true");
        row.append(spacer);
      }
      if (voiceStudyMode) row.append(createVoiceOverlay(rowBars, currentSheetWidth));
      sheet.append(row);
    }

    const isPortuguese = document.documentElement.lang.toLowerCase().startsWith("pt");
    if (excerptLabel) excerptLabel.textContent = voiceStudyMode
      ? isPortuguese ? "Partitura + duas vozes · 106 compassos" : "Score + two voices · 106 bars"
      : isPortuguese ? "Partitura completa · 106 compassos · 26 padrões" : "Complete score · 106 bars · 26 patterns";
    viewport.setAttribute("aria-label", voiceStudyMode
      ? isPortuguese ? "Partitura de guitarra com Voz I azul e Voz II violeta, em 106 compassos" : "Guitar score with blue Voice I and violet Voice II across 106 bars"
      : isPortuguese ? "Partitura completa de guitarra, 106 compassos, com 26 padrões reutilizados" : "Complete guitar score, 106 bars, using 26 repeated patterns");
    updateScale();
  };

  renderBars();
  resizeObserver = new ResizeObserver(updateScale);
  resizeObserver.observe(stage);
  return { rerender: () => {
    if (barsPerSystemForViewport() !== currentBarsPerSystem) renderBars();
    else updateScale();
  } };
}

async function loadSvg(url, { expectedSystemStart } = {}) {
  const response = await fetch(url, { signal: pageController.signal });
  if (!response.ok) throw new Error(`Falha ao abrir a pauta (${response.status}).`);
  const source = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
  if (source.querySelector("parsererror")) throw new Error("Não foi possível interpretar o SVG da pauta.");
  if (expectedSystemStart != null) {
    const metadata = source.querySelector("metadata");
    const details = metadata ? JSON.parse(metadata.textContent) : {};
    if (details.firstBar !== expectedSystemStart || details.lastBar < expectedSystemStart || details.lastBar > expectedSystemStart + 2) {
      throw new Error(`A pauta ${url.pathname} não contém o sistema esperado.`);
    }
  }
  return source;
}

async function initialize() {
  if (!stage) return;
  addStudyStylesheet();
  try {
    const systemStarts = [...new Set(Object.values(scoreGridStudy.patterns).map(pattern => systemStartForBar(pattern.sourceBar)))];
    const [headerDocument, ...systemDocuments] = await Promise.all([
      loadSvg(new URL("./guitar-score/notation-header.svg", import.meta.url)),
      ...systemStarts.map(start => loadSvg(new URL(`./guitar-score/system-${String(start).padStart(3, "0")}.svg`, import.meta.url), {
        expectedSystemStart: start,
      })),
    ]);
    const documentsByStart = new Map(systemStarts.map((start, index) => [start, systemDocuments[index]]));
    const probeHost = document.createElement("div");
    probeHost.className = "score-grid-probe-host";
    stage.append(probeHost);

    const patterns = new Map();
    for (const [patternId, pattern] of Object.entries(scoreGridStudy.patterns)) {
      const sourceDocument = documentsByStart.get(systemStartForBar(pattern.sourceBar));
      const source = getSymbol(sourceDocument, `bar-${String(pattern.sourceBar).padStart(3, "0")}`);
      const sourceNotes = [...getMeasureRoot(source).querySelectorAll(".vf-stavenote")];
      const templates = probeNoteBounds(sourceNotes, pattern.events, probeHost, pattern.sourceBar);
      patterns.set(patternId, { source, pattern, templates });
    }
    probeHost.remove();

    const frame = createStudyFrame(stage, headerDocument, documentsByStart, patterns);
    window.addEventListener("resize", frame.rerender, { passive: true, signal: pageController.signal });
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Estudo da grade da partitura não carregou.", error);
    stage.dataset.scoreGridError = "true";
  }
}

initialize();
window.addEventListener("pagehide", () => {
  resizeObserver?.disconnect();
  pageController.abort();
}, { once: true });
