let stylesheetLink = null;
let stylesheetMounts = 0;
let stylesheetOwned = false;
let instanceNumber = 0;

const story = {
  pt: {
    eyebrow: "GAMES · UMA VINHETA",
    title: "Floresta Antiga",
    invitation: "Estratégia também pode começar por um caminho.",
    explore: "Explorar o mundo",
    close: "Fechar apresentação",
    previous: "Voltar",
    next: "Continuar",
    finish: "Fechar",
    gesture: "Arraste ou use ← e →",
    scenes: [
      "A trilha serpenteia pela floresta, pedra por pedra.",
      "A água guarda o violeta do portal; o cavalo espera no caminho.",
      "Há mais de um jeito de avançar. Nos jogos, tudo começa ao perceber um padrão.",
    ],
    page: (current, total) => `Trecho ${current} de ${total}`,
  },
  en: {
    eyebrow: "GAMES · A VIGNETTE",
    title: "Ancient Forest",
    invitation: "Strategy can start with a path.",
    explore: "Explore the world",
    close: "Close presentation",
    previous: "Back",
    next: "Continue",
    finish: "Close",
    gesture: "Swipe or use ← and →",
    scenes: [
      "A stone path winds through the forest, one step at a time.",
      "Water holds the portal's violet light; the knight waits along the path.",
      "There is more than one way forward. Games begin by noticing a pattern.",
    ],
    page: (current, total) => `Scene ${current} of ${total}`,
  },
};

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function acquireStylesheet(document) {
  if (!stylesheetLink || !stylesheetLink.isConnected) {
    stylesheetLink = document.querySelector("link[data-forest-world-stylesheet]");
    stylesheetOwned = !stylesheetLink;
    if (!stylesheetLink) {
      stylesheetLink = element(document, "link");
      stylesheetLink.rel = "stylesheet";
      stylesheetLink.href = new URL("./forest-world.css", import.meta.url).href;
      stylesheetLink.dataset.forestWorldStylesheet = "";
      document.head.append(stylesheetLink);
    }
  }

  stylesheetMounts += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    stylesheetMounts -= 1;
    if (stylesheetMounts === 0 && stylesheetOwned) stylesheetLink?.remove();
    if (stylesheetMounts === 0) {
      stylesheetLink = null;
      stylesheetOwned = false;
    }
  };
}

function createHorseSprite(document, className = "") {
  const sprite = element(document, "span", `forest-world-horse-sprite ${className}`.trim());
  sprite.setAttribute("aria-hidden", "true");
  return sprite;
}

function createStoryDialog(document, copy, id) {
  const dialog = element(document, "dialog", "forest-world-dialog");
  dialog.setAttribute("closedby", "closerequest");

  const stage = element(document, "div", "forest-world-stage");
  const artwork = element(document, "div", "forest-world-dialog-art");
  artwork.setAttribute("aria-hidden", "true");

  const horse = element(document, "div", "forest-world-dialog-horse");
  horse.setAttribute("aria-hidden", "true");
  horse.append(createHorseSprite(document));

  const header = element(document, "header", "forest-world-dialog-header");
  const heading = element(document, "div", "forest-world-dialog-heading");
  heading.append(
    element(document, "p", "forest-world-eyebrow", copy.eyebrow),
    element(document, "h2", "forest-world-dialog-title", copy.title),
  );
  heading.lastElementChild.id = `forest-world-dialog-title-${id}`;

  const close = element(document, "button", "forest-world-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", copy.close);
  close.autofocus = true;
  header.append(heading, close);

  const caption = element(document, "section", "forest-world-caption");
  const text = element(document, "p", "forest-world-caption-text", copy.scenes[0]);
  text.id = `forest-world-caption-text-${id}`;
  text.setAttribute("aria-live", "polite");
  text.setAttribute("aria-atomic", "true");

  const controls = element(document, "div", "forest-world-controls");
  const previous = element(document, "button", "forest-world-step forest-world-step-previous");
  previous.type = "button";
  const next = element(document, "button", "forest-world-step forest-world-step-next");
  next.type = "button";
  controls.append(previous, next);

  const instruction = element(document, "p", "forest-world-instruction", copy.gesture);
  instruction.setAttribute("aria-hidden", "true");
  caption.append(text, controls, instruction);

  stage.append(artwork, horse, header, caption);
  dialog.append(stage);
  dialog.setAttribute("aria-labelledby", heading.lastElementChild.id);
  dialog.setAttribute("aria-describedby", text.id);

  return { dialog, artwork, close, text, previous, next, instruction };
}

export function mountForestWorld(root) {
  if (!root) return () => {};
  const experiment = root.querySelector(".games-experiment");
  const gamesMark = experiment?.querySelector(":scope > .games-mark");
  if (!experiment || !gamesMark) return () => {};

  const document = root.ownerDocument;
  const releaseStylesheet = acquireStylesheet(document);
  const copy = document.documentElement.lang.toLowerCase().startsWith("pt") ? story.pt : story.en;
  const id = ++instanceNumber;
  const originalMark = {
    parent: gamesMark.parentNode,
    nextSibling: gamesMark.nextSibling,
    children: [...gamesMark.childNodes],
    className: gamesMark.className,
    hidden: gamesMark.hidden,
  };
  const originalMountState = experiment.getAttribute("data-forest-world-mounted");

  const card = element(document, "article", "forest-world-card");
  const cardArt = element(document, "div", "forest-world-card-art");
  cardArt.setAttribute("aria-hidden", "true");
  const invitation = element(document, "div", "forest-world-invitation");
  const cardHeading = element(document, "h3", "forest-world-card-title", copy.title);
  cardHeading.id = `forest-world-card-title-${id}`;
  invitation.append(
    element(document, "p", "forest-world-eyebrow", copy.eyebrow),
    cardHeading,
    element(document, "p", "forest-world-card-copy", copy.invitation),
  );

  const open = element(document, "button", "forest-world-explore");
  open.type = "button";
  open.append(
    element(document, "span", "forest-world-explore-label", copy.explore),
    element(document, "span", "forest-world-explore-arrow", "↗"),
  );
  open.setAttribute("aria-haspopup", "dialog");
  card.append(cardArt, invitation, open);
  card.setAttribute("aria-labelledby", cardHeading.id);

  const horse = createHorseSprite(document, "forest-world-card-horse");
  gamesMark.className = `${originalMark.className} forest-world-hero-knight`.trim();
  gamesMark.hidden = false;
  gamesMark.replaceChildren(horse);
  cardArt.append(gamesMark);

  const { dialog, artwork, close, text, previous, next, instruction } = createStoryDialog(document, copy, id);
  const details = experiment.querySelector(":scope > .knight-details");
  experiment.insertBefore(card, details ?? null);
  experiment.append(dialog);
  experiment.dataset.forestWorldMounted = "true";

  const abortController = new AbortController();
  const { signal } = abortController;
  let sceneIndex = 0;

  function updateScene(index) {
    sceneIndex = Math.max(0, Math.min(copy.scenes.length - 1, index));
    text.textContent = copy.scenes[sceneIndex];
    dialog.dataset.scene = String(sceneIndex + 1);
    previous.textContent = `← ${copy.previous}`;
    previous.setAttribute("aria-label", `${copy.previous} · ${copy.page(sceneIndex + 1, copy.scenes.length)}`);
    previous.disabled = sceneIndex === 0;
    const isFinalScene = sceneIndex === copy.scenes.length - 1;
    next.textContent = isFinalScene ? `${copy.finish} ×` : `${copy.next} →`;
    next.setAttribute("aria-label", isFinalScene ? copy.finish : `${copy.next} · ${copy.page(sceneIndex + 2, copy.scenes.length)}`);
    instruction.textContent = copy.gesture;
  }

  function openDialog() {
    if (!dialog.open) dialog.showModal();
  }

  open.addEventListener("click", openDialog, { signal });
  close.addEventListener("click", () => dialog.close(), { signal });
  previous.addEventListener("click", () => updateScene(sceneIndex - 1), { signal });
  next.addEventListener("click", () => {
    if (sceneIndex === copy.scenes.length - 1) dialog.close("complete");
    else updateScene(sceneIndex + 1);
  }, { signal });

  dialog.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (sceneIndex === copy.scenes.length - 1) dialog.close("complete");
      else updateScene(sceneIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateScene(sceneIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateScene(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateScene(copy.scenes.length - 1);
    }
  }, { signal });

  let swipeStart = null;
  dialog.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) {
      swipeStart = null;
      return;
    }
    swipeStart = { x: event.clientX, y: event.clientY };
  }, { signal });
  dialog.addEventListener("pointerup", event => {
    if (!swipeStart) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) {
      if (sceneIndex === copy.scenes.length - 1) dialog.close("complete");
      else updateScene(sceneIndex + 1);
    } else {
      updateScene(sceneIndex - 1);
    }
  }, { signal });
  dialog.addEventListener("pointercancel", () => { swipeStart = null; }, { signal });

  updateScene(0);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    if (dialog.open) dialog.close();
    dialog.remove();
    card.remove();

    gamesMark.remove();
    gamesMark.className = originalMark.className;
    gamesMark.hidden = originalMark.hidden;
    gamesMark.replaceChildren(...originalMark.children);
    if (originalMark.parent?.isConnected) {
      originalMark.parent.insertBefore(
        gamesMark,
        originalMark.nextSibling?.parentNode === originalMark.parent ? originalMark.nextSibling : null,
      );
    }

    if (originalMountState === null) experiment.removeAttribute("data-forest-world-mounted");
    else experiment.setAttribute("data-forest-world-mounted", originalMountState);
    releaseStylesheet();
  };
}
