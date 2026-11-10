import { createJourneyAudio } from "../audio.js";
import { mountChapterIllustrations } from "../chapter-illustrations.js";
import { score } from "../score.js";
import { SCORE_CAMERA_POSE_STOPS, createScoreCurve, createScoreJourneyCurve } from "../score-camera-journey.js";

const root = document.querySelector(".about-main");
if (!root) throw new Error("About mount point is missing");

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./style.css?clean-2", import.meta.url).href;
document.head.append(stylesheet);

const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
const copy = isEnglish ? {
  index: "ABOUT · A PERSONAL SCORE",
  openingTitle: "The person behind the work.",
  openingBody: "I’m Bruno Florian — a software engineer and creative builder, drawn to the point where systems, music and expression meet.",
  listen: "Listen to Dissonância",
  continue: "Follow the story",
  codeEyebrow: "01 · CODE",
  codeTitle: "Give ideas a structure.",
  codeBody: "I turn product ideas and constraints into software people can use.",
  codeNote: "Each technical choice begins with the experience it needs to support.",
  stackTitle: "The tools I work with",
  stackBody: "A practical stack, shaped by the problems I choose to solve.",
  musicEyebrow: "02 · MUSIC",
  musicTitle: "The piece keeps its own time.",
  musicBody: "Dissonância moves through the whole page. Scrolling changes the frame; the music keeps playing in real time.",
  artEyebrow: "03 · ART",
  artTitle: "Structure can hold feeling.",
  artBody: "Visual art, poetry and literature share this part of the page. The score stays recognizable while its material changes.",
  artWords: "IMAGE · POETRY · LITERATURE",
  gamesEyebrow: "04 · GAMES",
  gamesTitle: "Play is another way to read a system.",
  gamesBody: "Games and chess bring strategy, patterns and a different kind of attention into the same practice.",
  explore: "Explore the world",
  worldTitle: "The Ancient Forest",
  worldBody: "A first look at the world around the purple knight. The game itself is a separate project.",
  closeWorld: "Return to the story",
  endingEyebrow: "05 · NEXT",
  endingTitle: "Ideas become real through the work.",
  projects: "Explore projects",
  contact: "Get in touch",
  pause: "Pause",
  resume: "Continue",
  off: "Sound off",
  movement: "Pause visual movement",
  movementOn: "Resume visual movement",
  mixer: "Track volume",
  bar: "bar",
  bars: "bars",
  preview: "Score preview",
  unavailable: "Audio unavailable",
} : {
  index: "ABOUT · UMA PARTITURA PESSOAL",
  openingTitle: "A pessoa por trás do trabalho.",
  openingBody: "Sou Bruno Florian — engenheiro de software e criador, atraído pelo ponto em que sistemas, música e expressão se encontram.",
  listen: "Ouvir Dissonância",
  continue: "Acompanhar a história",
  codeEyebrow: "01 · CÓDIGO",
  codeTitle: "Dar estrutura a uma ideia.",
  codeBody: "Transformo ideias de produto e restrições em software que as pessoas podem usar.",
  codeNote: "Cada escolha técnica começa pela experiência que precisa existir.",
  stackTitle: "As ferramentas que uso",
  stackBody: "Uma stack de trabalho, formada pelos problemas que escolho resolver.",
  musicEyebrow: "02 · MÚSICA",
  musicTitle: "A peça segue o próprio tempo.",
  musicBody: "Dissonância atravessa a página inteira. A rolagem muda o enquadramento; a música continua tocando em tempo real.",
  artEyebrow: "03 · ARTE",
  artTitle: "Estrutura também pode guardar sentimento.",
  artBody: "Arte visual, poesia e literatura ocupam esta parte da página. A partitura continua reconhecível enquanto sua matéria muda.",
  artWords: "IMAGEM · POESIA · LITERATURA",
  gamesEyebrow: "04 · JOGOS",
  gamesTitle: "Jogar também é ler um sistema.",
  gamesBody: "Jogos e xadrez trazem estratégia, padrões e outro tipo de atenção para a mesma prática.",
  explore: "Explorar o mundo",
  worldTitle: "Floresta Antiga",
  worldBody: "Um primeiro olhar para o mundo do cavaleiro roxo. O jogo em si é um projeto separado.",
  closeWorld: "Voltar à história",
  endingEyebrow: "05 · PRÓXIMOS PASSOS",
  endingTitle: "Ideias ganham forma com trabalho.",
  projects: "Conheça os projetos",
  contact: "Entre em contato",
  pause: "Pausar",
  resume: "Continuar",
  off: "Som desligado",
  movement: "Pausar movimento visual",
  movementOn: "Retomar movimento visual",
  mixer: "Volume das pistas",
  bar: "compasso",
  bars: "compassos",
  preview: "Prévia da partitura",
  unavailable: "Áudio indisponível",
};

const stackGroups = root.querySelector(".stack-groups")?.cloneNode(true);
const stackExtras = root.querySelector(".stack-more")?.cloneNode(true);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const html = value => escape(value).replaceAll("\n", "<br>");
root.classList.add("about-rebuild-clean");
root.replaceChildren();
root.insertAdjacentHTML("afterbegin", `
  <div class="about-score-thread" data-score-thread aria-hidden="true"></div>
  <section class="clean-chapter clean-opening" id="opening" data-movement="opening" aria-labelledby="clean-opening-title">
    <div class="clean-opening-index"><span>01 / 06</span><span>${html(copy.index)}</span></div>
    <div class="clean-opening-copy clean-reading">
      <p class="clean-eyebrow">ABOUT · DISSONÂNCIA</p>
      <h1 id="clean-opening-title" class="clean-fill">${html(copy.openingTitle)}</h1>
      <p class="clean-lead">${html(copy.openingBody)}</p>
      <div class="clean-actions">
        <button class="clean-listen" type="button" data-play><span aria-hidden="true">▶</span><span data-play-label>${html(copy.listen)}</span></button>
        <a class="clean-text-link" href="#code">${html(copy.continue)} <span aria-hidden="true">↓</span></a>
      </div>
    </div>
    <p class="clean-opening-caption">DISSONÂNCIA <span>·</span> 4:09</p>
  </section>

  <section class="clean-chapter clean-code" id="code" data-movement="code" aria-labelledby="clean-code-title">
    <div class="clean-code-illustration code-score-anchor" aria-hidden="true"></div>
    <div class="clean-code-copy clean-reading">
      <p class="clean-eyebrow">${html(copy.codeEyebrow)}</p>
      <h2 id="clean-code-title" class="clean-fill">${html(copy.codeTitle)}</h2>
      <p>${html(copy.codeBody)}</p>
      <span class="clean-rule" aria-hidden="true"></span>
      <p class="clean-code-note">${html(copy.codeNote)}</p>
    </div>
    <div class="clean-stack clean-reading">
      <div class="clean-stack-heading"><div><p class="clean-eyebrow">${html(copy.stackTitle)}</p><p>${html(copy.stackBody)}</p></div><span aria-hidden="true">01—33</span></div>
      <div class="clean-stack-groups"></div>
      <div class="clean-stack-extras"></div>
    </div>
  </section>

  <section class="clean-chapter clean-music" id="music" data-movement="music" aria-labelledby="clean-music-title">
    <div class="clean-music-heading clean-reading">
      <div><p class="clean-eyebrow">${html(copy.musicEyebrow)}</p><h2 id="clean-music-title" class="clean-fill">${html(copy.musicTitle)}</h2></div>
      <p>${html(copy.musicBody)}</p>
    </div>
    <div class="clean-music-stage" aria-hidden="true"><span>DISSONÂNCIA</span><span data-score-window></span></div>
    <details class="clean-mixer clean-reading"><summary>${html(copy.mixer)} <span aria-hidden="true">＋</span></summary><div class="clean-mixer-sliders"></div></details>
  </section>

  <section class="clean-chapter clean-art" id="art" data-movement="art" aria-labelledby="clean-art-title">
    <div class="clean-art-field art-score-anchor" aria-hidden="true"><span>${html(copy.artWords)}</span></div>
    <div class="clean-art-copy clean-reading">
      <p class="clean-eyebrow">${html(copy.artEyebrow)}</p>
      <h2 id="clean-art-title" class="clean-fill">${html(copy.artTitle)}</h2>
      <p>${html(copy.artBody)}</p>
    </div>
  </section>

  <section class="clean-chapter clean-games" id="games" data-movement="games" aria-labelledby="clean-games-title">
    <div class="clean-game-stage" aria-hidden="true">
      <picture class="clean-world-landscape">
        <source media="(max-width: 700px)" srcset="/assets/about-legacy/forest/forest-world-portrait.png">
        <img src="/assets/about-legacy/forest/forest-world-wide.png" alt="" loading="lazy" decoding="async">
      </picture>
      <span class="clean-pixel-knight"></span>
    </div>
    <div class="clean-games-copy clean-reading">
      <p class="clean-eyebrow">${html(copy.gamesEyebrow)}</p>
      <h2 id="clean-games-title" class="clean-fill">${html(copy.gamesTitle)}</h2>
      <p>${html(copy.gamesBody)}</p>
      <button class="clean-text-link clean-world-open" type="button" data-world-open>${html(copy.explore)} <span aria-hidden="true">↗</span></button>
    </div>
  </section>

  <section class="clean-chapter clean-ending" id="closing" data-movement="closing" aria-labelledby="clean-ending-title">
    <div class="clean-ending-copy clean-reading">
      <p class="clean-eyebrow">${html(copy.endingEyebrow)}</p>
      <h2 id="clean-ending-title" class="clean-fill">${html(copy.endingTitle)}</h2>
      <nav aria-label="${isEnglish ? "Next steps" : "Próximos passos"}">
        <a href="${isEnglish ? "/en/projects/" : "/pt-br/projetos/"}">${html(copy.projects)} <span aria-hidden="true">↗</span></a>
        <a href="${isEnglish ? "/en/contact/" : "/pt-br/contato/"}">${html(copy.contact)} <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </section>

  <dialog class="clean-world" aria-labelledby="clean-world-title">
    <button class="clean-world-close" type="button" data-world-close aria-label="${escape(copy.closeWorld)}">×</button>
    <div class="clean-world-stage" aria-hidden="true">
      <picture class="clean-world-landscape">
        <source media="(max-width: 700px)" srcset="/assets/about-legacy/forest/forest-world-portrait.png">
        <img src="/assets/about-legacy/forest/forest-world-wide.png" alt="" decoding="async">
      </picture>
      <span class="clean-pixel-knight"></span>
    </div>
    <div class="clean-world-copy"><p class="clean-eyebrow">GAMES · ${isEnglish ? "WORLD STUDY" : "ESTUDO DE MUNDO"}</p><h2 id="clean-world-title">${html(copy.worldTitle)}</h2><p>${html(copy.worldBody)}</p><button class="clean-text-link" type="button" data-world-close>${html(copy.closeWorld)} <span aria-hidden="true">↗</span></button></div>
  </dialog>

  <nav class="clean-dock" aria-label="${isEnglish ? "About chapters and audio" : "Capítulos e áudio do About"}" data-dock>
    <div class="clean-chapter-nav">${["opening", "code", "music", "art", "games", "closing"].map((id, index) => `<a href="#${id}" aria-label="${isEnglish ? "Chapter" : "Capítulo"} ${index + 1}">${String(index + 1).padStart(2, "0")}</a>`).join("")}</div>
    <button class="clean-dock-play" type="button" data-play aria-label="${escape(copy.listen)}"><span aria-hidden="true">▶</span><span data-play-label>${html(copy.listen)}</span></button>
    <span class="clean-dock-state" data-play-state>${html(copy.off)}</span>
    <button class="clean-motion" type="button" aria-label="${escape(copy.movement)}" aria-pressed="false" data-motion><span aria-hidden="true">◌</span></button>
  </nav>
`);

const disposeChapterIllustrations = mountChapterIllustrations(root);
if (stackGroups) root.querySelector(".clean-stack-groups").append(stackGroups);
if (stackExtras) root.querySelector(".clean-stack-extras").append(stackExtras);

for (const link of document.querySelectorAll("[data-locale-choice]")) {
  const target = new URL(link.href);
  target.searchParams.set("about-rebuild", "fresh");
  link.href = target.href;
}

for (const heading of root.querySelectorAll(".clean-fill")) {
  const words = heading.textContent.trim().split(/\s+/u);
  heading.replaceChildren(...words.map((word, index) => {
    const span = document.createElement("span");
    span.className = "clean-fill-word";
    span.textContent = word + (index < words.length - 1 ? " " : "");
    return span;
  }));
}

const chapters = [...root.querySelectorAll("[data-movement]")];
const codeIllustration = root.querySelector(".clean-code-illustration");
const artIllustration = root.querySelector(".clean-art-field");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
if (reduceMotion.matches) document.documentElement.dataset.motionReduced = "true";
let motionPaused = document.documentElement.dataset.motionPaused === "true";
let audio;
let scoreRuntime;
let frameId = 0;
let resizeObserver;
let chapterCenters = [];
let poseCurve;
let zoomCurve;
let journeyCurve;
let activeChapter = "opening";
const readLineRatio = .52;

function measureJourney() {
  chapterCenters = chapters.map(chapter => chapter.getBoundingClientRect().top + window.scrollY + chapter.offsetHeight * readLineRatio);
  const mobile = window.innerWidth <= 700;
  const poseStops = mobile
    ? [SCORE_CAMERA_POSE_STOPS.mobile[0], SCORE_CAMERA_POSE_STOPS.mobile[1], SCORE_CAMERA_POSE_STOPS.mobile[2], .46, SCORE_CAMERA_POSE_STOPS.mobile[4], SCORE_CAMERA_POSE_STOPS.mobile[5]]
    : [SCORE_CAMERA_POSE_STOPS.desktop[0], SCORE_CAMERA_POSE_STOPS.desktop[1], SCORE_CAMERA_POSE_STOPS.desktop[2], .52, SCORE_CAMERA_POSE_STOPS.desktop[4], SCORE_CAMERA_POSE_STOPS.desktop[5]];
  const zoomStops = mobile ? [.76, .82, 2.12, 1.08, .72, .7] : [.68, .72, .96, 1.02, .69, .66];
  poseCurve = createScoreCurve(chapterCenters, poseStops);
  zoomCurve = createScoreCurve(chapterCenters, zoomStops);
  journeyCurve = createScoreJourneyCurve(chapterCenters);
}

function updateHeadlines() {
  for (const heading of root.querySelectorAll(".clean-fill")) {
    const progress = Math.max(0, Math.min(1, (.84 * window.innerHeight - heading.getBoundingClientRect().top) / (window.innerHeight * .5)));
    heading.querySelectorAll(".clean-fill-word").forEach((word, index, all) => {
      word.style.setProperty("--word-fill", `${Math.max(0, Math.min(1, progress * all.length - index)) * 100}%`);
    });
  }
}

function updateChapterMaterials(journeyPosition) {
  const codeProgress = Math.max(0, Math.min(1, journeyPosition / 2));
  const codePresence = Math.sin(codeProgress * Math.PI);
  codeIllustration?.style.setProperty("--code-presence", codePresence.toFixed(3));

  const artProgress = Math.max(0, Math.min(1, (journeyPosition - 2) / 2));
  const artPresence = Math.min(
    Math.max(0, Math.min(1, journeyPosition - 2)),
    Math.max(0, Math.min(1, 4 - journeyPosition)),
  );
  artIllustration?.style.setProperty("--about-paint-reveal", `${Math.round(artPresence * 100)}%`);
  const parallax = motionPaused || reduceMotion.matches ? 0 : -24 * Math.sin(artProgress * Math.PI);
  artIllustration?.style.setProperty("--about-art-image-offset", `${parallax.toFixed(1)}px`);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

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

function paintFrame(timestamp) {
  frameId = 0;
  if (!chapterCenters.length) measureJourney();
  updateHeadlines();

  const readingLine = window.scrollY + window.innerHeight * readLineRatio;
  const journey = journeyCurve(readingLine);
  const journeyPosition = journey.index + journey.progress;
  updateChapterMaterials(journeyPosition);
  const cameraPose = poseCurve(readingLine).value;
  const zoom = zoomCurve(readingLine).value;
  let chapterIndex = 0;
  for (let index = 1; index < chapterCenters.length; index += 1) {
    if (readingLine >= chapterCenters[index]) chapterIndex = index;
  }
  const chapter = chapters[chapterIndex].dataset.movement;
  if (chapter !== activeChapter) {
    activeChapter = chapter;
    root.dataset.activeMovement = chapter;
    audio?.setMovement?.(chapter);
  }

  const playbackSnapshot = audio?.snapshot?.() ?? null;
  const paused = motionPaused || reduceMotion.matches;
  const scoreFrame = scoreRuntime?.update({
    chapter,
    journey: journeyPosition,
    pose: cameraPose,
    zoom,
    frameOffset: { x: 0, y: 0 },
    motionEnabled: !paused,
    reducedMotion: reduceMotion.matches,
    playbackSnapshot,
    timestamp,
  });

  const dock = root.querySelector("[data-dock]");
  const opening = root.querySelector("#opening");
  dock.toggleAttribute("data-visible", opening.getBoundingClientRect().bottom < 104);
  const windowLabel = root.querySelector("[data-score-window]");
  if (windowLabel && chapter === "music") {
    if (scoreFrame) {
      const range = scoreFrame.firstBar === scoreFrame.lastBar ? `${copy.bar} ${scoreFrame.firstBar}` : `${copy.bars} ${scoreFrame.firstBar}–${scoreFrame.lastBar}`;
      windowLabel.textContent = scoreFrame.playbackActive ? range : `${copy.preview} · ${range}`;
    }
  }

  if (audio?.playing && !document.hidden) requestFrame();
}

function requestFrame() {
  if (!frameId) frameId = requestAnimationFrame(paintFrame);
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

  const mixer = root.querySelector(".clean-mixer-sliders");
  for (const track of score.tracks) {
    const label = document.createElement("label");
    label.className = "clean-mixer-row";
    const name = document.createElement("span");
    name.textContent = track.name;
    const value = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = ".01";
    input.value = String(audio.getTrackVolume(track.id) ?? .5);
    value.value = `${Math.round(Number(input.value) * 100)}%`;
    input.setAttribute("aria-label", `${track.name} ${copy.mixer}`);
    input.addEventListener("input", () => {
      const volume = Number(input.value);
      value.value = `${Math.round(volume * 100)}%`;
      audio.setTrackVolume(track.id, volume);
    });
    label.append(name, input, value);
    mixer.append(label);
  }
  updatePlaybackUI();
}

mountAudio();

const motionButton = root.querySelector("[data-motion]");
motionButton.setAttribute("aria-label", motionPaused ? copy.movementOn : copy.movement);
motionButton.setAttribute("aria-pressed", String(motionPaused));
motionButton.addEventListener("click", () => {
  motionPaused = !motionPaused;
  document.documentElement.dataset.motionPaused = String(motionPaused);
  motionButton.setAttribute("aria-label", motionPaused ? copy.movementOn : copy.movement);
  motionButton.setAttribute("aria-pressed", String(motionPaused));
  requestFrame();
});

const world = root.querySelector(".clean-world");
const worldOpener = root.querySelector("[data-world-open]");
worldOpener.addEventListener("click", () => world.showModal());
root.querySelectorAll("[data-world-close]").forEach(button => button.addEventListener("click", () => world.close()));
world.addEventListener("click", event => { if (event.target === world) world.close(); });
world.addEventListener("close", () => worldOpener.focus({ preventScroll: true }));

measureJourney();
resizeObserver = new ResizeObserver(() => { measureJourney();requestFrame(); });
chapters.forEach(chapter => resizeObserver.observe(chapter));
root.querySelector(".stack-more details")?.addEventListener("toggle", () => { measureJourney();requestFrame(); });
window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", () => { measureJourney();requestFrame(); }, { passive: true });
document.fonts?.ready.then(() => { measureJourney();requestFrame(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  else requestFrame();
});

import("../score-gpu-scroll.js?clean-about-1").then(module => module.mountAboutGpuScroll(root)).then(runtime => {
  scoreRuntime = runtime;
  measureJourney();
  requestFrame();
}).catch(error => console.error("The About score scene could not be mounted.", error));

if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" }));

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  disposeChapterIllustrations();
  scoreRuntime?.dispose();
  audio.dispose();
  stylesheet.remove();
}, { once: true });
