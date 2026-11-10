import { createJourneyAudio } from "../audio.js";
import { score } from "../score.js";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./style.css?v=17", import.meta.url).href;
document.head.append(stylesheet);

const root = document.querySelector(".about-main");
if (!root) throw new Error("About mount point is missing");

const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
const source = {
  stack: root.querySelector(".stack-groups")?.cloneNode(true),
  extras: root.querySelector(".stack-more")?.cloneNode(true),
};

const copy = isEnglish ? {
  index: "A personal score · 01—06",
  openingKicker: "Different languages.\nThe same restless mind.",
  openingTitle: "The person behind the work.",
  openingBody: "I’m Bruno Florian. Code, music, art — and a curiosity that connects them all.",
  enter: "Follow the score",
  openingNote: "A composition in motion",
  codeKicker: "01 / Structure",
  codeTitle: "Give an idea a structure.",
  codeBody: "I turn product ideas into software across frontend, backend, data and AI.",
  stackTitle: "Tools I build with",
  stackBody: "A working stack, gathered around the problems I like to solve.",
  codeAside: "Patterns become paths. Paths become something people can use.",
  musicKicker: "02 / The piece",
  musicTitle: "Some things have to be felt.",
  musicBody: "Dissonância moves through verses, bridges and refrains while the page changes around it.",
  listen: "Listen to Dissonância",
  pause: "Pause",
  continue: "Continue",
  chapter: "Chapter",
  volume: "Master volume",
  layers: "Layers",
  artKicker: "03 / Expression",
  artTitle: "Between words, another world.",
  artBody: "Poetry, literature and visual art share this space. The same words can breathe differently when the rhythm changes.",
  poem: "Between one idea\nand the next,\nsilence creates too.",
  artNote: "A replaceable image layer — the painting remains its own material.",
  gamesKicker: "04 / Play",
  gamesTitle: "Play is another way to think.",
  gamesBody: "Games and chess belong here too: strategy, pattern reading and new perspectives.",
  explore: "Explore the world",
  worldTitle: "The Ancient Forest",
  worldBody: "A small window into the world of the purple knight. The game itself comes later.",
  closeWorld: "Return to the story",
  endingKicker: "05 / What comes next",
  endingTitle: "Ideas become more interesting when they become real.",
  projects: "Explore projects",
  contact: "Get in touch",
  movement: "Pause visual movement",
  movementOn: "Resume visual movement",
  soundOff: "Sound is off",
  scoreBy: "Dissonância · original composition",
} : {
  index: "Uma partitura pessoal · 01—06",
  openingKicker: "Linguagens diferentes.\nA mesma inquietude.",
  openingTitle: "A pessoa por trás do trabalho.",
  openingBody: "Sou Bruno Florian. Código, música, arte e uma curiosidade que conecta tudo isso.",
  enter: "Acompanhar a partitura",
  openingNote: "Uma composição em movimento",
  codeKicker: "01 / Estrutura",
  codeTitle: "Dar estrutura a uma ideia.",
  codeBody: "Transformo ideias de produto em software entre frontend, backend, dados e IA.",
  stackTitle: "Ferramentas que uso",
  stackBody: "Uma stack de trabalho reunida em torno dos problemas que gosto de resolver.",
  codeAside: "Padrões viram caminhos. Caminhos viram algo que as pessoas podem usar.",
  musicKicker: "02 / A peça",
  musicTitle: "Tem coisa que precisa ser sentida.",
  musicBody: "Dissonância percorre versos, pontes e refrões enquanto esta página muda ao seu redor.",
  listen: "Ouvir Dissonância",
  pause: "Pausar",
  continue: "Continuar",
  chapter: "Parte",
  volume: "Volume geral",
  layers: "Camadas",
  artKicker: "03 / Expressão",
  artTitle: "Entre as palavras, outro mundo.",
  artBody: "Poesia, literatura e arte visual dividem este espaço. As mesmas palavras podem respirar de outro jeito quando o ritmo muda.",
  poem: "Entre uma ideia\ne outra,\no silêncio também cria.",
  artNote: "Uma camada de imagem substituível — a pintura preserva sua própria matéria.",
  gamesKicker: "04 / Jogo",
  gamesTitle: "Jogar também é pensar.",
  gamesBody: "Jogos e xadrez também têm seu lugar: estratégia, leitura de padrões e novas perspectivas.",
  explore: "Explorar o mundo",
  worldTitle: "Floresta Antiga",
  worldBody: "Uma janela para o mundo do cavaleiro roxo. O jogo em si vem depois.",
  closeWorld: "Voltar à história",
  endingKicker: "05 / O que vem depois",
  endingTitle: "As ideias ficam mais interessantes quando se tornam reais.",
  projects: "Conheça os projetos",
  contact: "Vamos conversar",
  movement: "Pausar movimento visual",
  movementOn: "Retomar movimento visual",
  soundOff: "Som desligado",
  scoreBy: "Dissonância · composição original",
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

const text = value => esc(value).replaceAll("\n", "<br>");
const staffSvg = `
  <svg class="rebuild-staff" viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="staff-ink" x1="0" x2="1"><stop stop-color="#61a9ff" stop-opacity=".08"/><stop offset=".46" stop-color="#bd87ff" stop-opacity=".58"/><stop offset="1" stop-color="#6aa8ff" stop-opacity=".14"/></linearGradient>
      <linearGradient id="staff-note" x1="0" x2="1"><stop stop-color="#66bdff"/><stop offset=".55" stop-color="#b994ff"/><stop offset="1" stop-color="#e3c6ff"/></linearGradient>
      <filter id="staff-glow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g class="staff-lines" fill="none" stroke="url(#staff-ink)" stroke-width="1.5">
      <path d="M0 105 C210 40 344 145 525 92 S880 56 1200 126"/><path d="M0 130 C210 65 344 170 525 117 S880 81 1200 151"/><path d="M0 155 C210 90 344 195 525 142 S880 106 1200 176"/><path d="M0 180 C210 115 344 220 525 167 S880 131 1200 201"/><path d="M0 205 C210 140 344 245 525 192 S880 156 1200 226"/>
    </g>
    <g class="staff-notes" fill="url(#staff-note)" filter="url(#staff-glow)">
      <ellipse cx="115" cy="172" rx="10" ry="6"/><ellipse cx="244" cy="143" rx="10" ry="6"/><ellipse cx="388" cy="191" rx="10" ry="6"/><ellipse cx="541" cy="155" rx="10" ry="6"/><ellipse cx="698" cy="111" rx="10" ry="6"/><ellipse cx="864" cy="132" rx="10" ry="6"/><ellipse cx="1014" cy="183" rx="10" ry="6"/>
    </g>
    <path class="staff-voice" d="M0 172 C205 102 324 194 518 155 S824 88 1200 164" fill="none" stroke="#78baff" stroke-width="2" opacity=".48"/>
    <path class="staff-voice staff-voice-violet" d="M0 188 C197 135 342 218 522 180 S850 112 1200 192" fill="none" stroke="#c99cff" stroke-width="2" opacity=".5"/>
  </svg>`;

const sections = `
  <div class="rebuild-progress" aria-hidden="true"><span></span></div>
  <section class="rebuild-opening" id="opening" aria-labelledby="rebuild-title" data-rebuild-chapter="opening">
    <div class="opening-orbit opening-orbit-one" aria-hidden="true"></div><div class="opening-orbit opening-orbit-two" aria-hidden="true"></div>
    <div class="opening-score" aria-hidden="true">${staffSvg}<span class="opening-clef">𝄞</span></div>
    <div class="opening-copy"><p class="rebuild-index">${text(copy.index)}</p><p class="rebuild-kicker">${text(copy.openingKicker)}</p><h1 id="rebuild-title" class="rebuild-fill">${text(copy.openingTitle)}</h1><p class="rebuild-lead">${text(copy.openingBody)}</p><a class="rebuild-link" href="#code">${text(copy.enter)} <span aria-hidden="true">↘</span></a></div>
    <p class="opening-caption">${text(copy.openingNote)} <span>·</span> Dissonância</p>
    <a class="rebuild-scroll" href="#code" aria-label="${esc(copy.enter)}"><span></span></a>
  </section>
  <section class="rebuild-chapter rebuild-code" id="code" aria-labelledby="rebuild-code-title" data-rebuild-chapter="code">
    <div class="chapter-heading"><p class="rebuild-kicker">${text(copy.codeKicker)}</p><h2 id="rebuild-code-title" class="rebuild-fill">${text(copy.codeTitle)}</h2><p>${text(copy.codeBody)}</p></div>
    <div class="code-visual" aria-hidden="true"><svg viewBox="0 0 720 430" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="circuit" x1="0" x2="1"><stop stop-color="#5c9dff"/><stop offset=".55" stop-color="#b885ff"/><stop offset="1" stop-color="#73c8ff"/></linearGradient><filter id="circuit-light"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="none" stroke="url(#circuit)" stroke-width="1.2" opacity=".62"><path d="M0 270H180L290 160H470L560 70H720"/><path d="M0 330H230L350 210H510L610 110H720"/><path d="M80 0V95L200 215H370L480 325H720"/><path d="M0 170H115L225 60H400L515 175H720"/><path d="M145 430V350L260 235H420L555 370H720"/></g><g fill="#9ac7ff" filter="url(#circuit-light)"><circle cx="180" cy="270" r="4"/><circle cx="470" cy="160" r="4"/><circle cx="560" cy="70" r="4"/><circle cx="350" cy="210" r="4"/><circle cx="510" cy="210" r="4"/><circle cx="200" cy="215" r="4"/></g><g fill="#c7a3ff" opacity=".17"><rect x="278" y="106" width="150" height="108" rx="2"/><rect x="455" y="226" width="160" height="102" rx="2"/></g><path d="M318 135h-17v50h17m73-50h17v50h-17" fill="none" stroke="#d5b8ff" stroke-width="5" stroke-linecap="square"/></svg><span class="visual-note">01 — PATTERN → SYSTEM</span></div>
    <div class="stack-panel"><div class="stack-panel-heading"><div><p class="rebuild-kicker">${text(copy.stackTitle)}</p><p>${text(copy.stackBody)}</p></div><span aria-hidden="true">↘</span></div><div class="rebuild-stack"></div><div class="rebuild-stack-more"></div></div>
    <p class="chapter-side-note">${text(copy.codeAside)}</p>
  </section>
  <section class="rebuild-chapter rebuild-music" id="music" aria-labelledby="rebuild-music-title" data-rebuild-chapter="music">
    <div class="music-heading"><div><p class="rebuild-kicker">${text(copy.musicKicker)}</p><h2 id="rebuild-music-title" class="rebuild-fill">${text(copy.musicTitle)}</h2></div><p>${text(copy.musicBody)}</p></div>
    <figure class="music-score"><div class="music-score-glow" aria-hidden="true"></div><img src="/assets/about/guitar-score/score-ribbon-row-030-033.png" alt="" decoding="async"><figcaption><span>DISSONÂNCIA</span><span>31 — 33</span><span>${text(copy.scoreBy)}</span></figcaption></figure>
    <details class="rebuild-mixer"><summary>${text(copy.layers)} <span>＋</span></summary><div class="mixer-sliders"></div></details>
  </section>
  <section class="score-transition" id="score-transition" aria-label="${isEnglish ? "The score changes into watercolor" : "A partitura se transforma em aquarela"}" data-score-transition>
    <svg class="score-filter-definitions" aria-hidden="true" focusable="false">
      <filter id="score-watercolor-edge" x="-8%" y="-45%" width="116%" height="190%" color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
        <feTurbulence type="fractalNoise" baseFrequency=".035 .12" numOctaves="2" seed="17" result="paperGrain" />
        <feDisplacementMap in="SourceAlpha" in2="paperGrain" scale="1.25" xChannelSelector="R" yChannelSelector="B" result="wetEdge" />
        <feMorphology in="wetEdge" operator="dilate" radius=".75" result="pigmentBleed" />
        <feComposite in="pigmentBleed" in2="wetEdge" operator="out" result="outerWashMask" />
        <feFlood flood-color="#397ee5" result="bluePigment" />
        <feComposite in="bluePigment" in2="outerWashMask" operator="in" result="blueWash" />
        <feFlood flood-color="#bb73e8" result="violetPigment" />
        <feComposite in="violetPigment" in2="wetEdge" operator="in" result="violetCore" />
        <feBlend in="blueWash" in2="violetCore" mode="normal" />
      </filter>
    </svg>
    <div class="score-transition-stage">
      <div class="transition-score" aria-hidden="true">
        <img class="transition-engraving" src="/assets/about/guitar-score/score-ribbon-row-030-033.png" alt="" decoding="async">
        <img class="transition-watercolor" src="/assets/about/guitar-score/score-ribbon-row-030-033.png" alt="" decoding="async">
      </div>
      <p class="score-transition-caption"><span>${isEnglish ? "THE SAME PHRASE" : "A MESMA FRASE"}</span><span>${isEnglish ? "ANOTHER MATERIAL" : "OUTRA MATÉRIA"}</span></p>
    </div>
  </section>
  <section class="rebuild-chapter rebuild-art" id="art" aria-labelledby="rebuild-art-title" data-rebuild-chapter="art">
    <div class="art-wash" aria-hidden="true"><svg viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid slice"><defs><filter id="watercolor-blur"><feGaussianBlur stdDeviation="18"/></filter><linearGradient id="wash-purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5041d7"/><stop offset=".5" stop-color="#b351df"/><stop offset="1" stop-color="#192c83"/></linearGradient></defs><path d="M-30 480C96 352 138 240 314 210s169 51 273-82 258-111 333 8 88 211 94 510H-22z" fill="url(#wash-purple)" opacity=".4" filter="url(#watercolor-blur)"/><path d="M-20 530C120 417 204 278 340 285s190 84 292-51 197-139 268-36" fill="none" stroke="#8f68ff" stroke-width="46" stroke-linecap="round" opacity=".32"/><path d="M-10 590C160 480 205 358 348 345s222 111 329-17 176-133 272-89" fill="none" stroke="#67adff" stroke-width="16" stroke-linecap="round" opacity=".42"/><g fill="#bb8aff" opacity=".68"><circle cx="185" cy="178" r="5"/><circle cx="230" cy="224" r="3"/><circle cx="760" cy="210" r="4"/><circle cx="826" cy="290" r="7"/><circle cx="668" cy="535" r="4"/><circle cx="340" cy="590" r="3"/></g><path d="M211 434c52-140 114-234 214-252-7 71-37 126-79 157 78-31 143-18 180 29-64 10-102 41-124 98-25 65-97 104-203 100 65-24 106-65 125-112-37 13-75 7-113-20z" fill="#d5bdff" opacity=".16"/></svg><span class="art-brush art-brush-one"></span><span class="art-brush art-brush-two"></span></div>
    <div class="art-poem"><p class="rebuild-kicker">${text(copy.artKicker)}</p><blockquote>${text(copy.poem)}</blockquote><span class="poem-rule"></span><h2 id="rebuild-art-title" class="rebuild-fill">${text(copy.artTitle)}</h2><p>${text(copy.artBody)}</p><small>${text(copy.artNote)}</small></div>
  </section>
  <section class="rebuild-chapter rebuild-games" id="games" aria-labelledby="rebuild-games-title" data-rebuild-chapter="games">
    <div class="games-landscape" aria-hidden="true"><img src="/assets/about/forest/forest-world-wide.png" alt="" decoding="async"><div class="games-grid"></div><span class="games-star games-star-one">✦</span><span class="games-star games-star-two">✧</span><span class="games-knight" aria-hidden="true"></span><span class="games-portal"></span></div>
    <div class="games-copy"><p class="rebuild-kicker">${text(copy.gamesKicker)}</p><h2 id="rebuild-games-title" class="rebuild-fill">${text(copy.gamesTitle)}</h2><p>${text(copy.gamesBody)}</p><button class="rebuild-link" type="button" data-open-world>${text(copy.explore)} <span aria-hidden="true">↗</span></button></div>
  </section>
  <section class="rebuild-ending" id="closing" aria-labelledby="rebuild-ending-title" data-rebuild-chapter="closing"><div class="ending-score" aria-hidden="true">${staffSvg}</div><div class="ending-copy"><p class="rebuild-kicker">${text(copy.endingKicker)}</p><h2 id="rebuild-ending-title" class="rebuild-fill">${text(copy.endingTitle)}</h2><nav aria-label="${isEnglish ? "Next steps" : "Próximos passos"}"><a href="${isEnglish ? "/en/projects/" : "/pt-br/projetos/"}">${text(copy.projects)} <span>↗</span></a><a href="${isEnglish ? "/en/contact/" : "/pt-br/contato/"}">${text(copy.contact)} <span>↗</span></a></nav></div></section>
  <p class="rebuild-footnote">${text(copy.scoreBy)} <span>·</span> 4:09</p>
  <dialog class="rebuild-world" aria-labelledby="world-title"><button class="world-close" type="button" data-close-world aria-label="${esc(copy.closeWorld)}">×</button><div class="world-scene"><img class="world-landscape" src="/assets/about/forest/forest-world-wide.png" alt=""><span class="world-knight" aria-hidden="true"></span><span class="world-light"></span></div><div class="world-description"><p class="rebuild-kicker">GAMES · ${isEnglish ? "PRESENTATION" : "APRESENTAÇÃO"}</p><h2 id="world-title">${text(copy.worldTitle)}</h2><p>${text(copy.worldBody)}</p><button type="button" class="rebuild-link" data-close-world>${text(copy.closeWorld)} <span aria-hidden="true">↗</span></button></div></dialog>
  <div class="rebuild-dock" role="region" aria-label="${isEnglish ? "Dissonância player" : "Player de Dissonância"}"><div class="dock-chapters" aria-label="${isEnglish ? "Chapters" : "Capítulos"}"><a href="#opening">01</a><a href="#code">02</a><a href="#music">03</a><a href="#art">04</a><a href="#games">05</a><a href="#closing">06</a></div><button type="button" class="dock-play" aria-pressed="false"><span aria-hidden="true">▶</span><span class="dock-play-label">${text(copy.listen)}</span></button><span class="dock-state">${text(copy.soundOff)}</span><button type="button" class="dock-motion" aria-pressed="false" aria-label="${esc(copy.movement)}">◌</button></div>`;

root.classList.add("about-rebuild-v2");
root.replaceChildren();
root.insertAdjacentHTML("afterbegin", sections);
if (source.stack) root.querySelector(".rebuild-stack").append(source.stack);
if (source.extras) root.querySelector(".rebuild-stack-more").append(source.extras);
if (location.hash.length > 1) {
  requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" }));
}

for (const link of document.querySelectorAll("[data-locale-choice]")) {
  const target = new URL(link.href);
  target.searchParams.set("about-rebuild", "v2");
  link.href = target.href;
}

function mountTextFill() {
  for (const heading of root.querySelectorAll(".rebuild-fill")) {
    const words = heading.textContent.trim().split(/\s+/u);
    const ink = getComputedStyle(heading).color;
    heading.replaceChildren(...words.map((word, index) => {
      const span = document.createElement("span");
      span.className = "rebuild-fill-word";
      span.textContent = word + (index < words.length - 1 ? " " : "");
      span.style.setProperty("--word-ink", ink);
      return span;
    }));
  }
  let pending = false;
  let pausedTransitionProgress = null;
  const update = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const heading of root.querySelectorAll(".rebuild-fill")) {
        const progress = Math.max(0, Math.min(1, (.84 * innerHeight - heading.getBoundingClientRect().top) / (innerHeight * .5)));
        heading.querySelectorAll(".rebuild-fill-word").forEach((word, index, all) => {
          word.style.setProperty("--fill", `${Math.max(0, Math.min(1, progress * all.length - index)) * 100}%`);
        });
      }
      const pageProgress = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
      root.style.setProperty("--page-progress", pageProgress);
      const transition = root.querySelector("[data-score-transition]");
      if (transition) {
        const bounds = transition.getBoundingClientRect();
        const stage = transition.querySelector(".score-transition-stage");
        const stageTop = innerWidth <= 700 ? 76 : Math.min(108, Math.max(72, innerHeight * .1));
        const stageHeight = stage.getBoundingClientRect().height;
        const travel = Math.max(1, bounds.height - stageHeight);
        const progress = Math.max(0, Math.min(1, (stageTop - bounds.top) / travel));
        const sceneBottom = stageTop + stageHeight;
        const pinned = bounds.top <= stageTop && bounds.bottom >= sceneBottom;
        const after = bounds.bottom < sceneBottom;
        transition.toggleAttribute("data-pinned", pinned);
        transition.toggleAttribute("data-after", after);
        const paused = document.documentElement.dataset.motionPaused === "true" || document.documentElement.dataset.motionReduced === "true";
        if (paused && pausedTransitionProgress === null) pausedTransitionProgress = progress;
        if (!paused) pausedTransitionProgress = null;
        const rawProgress = paused ? (pausedTransitionProgress ?? progress) : progress;
        const currentProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
        transition.style.setProperty("--transition-progress", String(currentProgress));
        transition.style.setProperty("--watercolor-reveal", `${currentProgress * 100}%`);
        transition.style.setProperty("--score-y", `${(0.5 - currentProgress) * 18}px`);
        transition.style.setProperty("--score-scale", String((innerWidth <= 700 ? 0.94 : 0.9) + currentProgress * (innerWidth <= 700 ? 0.12 : 0.17)));
      }
    });
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
  root.querySelector(".stack-more details")?.addEventListener("toggle", update);
  update();
}
mountTextFill();

const audio = createJourneyAudio(score, state => {
  const button = root.querySelector(".dock-play");
  const label = root.querySelector(".dock-play-label");
  const status = root.querySelector(".dock-state");
  const playing = state.state === "playing" || state.state === "starting";
  button.setAttribute("aria-pressed", String(playing));
  button.querySelector("[aria-hidden]").textContent = playing ? "Ⅱ" : "▶";
  label.textContent = playing ? copy.pause : copy.listen;
  status.textContent = state.state === "playing" ? `${state.section} · ${formatTime(audio.snapshot().seconds)}` : state.state === "error" || state.state === "unavailable" ? (isEnglish ? "Audio unavailable" : "Áudio indisponível") : copy.soundOff;
}, { });

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

root.querySelector(".dock-play").addEventListener("click", () => audio.playing ? audio.pause() : audio.start());
const dockState = root.querySelector(".dock-state");
const playbackClock = setInterval(() => {
  if (!audio.playing) return;
  const snapshot = audio.snapshot();
  dockState.textContent = `${snapshot.section} · ${formatTime(snapshot.seconds)}`;
}, 1000);
const mixer = root.querySelector(".mixer-sliders");
for (const track of score.tracks) {
  const row = document.createElement("label");
  row.className = "mixer-row";
  const name = document.createElement("span");
  name.textContent = track.name;
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = ".01";
  input.value = String(audio.getTrackVolume(track.id) ?? .5);
  input.setAttribute("aria-label", `${track.name} ${copy.volume}`);
  input.addEventListener("input", () => audio.setTrackVolume(track.id, Number(input.value)));
  row.append(name, input);
  mixer.append(row);
}

const motionButton = root.querySelector(".dock-motion");
motionButton.addEventListener("click", () => {
  const paused = document.documentElement.dataset.motionPaused !== "true";
  document.documentElement.dataset.motionPaused = String(paused);
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.setAttribute("aria-label", paused ? copy.movementOn : copy.movement);
  dispatchEvent(new Event("scroll"));
});
const dialog = root.querySelector(".rebuild-world");
const opener = root.querySelector("[data-open-world]");
opener.addEventListener("click", () => dialog.showModal());
root.querySelectorAll("[data-close-world]").forEach(button => button.addEventListener("click", () => dialog.close()));
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
addEventListener("pagehide", () => { clearInterval(playbackClock); audio.dispose(); }, { once: true });

if (matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.dataset.motionReduced = "true";
