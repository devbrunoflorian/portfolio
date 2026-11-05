import { harmonyNotes } from "./transport.js";

export function knightMoves(position, size = 5) {
  const row = Math.floor(position / size), column = position % size;
  return [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
    .map(([y, x]) => [row + y, column + x])
    .filter(([y, x]) => y >= 0 && y < size && x >= 0 && x < size)
    .map(([y, x]) => y * size + x);
}

export const knightChallenges = [
  { start: 12, target: 6, limit: 2, path: [12, 3, 6], hint: "d5" },
  { start: 12, target: 10, limit: 2, path: [12, 21, 10], hint: "b1" },
];

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
  const challengeLabel = root.querySelector("[data-knight-challenge-label]");
  const challengeCopy = root.querySelector("[data-knight-challenge]");
  const hintButton = root.querySelector("[data-knight-hint]");
  const hintCopy = root.querySelector("[data-knight-hint-copy]");
  const challengeText = isPortuguese
    ? ["Chegue em b4 em até dois movimentos.", "Chegue em a3 em até dois movimentos."]
    : ["Reach b4 in two moves or fewer.", "Reach a3 in two moves or fewer."];
  const challengeHints = isPortuguese ? ["Passe por d5.", "Passe por b1."] : ["Pass through d5.", "Pass through b1."];
  let challengeIndex = 0;
  let position = knightChallenges[challengeIndex].start;
  let movesMade = 0;
  let finished = false;
  const squareName = index => `${String.fromCharCode(97 + index % 5)}${5 - Math.floor(index / 5)}`;
  const squares = Array.from({ length: 25 }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      const challenge = knightChallenges[challengeIndex];
      if (finished || movesMade >= challenge.limit || !knightMoves(position).includes(index)) return;
      position = index;
      movesMade += 1;
      if (position === challenge.target) finished = true;
      else if (movesMade >= challenge.limit) finished = true;
      renderBoard();
      squares[position].focus({ preventScroll: true });
    }, { signal });
    board.append(button);
    return button;
  });
  function renderBoard() {
    const challenge = knightChallenges[challengeIndex];
    const legal = knightMoves(position);
    squares.forEach((button, index) => {
      const occupied = index === position;
      const canMove = !finished && movesMade < challenge.limit && legal.includes(index);
      button.textContent = occupied ? "♞" : "";
      button.dataset.legal = String(canMove);
      button.dataset.target = String(index === challenge.target);
      button.setAttribute("aria-pressed", String(occupied));
      button.setAttribute("aria-disabled", String(!canMove));
      const targetLabel = index === challenge.target ? `, ${isPortuguese ? "alvo" : "target"}` : "";
      button.setAttribute("aria-label", `${occupied ? (isPortuguese ? "Cavalo em" : "Knight on") : canMove ? (isPortuguese ? "Mover para" : "Move to") : (isPortuguese ? "Casa" : "Square")} ${squareName(index)}${targetLabel}`);
      button.tabIndex = occupied ? 0 : -1;
    });
    challengeLabel.textContent = `${isPortuguese ? "Desafio" : "Puzzle"} ${challengeIndex + 1}/2`;
    challengeCopy.textContent = challengeText[challengeIndex];
    hintCopy.textContent = challengeHints[challengeIndex];
    if (position === challenge.target) {
      boardStatus.textContent = isPortuguese ? `Desafio concluído em ${movesMade} movimentos.` : `Puzzle solved in ${movesMade} moves.`;
    } else if (finished) {
      boardStatus.textContent = isPortuguese ? "Limite de movimentos atingido. Recomece para tentar." : "Move limit reached. Start again to retry.";
    } else if (movesMade > 0) {
      const target = squareName(challenge.target);
      boardStatus.textContent = isPortuguese
        ? `Cavalo em ${squareName(position)}. ${movesMade} de ${challenge.limit} movimentos. Siga para ${target}.`
        : `Knight on ${squareName(position)}. ${movesMade} of ${challenge.limit} moves. Continue to ${target}.`;
    } else {
      boardStatus.textContent = isPortuguese ? `Cavalo em ${squareName(position)}. Escolha uma casa marcada.` : `Knight on ${squareName(position)}. Choose a marked square.`;
    }
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
  function resetPuzzle() {
    position = knightChallenges[challengeIndex].start;
    movesMade = 0;
    finished = false;
    renderBoard();
  }
  root.querySelector("[data-knight-reset]").addEventListener("click", resetPuzzle, { signal });
  root.querySelector("[data-knight-next]").addEventListener("click", () => {
    challengeIndex = (challengeIndex + 1) % knightChallenges.length;
    resetPuzzle();
  }, { signal });
  hintButton.addEventListener("click", () => {
    const expanded = hintButton.getAttribute("aria-expanded") !== "true";
    hintButton.setAttribute("aria-expanded", String(expanded));
    hintButton.textContent = expanded ? (isPortuguese ? "Ocultar dica" : "Hide hint") : (isPortuguese ? "Ver dica" : "Show hint");
    hintCopy.hidden = !expanded;
  }, { signal });
  renderBoard();

  return { dispose() { controller.abort(); timers.forEach(clearTimeout); board.replaceChildren(); } };
}
