import { scoreGridStudy } from "./score-grid-study-data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const root = document.querySelector(".about-main");
const stage = root?.querySelector('.score-stage-spacer[data-score-anchor="music"]');
const excerptLabel = root?.querySelector("[data-score-excerpt]");
const pageController = new AbortController();
let resizeObserver;
let currentBarCount = 0;

document.body.dataset.scoreGridStudy = "true";

function addStudyStylesheet() {
  if (document.querySelector('link[data-score-grid-study-style]')) return;
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

function getSymbol(document, id) {
  const symbol = document.getElementById(id);
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
  return symbol.querySelector("g");
}

function createEngravingLayer(sourceMeasure) {
  const layer = svgElement("svg", {
    class: "score-grid-engraving",
    viewBox: `0 ${scoreGridStudy.cropTop} ${scoreGridStudy.barWidth} ${scoreGridStudy.cropHeight}`,
    width: scoreGridStudy.barWidth,
    height: scoreGridStudy.cropHeight,
    "aria-hidden": "true",
    focusable: "false",
  });
  const engraving = getMeasureRoot(sourceMeasure).cloneNode(true);
  engraving.querySelectorAll(".vf-stavenote, .vf-stave, rect[opacity='0']").forEach(node => node.remove());
  stripIds(engraving);
  tint(engraving, "#9f96a8");
  engraving.setAttribute("opacity", ".82");
  layer.append(engraving);
  return layer;
}

function probeNoteBounds(sourceNotes, sheet) {
  const probe = svgElement("svg", {
    class: "score-grid-probe",
    viewBox: `0 0 ${scoreGridStudy.barWidth} 372`,
    width: scoreGridStudy.barWidth,
    height: 372,
    "aria-hidden": "true",
  });
  const clones = sourceNotes.map(note => {
    const clone = note.cloneNode(true);
    stripIds(clone);
    probe.append(clone);
    return clone;
  });
  sheet.append(probe);
  const boxes = clones.map(note => {
    const box = note.getBBox();
    if (!(box.width > 0 && box.height > 0)) throw new Error("Não foi possível medir o glifo musical.");
    const head = note.querySelector(".vf-notehead")?.getBBox();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      headCenterY: head ? head.y + head.height / 2 : null,
    };
  });
  probe.remove();
  return { boxes, clones };
}

function createNoteIcon(template, event, bar, eventIndex) {
  const { box, sourceNote } = template;
  const timeCell = scoreGridStudy.barWidth / (scoreGridStudy.beatsPerBar * scoreGridStudy.subdivisionsPerBeat);
  const barX = event.beatTick / scoreGridStudy.subdivisionsPerBeat * scoreGridStudy.pixelsPerBeat;
  // One beat tick is one of the 96 CSS columns in this 4/4 measure.
  const gridColumn = Math.round(event.beatTick) + 1;
  const gridCellX = (gridColumn - 1) * timeCell;
  const pitchY = writtenPitchY(event.pitch);
  const localPitchY = pitchY - scoreGridStudy.cropTop;
  const gridRow = Math.floor(localPitchY / 12) + 1;
  const gridRowY = (gridRow - 1) * 12;
  const padded = 1;
  const viewBox = `${box.x - padded} ${box.y - padded} ${box.width + padded * 2} ${box.height + padded * 2}`;
  const spanColumns = Math.max(1, Math.ceil((box.x + box.width - gridCellX) / timeCell));
  const spanRows = Math.max(1, Math.ceil((box.y + box.height - scoreGridStudy.cropTop - gridRowY) / 12));

  const icon = svgElement("svg", {
    class: "score-grid-note",
    viewBox,
    width: box.width + padded * 2,
    height: box.height + padded * 2,
    "aria-hidden": "true",
    focusable: "false",
  });
  icon.dataset.scoreNoteId = `bar-${bar.number}-note-${String(eventIndex + 1).padStart(2, "0")}`;
  icon.dataset.beatTick = String(event.beatTick);
  icon.dataset.pitch = String(event.pitch);
  icon.dataset.patternNoteId = `${bar.pattern}-note-${String(eventIndex + 1).padStart(2, "0")}`;
  icon.style.gridColumn = `${gridColumn} / span ${spanColumns}`;
  icon.style.gridRow = `${gridRow} / span ${spanRows}`;
  icon.style.setProperty("--note-width", `${box.width + padded * 2}px`);
  icon.style.setProperty("--note-height", `${box.height + padded * 2}px`);
  icon.style.setProperty("--note-offset-x", `${box.x - barX - padded}px`);
  icon.style.setProperty("--note-offset-y", `${box.y - scoreGridStudy.cropTop - gridRowY - padded}px`);

  const glyph = sourceNote.cloneNode(true);
  stripIds(glyph);
  tint(glyph, "#cec5d7");
  icon.append(glyph);

  const engravingError = box.headCenterY == null ? null : box.headCenterY - pitchY;
  if (engravingError != null && Math.abs(engravingError) > .55) {
    icon.dataset.pitchCheck = `off-${engravingError.toFixed(2)}`;
  }
  return icon;
}

function createBar(sourceMeasure, bar, pattern, noteTemplates) {
  const measure = document.createElement("div");
  measure.className = "score-grid-bar";
  measure.dataset.barNumber = String(bar.number);
  measure.dataset.pattern = bar.pattern;
  measure.setAttribute("aria-hidden", "true");
  measure.style.gridTemplateRows = `repeat(${scoreGridStudy.cropHeight / 12}, 12px)`;
  measure.append(createStaffLines(), createBeatGuides(), createEngravingLayer(sourceMeasure));

  const number = document.createElement("span");
  number.className = "score-grid-measure-number";
  number.textContent = String(bar.number);
  measure.append(number);

  pattern.events.forEach((event, index) => {
    measure.append(createNoteIcon(noteTemplates[index], event, bar, index));
  });
  return measure;
}

function createStudyFrame(stage, headerDocument, scoreDocument) {
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

  const patterns = new Map();
  for (const bar of scoreGridStudy.bars) {
    if (patterns.has(bar.pattern)) continue;
    const pattern = scoreGridStudy.patterns[bar.pattern];
    const source = getSymbol(scoreDocument, `bar-${String(pattern.sourceBar).padStart(3, "0")}`);
    const sourceNotes = [...getMeasureRoot(source).querySelectorAll(".vf-stavenote")];
    if (sourceNotes.length !== pattern.events.length) {
      throw new Error(`O padrão tem ${pattern.events.length} eventos, mas a gravação tem ${sourceNotes.length} glifos.`);
    }
    const { boxes, clones } = probeNoteBounds(sourceNotes, sheet);
    patterns.set(bar.pattern, { source, pattern, noteTemplates: boxes.map((box, index) => ({ box, sourceNote: clones[index] })) });
  }

  let visibleBars = [];
  const updateScale = () => {
    const width = stage.clientWidth;
    const sheetWidth = 150 + visibleBars.length * scoreGridStudy.barWidth;
    const scale = Math.min(1.08, width / sheetWidth);
    fit.style.setProperty("--score-fit-width", `${sheetWidth * scale}px`);
    fit.style.setProperty("--score-fit-height", `${scoreGridStudy.cropHeight * scale}px`);
    sheet.style.setProperty("--score-scale", String(scale));
  };
  const renderBars = () => {
    const visibleLimit = window.matchMedia("(max-width: 700px)").matches ? 1
      : window.matchMedia("(max-width: 900px)").matches ? 2 : 3;
    visibleBars = scoreGridStudy.bars.slice(0, visibleLimit);
    currentBarCount = visibleBars.length;
    sheet.style.setProperty("--bar-count", String(visibleBars.length));
    sheet.style.setProperty("--score-sheet-width", `${150 + visibleBars.length * scoreGridStudy.barWidth}px`);
    sheet.replaceChildren(createHeader(headerDocument));
    for (const bar of visibleBars) {
      const entry = patterns.get(bar.pattern);
      sheet.append(createBar(entry.source, bar, entry.pattern, entry.noteTemplates));
    }

    const isPortuguese = document.documentElement.lang.toLowerCase().startsWith("pt");
    const firstBar = visibleBars[0]?.number ?? scoreGridStudy.bars[0].number;
    const lastBar = visibleBars.at(-1)?.number ?? firstBar;
    if (excerptLabel) excerptLabel.textContent = isPortuguese
      ? `Estudo da grade · compassos ${firstBar}–${lastBar}`
      : `Grid study · bars ${firstBar}–${lastBar}`;
    viewport.setAttribute("aria-label", isPortuguese
      ? `Partitura de guitarra, compassos ${firstBar} a ${lastBar}`
      : `Guitar score, bars ${firstBar} through ${lastBar}`);
  };
  renderBars();
  updateScale();
  resizeObserver = new ResizeObserver(updateScale);
  resizeObserver.observe(stage);
  return { viewport, rerender: () => {
    const limit = window.matchMedia("(max-width: 700px)").matches ? 1
      : window.matchMedia("(max-width: 900px)").matches ? 2 : 3;
    if (limit !== currentBarCount) renderBars();
    updateScale();
  } };
}

async function loadSvg(url) {
  const response = await fetch(url, { signal: pageController.signal });
  if (!response.ok) throw new Error(`Falha ao abrir a pauta (${response.status}).`);
  const source = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
  if (source.querySelector("parsererror")) throw new Error("Não foi possível interpretar o SVG da pauta.");
  return source;
}

async function initialize() {
  if (!stage) return;
  addStudyStylesheet();
  try {
    const [headerDocument, scoreDocument] = await Promise.all([
      loadSvg(new URL("./guitar-score/notation-header.svg", import.meta.url)),
      loadSvg(new URL("./guitar-score/system-016.svg", import.meta.url)),
    ]);
    const frame = createStudyFrame(stage, headerDocument, scoreDocument);
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
