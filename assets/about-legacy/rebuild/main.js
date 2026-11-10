import { createJourneyAudio } from "../audio.js";
import { score } from "../score.js";
import { mountScoreScene } from "./scene.js";

const root = document.querySelector(".about-main");
if (!root) throw new Error("About mount point is missing");

const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
const copy = isEnglish ? {
  openingEyebrow: "ABOUT · DISSONÂNCIA",
  openingTitle: "The person behind the work.",
  openingTitleLines: ["The person", "behind", "the work."],
  openingBody: "I’m Bruno Florian — a software engineer and creative builder, drawn to the point where systems, music and expression meet.",
  continue: "Follow the score",
  codeLabel: "01 · CODE",
  codeTitle: "Give ideas a structure.",
  codeBody: "I turn product ideas and constraints into software people can use.",
  stackTitle: "The tools I work with",
  stackBody: "A practical stack, shaped by the problems I choose to solve.",
  musicLabel: "02 · MUSIC",
  musicTitle: "The piece keeps its own time.",
  musicBody: "Dissonância moves through the whole page. Scrolling changes the frame; the music keeps playing.",
  artLabel: "03 · ART",
  artTitle: "Structure can hold feeling.",
  artBody: "Visual art, poetry and literature share this space. The score stays present while its material changes.",
  artNote: "IMAGE · POETRY · LITERATURE",
  gamesLabel: "04 · GAMES",
  gamesTitle: "Play is another way to read a system.",
  gamesBody: "Games and chess bring strategy, patterns and a different kind of attention into the same practice.",
  explore: "Explore the world",
  worldTitle: "The Ancient Forest",
  worldBody: "A first look at the world around the purple knight. The game itself is a separate project.",
  closeWorld: "Return to the story",
  closingLabel: "05 · NEXT",
  closingTitle: "Ideas become real through the work.",
  projects: "Explore projects",
  contact: "Get in touch",
  listen: "Listen to Dissonância",
  pause: "Pause",
  off: "Sound off",
  unavailable: "Audio unavailable",
  movement: "Pause visual movement",
  movementOn: "Resume visual movement",
  mixer: "Track volume",
  chapter: "Chapter",
} : {
  openingEyebrow: "ABOUT · DISSONÂNCIA",
  openingTitle: "A pessoa por trás do trabalho.",
  openingTitleLines: ["A pessoa", "por trás", "do trabalho."],
  openingBody: "Sou Bruno Florian — engenheiro de software e criador, atraído pelo ponto em que sistemas, música e expressão se encontram.",
  continue: "Acompanhar a partitura",
  codeLabel: "01 · CÓDIGO",
  codeTitle: "Dar estrutura a uma ideia.",
  codeBody: "Transformo ideias de produto e restrições em software que as pessoas podem usar.",
  stackTitle: "As ferramentas que uso",
  stackBody: "Uma stack de trabalho, formada pelos problemas que escolho resolver.",
  musicLabel: "02 · MÚSICA",
  musicTitle: "A peça segue o próprio tempo.",
  musicBody: "Dissonância atravessa a página inteira. A rolagem muda o enquadramento; a música continua tocando.",
  artLabel: "03 · ARTE",
  artTitle: "Estrutura também pode guardar sentimento.",
  artBody: "Arte visual, poesia e literatura ocupam este espaço. A partitura continua presente enquanto sua matéria muda.",
  artNote: "IMAGEM · POESIA · LITERATURA",
  gamesLabel: "04 · JOGOS",
  gamesTitle: "Jogar também é ler um sistema.",
  gamesBody: "Jogos e xadrez trazem estratégia, padrões e outro tipo de atenção para a mesma prática.",
  explore: "Explorar o mundo",
  worldTitle: "Floresta Antiga",
  worldBody: "Um primeiro olhar para o mundo do cavaleiro roxo. O jogo em si é um projeto separado.",
  closeWorld: "Voltar à história",
  closingLabel: "05 · PRÓXIMOS PASSOS",
  closingTitle: "Ideias ganham forma com trabalho.",
  projects: "Conheça os projetos",
  contact: "Entre em contato",
  listen: "Ouvir Dissonância",
  pause: "Pausar",
  off: "Som desligado",
  unavailable: "Áudio indisponível",
  movement: "Pausar movimento visual",
  movementOn: "Retomar movimento visual",
  mixer: "Volume das pistas",
  chapter: "Capítulo",
};

const stackGroups = root.querySelector(".stack-groups")?.cloneNode(true);
const stackExtras = root.querySelector(".stack-more")?.cloneNode(true);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safe = value => escape(value).replaceAll("\n", "<br>");
const chapters = ["opening", "code", "music", "art", "games", "closing"];

root.classList.add("about-rebuild-v3");
root.replaceChildren();
root.insertAdjacentHTML("afterbegin", `
  <canvas class="about-v3-scene" data-score-scene aria-hidden="true"></canvas>
  <section class="about-v3-chapter about-v3-opening" id="opening" data-chapter="opening" aria-labelledby="about-v3-opening-title">
    <div class="about-v3-index"><span>01 / 06</span><span>DISSONÂNCIA · ${isEnglish ? "A PERSONAL SCORE" : "UMA PARTITURA PESSOAL"}</span></div>
    <div class="about-v3-opening-copy about-v3-reading">
      <p class="about-v3-eyebrow">${safe(copy.openingEyebrow)}</p>
      <h1 id="about-v3-opening-title" class="about-v3-fill about-v3-opening-title" data-fill-lines="${safe(copy.openingTitleLines.join("|"))}">${safe(copy.openingTitle)}</h1>
      <p class="about-v3-lead">${safe(copy.openingBody)}</p>
      <div class="about-v3-actions">
        <button class="about-v3-listen" type="button" data-play><span aria-hidden="true">▶</span><span data-play-label>${safe(copy.listen)}</span></button>
        <a href="#code" class="about-v3-link">${safe(copy.continue)} <span aria-hidden="true">↓</span></a>
      </div>
    </div>
    <p class="about-v3-signature">DISSONÂNCIA <span>·</span> 4:09</p>
  </section>

  <section class="about-v3-chapter about-v3-code" id="code" data-chapter="code" aria-labelledby="about-v3-code-title">
    <div class="about-v3-code-copy about-v3-reading">
      <p class="about-v3-eyebrow">${safe(copy.codeLabel)}</p>
      <h2 id="about-v3-code-title" class="about-v3-fill">${safe(copy.codeTitle)}</h2>
      <p>${safe(copy.codeBody)}</p>
    </div>
    <div class="about-v3-stack about-v3-reading">
      <div class="about-v3-stack-heading"><div><p class="about-v3-eyebrow">${safe(copy.stackTitle)}</p><p>${safe(copy.stackBody)}</p></div><span aria-hidden="true">STACK</span></div>
      <div class="about-v3-stack-groups"></div>
      <div class="about-v3-stack-extras"></div>
    </div>
  </section>

  <section class="about-v3-chapter about-v3-music" id="music" data-chapter="music" aria-labelledby="about-v3-music-title">
    <div class="about-v3-music-heading about-v3-reading">
      <div><p class="about-v3-eyebrow">${safe(copy.musicLabel)}</p><h2 id="about-v3-music-title" class="about-v3-fill">${safe(copy.musicTitle)}</h2></div>
      <p>${safe(copy.musicBody)}</p>
    </div>
    <div class="about-v3-music-caption about-v3-reading"><span>DISSONÂNCIA</span><span data-score-position>${isEnglish ? "MEASURES 33—35" : "COMPASSOS 33—35"}</span></div>
    <details class="about-v3-mixer about-v3-reading"><summary>${safe(copy.mixer)} <span aria-hidden="true">＋</span></summary><div class="about-v3-mixer-tracks"></div></details>
  </section>

  <section class="about-v3-chapter about-v3-art" id="art" data-chapter="art" aria-labelledby="about-v3-art-title">
    <div class="about-v3-art-image" data-art-image-wrap aria-hidden="true"><img src="/assets/about-legacy/illustrations/painted-clef.png" alt="" loading="lazy" decoding="async"></div>
    <div class="about-v3-art-copy about-v3-reading">
      <p class="about-v3-eyebrow">${safe(copy.artLabel)}</p>
      <h2 id="about-v3-art-title" class="about-v3-fill">${safe(copy.artTitle)}</h2>
      <p>${safe(copy.artBody)}</p>
      <span class="about-v3-art-note">${safe(copy.artNote)}</span>
    </div>
  </section>

  <section class="about-v3-chapter about-v3-games" id="games" data-chapter="games" aria-labelledby="about-v3-games-title">
    <div class="about-v3-games-copy about-v3-reading">
      <p class="about-v3-eyebrow">${safe(copy.gamesLabel)}</p>
      <h2 id="about-v3-games-title" class="about-v3-fill">${safe(copy.gamesTitle)}</h2>
      <p>${safe(copy.gamesBody)}</p>
      <button class="about-v3-link" type="button" data-world-open>${safe(copy.explore)} <span aria-hidden="true">↗</span></button>
    </div>
    <div class="about-v3-world about-v3-reading" aria-hidden="true">
      <picture><source media="(max-width: 700px)" srcset="/assets/about-legacy/forest/forest-world-portrait.png"><img src="/assets/about-legacy/forest/forest-world-wide.png" alt="" loading="lazy" decoding="async"></picture>
      <span class="about-v3-knight"></span>
      <span class="about-v3-world-caption">FLORESTA ANTIGA <i>·</i> 01</span>
    </div>
  </section>

  <section class="about-v3-chapter about-v3-closing" id="closing" data-chapter="closing" aria-labelledby="about-v3-closing-title">
    <div class="about-v3-closing-copy about-v3-reading">
      <p class="about-v3-eyebrow">${safe(copy.closingLabel)}</p>
      <h2 id="about-v3-closing-title" class="about-v3-fill">${safe(copy.closingTitle)}</h2>
      <nav aria-label="${isEnglish ? "Next steps" : "Próximos passos"}">
        <a href="${isEnglish ? "/en/projects/" : "/pt-br/projetos/"}">${safe(copy.projects)} <span aria-hidden="true">↗</span></a>
        <a href="${isEnglish ? "/en/contact/" : "/pt-br/contato/"}">${safe(copy.contact)} <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </section>

  <dialog class="about-v3-world-dialog" aria-labelledby="about-v3-world-title">
    <button class="about-v3-world-close" type="button" data-world-close aria-label="${safe(copy.closeWorld)}">×</button>
    <div class="about-v3-world-hero" aria-hidden="true"><picture><source media="(max-width: 700px)" srcset="/assets/about-legacy/forest/forest-world-portrait.png"><img src="/assets/about-legacy/forest/forest-world-wide.png" alt="" decoding="async"></picture><span class="about-v3-knight"></span></div>
    <div class="about-v3-world-dialog-copy"><p class="about-v3-eyebrow">GAMES · ${isEnglish ? "WORLD STUDY" : "ESTUDO DE MUNDO"}</p><h2 id="about-v3-world-title">${safe(copy.worldTitle)}</h2><p>${safe(copy.worldBody)}</p><button class="about-v3-link" type="button" data-world-close>${safe(copy.closeWorld)} <span aria-hidden="true">↗</span></button></div>
  </dialog>

  <nav class="about-v3-dock" aria-label="${isEnglish ? "About chapters and audio" : "Capítulos e áudio do About"}" data-dock>
    <div class="about-v3-chapter-nav">${chapters.map((id, index) => `<a href="#${id}" aria-label="${safe(copy.chapter)} ${index + 1}">${String(index + 1).padStart(2, "0")}</a>`).join("")}</div>
    <button class="about-v3-dock-play" type="button" data-play aria-label="${safe(copy.listen)}"><span aria-hidden="true">▶</span><span data-play-label>${safe(copy.listen)}</span></button>
    <span class="about-v3-dock-status" data-play-state>${safe(copy.off)}</span>
    <button class="about-v3-motion" type="button" data-motion aria-label="${safe(copy.movement)}" aria-pressed="false"><span aria-hidden="true">◌</span></button>
  </nav>
`);

if (stackGroups) root.querySelector(".about-v3-stack-groups")?.append(stackGroups);
if (stackExtras) root.querySelector(".about-v3-stack-extras")?.append(stackExtras);

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./style.css?about-rebuild-2", import.meta.url).href;
document.head.append(stylesheet);

for (const link of document.querySelectorAll("[data-locale-choice]")) {
  const target = new URL(link.href);
  target.searchParams.set("about-rebuild", "fresh");
  link.href = target.href;
}

for (const heading of root.querySelectorAll(".about-v3-fill")) {
  const lines = heading.dataset.fillLines?.split("|") ?? [heading.textContent.trim()];
  heading.replaceChildren(...lines.map(line => {
    const lineElement = document.createElement("span");
    lineElement.className = "about-v3-line";
    const words = line.split(/\s+/u);
    lineElement.append(...words.map((word, index) => {
      const span = document.createElement("span");
      span.className = "about-v3-word";
      span.textContent = word + (index < words.length - 1 ? " " : "");
      return span;
    }));
    return lineElement;
  }));
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let visualPaused = document.documentElement.dataset.motionPaused === "true";
let audio;
let activeChapter = "opening";
let raf = 0;
let centers = [];
let frozenSceneFrame = null;
const sectionNodes = [...root.querySelectorAll("[data-chapter]")];
const scene = mountScoreScene(root.querySelector("[data-score-scene]"), score);

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }

function updatePlaybackUI(state = audio?.snapshot?.()) {
  if (!state) return;
  const playing = state.state === "playing" || state.state === "starting";
  root.querySelectorAll("[data-play]").forEach(button => {
    const icon = button.querySelector("[aria-hidden]");
    const label = button.querySelector("[data-play-label]");
    if (icon) icon.textContent = playing ? "Ⅱ" : "▶";
    if (label) label.textContent = playing ? copy.pause : copy.listen;
    button.setAttribute("aria-label", playing ? copy.pause : copy.listen);
    button.setAttribute("aria-pressed", String(playing));
  });
  const status = root.querySelector("[data-play-state]");
  if (status) status.textContent = state.state === "playing" ? `${state.section} · ${formatTime(state.seconds)}`
    : ["error", "unavailable"].includes(state.state) ? copy.unavailable : copy.off;
}

function mountAudio() {
  audio = createJourneyAudio(score, state => {
    updatePlaybackUI(state);
    requestFrame();
  });
  root.querySelectorAll("[data-play]").forEach(button => button.addEventListener("click", () => {
    if (audio.playing) audio.pause();
    else audio.start();
    updatePlaybackUI();
    requestFrame();
  }));

  const mixer = root.querySelector(".about-v3-mixer-tracks");
  for (const track of score.tracks) {
    const row = document.createElement("label");
    row.className = "about-v3-mixer-row";
    const name = document.createElement("span");
    name.textContent = track.name;
    const output = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = ".01";
    input.value = String(audio.getTrackVolume(track.id) ?? .5);
    output.value = `${Math.round(Number(input.value) * 100)}%`;
    input.setAttribute("aria-label", `${track.name} · ${copy.mixer}`);
    input.addEventListener("input", () => {
      const volume = Number(input.value);
      output.value = `${Math.round(volume * 100)}%`;
      audio.setTrackVolume(track.id, volume);
    });
    row.append(name, input, output);
    mixer.append(row);
  }
  updatePlaybackUI();
}

function updateFill() {
  for (const heading of root.querySelectorAll(".about-v3-fill")) {
    const progress = clamp((window.innerHeight * .86 - heading.getBoundingClientRect().top) / (window.innerHeight * .46));
    heading.querySelectorAll(".about-v3-word").forEach((word, index, words) => {
      word.style.setProperty("--fill", `${clamp(progress * words.length - index) * 100}%`);
    });
  }
}

function measure() {
  centers = sectionNodes.map(section => section.getBoundingClientRect().top + window.scrollY + section.offsetHeight * .52);
}

function paintFrame() {
  raf = 0;
  if (!centers.length) measure();
  const readLine = window.scrollY + window.innerHeight * .52;
  let index = 0;
  while (index < centers.length - 1 && readLine >= centers[index + 1]) index += 1;
  const next = Math.min(index + 1, centers.length - 1);
  const local = next === index ? 0 : clamp((readLine - centers[index]) / (centers[next] - centers[index]));
  const journey = index + local;
  const chapter = sectionNodes[index]?.dataset.chapter ?? "opening";
  if (chapter !== activeChapter) {
    activeChapter = chapter;
    audio?.setMovement(chapter);
    root.dataset.activeChapter = chapter;
  }

  const snapshot = audio?.snapshot?.() ?? { state: "off", beat: 132, seconds: 0, section: "Verso I" };
  const sceneFrame = {
    journey,
    beat: snapshot.beat,
    playing: snapshot.state === "playing",
    motionReduced: reducedMotion.matches,
    time: snapshot.seconds,
    viewportWidth: window.innerWidth,
  };

  if (visualPaused) {
    frozenSceneFrame ??= sceneFrame;
    scene.update({ ...frozenSceneFrame, paused: true });
  } else {
    frozenSceneFrame = null;
    scene.update(sceneFrame);
  }

  const artImage = root.querySelector("[data-art-image-wrap]");
  if (artImage && !visualPaused) {
    const artSection = root.querySelector('[data-chapter="art"]');
    const rect = artSection.getBoundingClientRect();
    const offset = clamp((window.innerHeight * .5 - (rect.top + rect.height * .5)) / window.innerHeight, -1, 1);
    artImage.style.setProperty("--art-parallax", `${offset * 28}px`);
  }
  updateFill();

  const dock = root.querySelector("[data-dock]");
  dock.toggleAttribute("data-visible", window.scrollY > window.innerHeight * .55);
  const position = root.querySelector("[data-score-position]");
  if (position && activeChapter === "music") {
    const beat = snapshot.state === "playing" ? snapshot.beat : 132;
    const bar = Math.floor(beat / score.beatsPerBar) + 1;
    position.textContent = isEnglish ? `MEASURE ${bar}` : `COMPASSO ${bar}`;
  }

  if (audio?.playing && !document.hidden) requestFrame();
}

function requestFrame() { if (!raf) raf = requestAnimationFrame(paintFrame); }

mountAudio();
measure();
const resizeObserver = new ResizeObserver(() => { measure();requestFrame(); });
sectionNodes.forEach(section => resizeObserver.observe(section));
root.querySelector(".stack-more details")?.addEventListener("toggle", () => { measure();requestFrame(); });
window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", () => { measure();requestFrame(); }, { passive: true });
document.fonts?.ready.then(() => { measure();requestFrame(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio?.pause();
  else requestFrame();
});

const motionButton = root.querySelector("[data-motion]");
motionButton.setAttribute("aria-label", visualPaused ? copy.movementOn : copy.movement);
motionButton.setAttribute("aria-pressed", String(visualPaused));
motionButton.addEventListener("click", () => {
  visualPaused = !visualPaused;
  if (!visualPaused) frozenSceneFrame = null;
  document.documentElement.dataset.motionPaused = String(visualPaused);
  motionButton.setAttribute("aria-label", visualPaused ? copy.movementOn : copy.movement);
  motionButton.setAttribute("aria-pressed", String(visualPaused));
  requestFrame();
});

const worldDialog = root.querySelector(".about-v3-world-dialog");
const worldOpener = root.querySelector("[data-world-open]");
worldOpener.addEventListener("click", () => worldDialog.showModal());
root.querySelectorAll("[data-world-close]").forEach(button => button.addEventListener("click", () => worldDialog.close()));
worldDialog.addEventListener("click", event => { if (event.target === worldDialog) worldDialog.close(); });
worldDialog.addEventListener("close", () => worldOpener.focus({ preventScroll: true }));

const navLinks = [...root.querySelectorAll(".about-v3-chapter-nav a")];
const chapterObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const index = sectionNodes.indexOf(entry.target);
    navLinks.forEach((link, linkIndex) => {
      if (index === linkIndex) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
}, { rootMargin: "-38% 0px -52% 0px", threshold: 0 });
sectionNodes.forEach(section => chapterObserver.observe(section));

if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" }));
requestFrame();

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  resizeObserver.disconnect();
  chapterObserver.disconnect();
  scene.dispose();
  audio.dispose();
  stylesheet.remove();
}, { once: true });
