import { harmonyNotes } from "./transport.js";

export function knightMoves(position, size = 5) {
  const row = Math.floor(position / size), column = position % size;
  return [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
    .map(([y, x]) => [row + y, column + x])
    .filter(([y, x]) => y >= 0 && y < size && x >= 0 && x < size)
    .map(([y, x]) => y * size + x);
}

export function mountExperiments(root, audio, isPortuguese) {
  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set();
  const later = (callback, delay) => {
    const id = setTimeout(() => { timers.delete(id); callback(); }, delay);
    timers.add(id);
    return id;
  };
  const instrument = root.querySelector(".music-instrument");
  const surface = root.querySelector(".instrument-surface");
  const noteButtons = [...root.querySelectorAll("[data-note]")];
  const chordButtons = [...root.querySelectorAll("[data-chord]")];
  let pulseTimer;
  function resonate(button, notes, label) {
    const audible = audio.playNotes(notes);
    root.querySelector("[data-played-note]").textContent = `${label} · ${audible ? (isPortuguese ? "ressoando" : "resonating") : (isPortuguese ? "som desligado" : "sound off")}`;
    button.classList.add("is-playing");
    later(() => button.classList.remove("is-playing"), 450);
    surface.classList.add("is-resonating");
    clearTimeout(pulseTimer);
    timers.delete(pulseTimer);
    pulseTimer = later(() => surface.classList.remove("is-resonating"), 760);
  }
  noteButtons.forEach(button => button.addEventListener("click", () => resonate(button, [Number(button.dataset.note)], button.querySelector("span:not(.note-glyph)").textContent), { signal }));
  chordButtons.forEach(button => button.addEventListener("click", () => {
    chordButtons.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    resonate(button, harmonyNotes[button.dataset.chord], button.textContent);
  }, { signal }));
  instrument.addEventListener("keydown", event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[1-5]$/.test(event.key)) return;
    event.preventDefault();
    noteButtons[Number(event.key) - 1].click();
  }, { signal });

  const art = root.querySelector(".art-experiment");
  const rhythmButtons = [...root.querySelectorAll("[data-rhythm]")];
  rhythmButtons.forEach(button => button.addEventListener("click", () => {
    art.dataset.rhythmState = button.dataset.rhythm;
    rhythmButtons.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
  }, { signal }));

  const board = root.querySelector("[data-knight-board]");
  const boardStatus = root.querySelector("[data-knight-status]");
  let position = 12;
  const squareName = index => `${String.fromCharCode(97 + index % 5)}${5 - Math.floor(index / 5)}`;
  const squares = Array.from({ length: 25 }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      if (!knightMoves(position).includes(index)) return;
      position = index;
      renderBoard();
      squares[position].focus({ preventScroll: true });
    }, { signal });
    board.append(button);
    return button;
  });
  function renderBoard() {
    const legal = knightMoves(position);
    squares.forEach((button, index) => {
      const occupied = index === position;
      const canMove = legal.includes(index);
      button.textContent = occupied ? "♞" : "";
      button.dataset.legal = String(canMove);
      button.setAttribute("aria-pressed", String(occupied));
      button.setAttribute("aria-disabled", String(!canMove));
      button.setAttribute("aria-label", `${occupied ? (isPortuguese ? "Cavalo em" : "Knight on") : canMove ? (isPortuguese ? "Mover para" : "Move to") : (isPortuguese ? "Casa" : "Square")} ${squareName(index)}`);
      button.tabIndex = occupied ? 0 : -1;
    });
    boardStatus.textContent = isPortuguese ? `Cavalo em ${squareName(position)}. ${legal.length} movimentos possíveis.` : `Knight on ${squareName(position)}. ${legal.length} possible moves.`;
  }
  board.addEventListener("keydown", event => {
    const index = squares.indexOf(document.activeElement);
    if (index < 0) return;
    const row = Math.floor(index / 5), column = index % 5;
    let next = index;
    if (event.key === "ArrowRight") next = row * 5 + Math.min(4, column + 1);
    else if (event.key === "ArrowLeft") next = row * 5 + Math.max(0, column - 1);
    else if (event.key === "ArrowDown") next = Math.min(4, row + 1) * 5 + column;
    else if (event.key === "ArrowUp") next = Math.max(0, row - 1) * 5 + column;
    else if (event.key === "Home") next = row * 5;
    else if (event.key === "End") next = row * 5 + 4;
    else return;
    event.preventDefault();
    squares.forEach((button, i) => { button.tabIndex = i === next ? 0 : -1; });
    squares[next].focus({ preventScroll: true });
  }, { signal });
  root.querySelector("[data-knight-reset]").addEventListener("click", () => { position = 12; renderBoard(); }, { signal });
  renderBoard();

  return { dispose() { controller.abort(); timers.forEach(clearTimeout); board.replaceChildren(); } };
}
