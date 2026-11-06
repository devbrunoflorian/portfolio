import { harmonyNotes } from "./transport.js";

export function knightMoves(position, size = 5, blocked = []) {
  const row = Math.floor(position / size), column = position % size;
  const blockedSquares = new Set(blocked);
  return [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
    .map(([y, x]) => [row + y, column + x])
    .filter(([y, x]) => y >= 0 && y < size && x >= 0 && x < size)
    .map(([y, x]) => y * size + x)
    .filter(square => !blockedSquares.has(square));
}

export const knightChallenges = [
  { start: 0, target: 2, limit: 2, blocked: [], path: [0, 11, 2] },
  { start: 0, target: 3, limit: 3, blocked: [], path: [0, 7, 14, 3] },
  { start: 4, target: 0, limit: 4, blocked: [7, 22], path: [4, 13, 2, 11, 0] },
  { start: 9, target: 16, limit: 5, blocked: [2, 7, 12], path: [9, 18, 11, 22, 13, 16] },
  { start: 3, target: 23, limit: 6, blocked: [12, 13, 14], path: [3, 6, 17, 10, 7, 16, 23] },
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
  const nextButton = root.querySelector("[data-knight-next]");
  const details = root.querySelector(".knight-details");
  const gamesChapter = root.querySelector(".games-chapter");
  const hintButton = root.querySelector("[data-knight-hint]");
  const hintCopy = root.querySelector("[data-knight-hint-copy]");
  let challengeIndex = 0;
  let position = knightChallenges[challengeIndex].start;
  let movesMade = 0;
  let finished = false;
  const squareName = index => `${String.fromCharCode(97 + index % 5)}${5 - Math.floor(index / 5)}`;
  details.addEventListener("toggle", () => {
    gamesChapter.dataset.puzzleOpen = String(details.open);
  }, { signal });
  const squares = Array.from({ length: 25 }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      const challenge = knightChallenges[challengeIndex];
      if (finished || movesMade >= challenge.limit) return;
      if (challenge.blocked.includes(index)) {
        boardStatus.textContent = isPortuguese ? `A casa ${squareName(index)} está fechada.` : `Square ${squareName(index)} is blocked.`;
        return;
      }
      if (!knightMoves(position, 5, challenge.blocked).includes(index)) {
        boardStatus.textContent = isPortuguese ? "Esse movimento não é de cavalo. Escolha uma casa marcada." : "That is not a knight move. Choose a marked square.";
        return;
      }
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
    const blocked = new Set(challenge.blocked);
    const legal = knightMoves(position, 5, blocked);
    const solved = position === challenge.target;
    const finalChallenge = challengeIndex === knightChallenges.length - 1;
    squares.forEach((button, index) => {
      const occupied = index === position;
      const isBlocked = blocked.has(index);
      const canMove = !finished && movesMade < challenge.limit && legal.includes(index);
      button.textContent = occupied ? "♞" : isBlocked ? "×" : "";
      button.dataset.legal = String(canMove);
      button.dataset.target = String(index === challenge.target);
      button.dataset.blocked = String(isBlocked);
      button.setAttribute("aria-pressed", String(occupied));
      button.setAttribute("aria-disabled", String(!canMove));
      const targetLabel = index === challenge.target ? `, ${isPortuguese ? "alvo" : "target"}` : "";
      const blockedLabel = isBlocked ? `, ${isPortuguese ? "casa fechada" : "blocked square"}` : "";
      button.setAttribute("aria-label", `${occupied ? (isPortuguese ? "Cavalo em" : "Knight on") : canMove ? (isPortuguese ? "Mover para" : "Move to") : (isPortuguese ? "Casa" : "Square")} ${squareName(index)}${targetLabel}${blockedLabel}`);
      button.tabIndex = occupied ? 0 : -1;
    });
    challengeLabel.textContent = `${isPortuguese ? "Etapa" : "Stage"} ${challengeIndex + 1}/${knightChallenges.length} · ${challenge.limit} ${isPortuguese ? "lances" : "moves"}`;
    challengeCopy.textContent = isPortuguese
      ? `De ${squareName(challenge.start)} até ${squareName(challenge.target)} em ${challenge.limit} lances.`
      : `From ${squareName(challenge.start)} to ${squareName(challenge.target)} in ${challenge.limit} moves.`;
    hintCopy.textContent = isPortuguese
      ? `A primeira casa é ${squareName(challenge.path[1])}.`
      : `The first square is ${squareName(challenge.path[1])}.`;
    nextButton.disabled = !solved || finalChallenge;
    nextButton.textContent = finalChallenge && solved
      ? (isPortuguese ? "Trilha concluída" : "Trail complete")
      : (isPortuguese ? "Próxima etapa" : "Next stage");
    if (solved && finalChallenge) {
      boardStatus.textContent = isPortuguese ? "Trilha concluída. Você resolveu as cinco etapas." : "Trail complete. You solved all five stages.";
    } else if (solved) {
      boardStatus.textContent = isPortuguese ? `Etapa concluída em ${movesMade} lances. A próxima está liberada.` : `Stage solved in ${movesMade} moves. The next one is unlocked.`;
    } else if (finished) {
      boardStatus.textContent = isPortuguese ? "Lances esgotados. Recomece para tentar outra vez." : "Moves used. Start again to retry.";
    } else if (movesMade > 0) {
      const target = squareName(challenge.target);
      boardStatus.textContent = isPortuguese
        ? `Cavalo em ${squareName(position)}. ${movesMade} de ${challenge.limit} lances. Siga para ${target}.`
        : `Knight on ${squareName(position)}. ${movesMade} of ${challenge.limit} moves. Continue to ${target}.`;
    } else {
      const target = squareName(challenge.target);
      boardStatus.textContent = isPortuguese
        ? `Etapa ${challengeIndex + 1} de ${knightChallenges.length}. Cavalo em ${squareName(position)}. Chegue a ${target} em ${challenge.limit} lances.`
        : `Stage ${challengeIndex + 1} of ${knightChallenges.length}. Knight on ${squareName(position)}. Reach ${target} in ${challenge.limit} moves.`;
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
    hintButton.setAttribute("aria-expanded", "false");
    hintButton.textContent = isPortuguese ? "Ver dica" : "Show hint";
    hintCopy.hidden = true;
    renderBoard();
  }
  root.querySelector("[data-knight-reset]").addEventListener("click", resetPuzzle, { signal });
  nextButton.addEventListener("click", () => {
    if (nextButton.disabled || challengeIndex === knightChallenges.length - 1) return;
    challengeIndex += 1;
    resetPuzzle();
    squares[position].focus({ preventScroll: true });
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
