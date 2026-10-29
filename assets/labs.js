(() => {
  const runway = document.querySelector("[data-labs-runway]");
  const stage = document.querySelector("[data-lab-scene]");
  const collection = document.querySelector("[data-lab-collection]");
  const folders = Array.from(document.querySelectorAll("[data-lab-folder]"));
  const controls = document.querySelector("[data-lab-controls]");
  const previous = document.querySelector("[data-lab-previous]");
  const next = document.querySelector("[data-lab-next]");
  const motionControl = document.querySelector("[data-lab-motion]");
  const title = document.querySelector("[data-lab-title]");
  const description = document.querySelector("[data-lab-description]");
  const state = document.querySelector("[data-lab-state]");
  const indexLabel = document.querySelector("[data-lab-index]");
  const count = document.querySelector("[data-lab-count]");
  const tags = document.querySelector("[data-lab-tags]");
  const link = document.querySelector("[data-lab-link]");
  const incomingNote = document.querySelector("[data-lab-incoming]");
  const progressBar = document.querySelector("[data-lab-progress]");
  const handoffLabel = document.querySelector("[data-lab-handoff-label]");
  const sticky = document.querySelector(".labs-sticky");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!runway || !stage || !collection || folders.length !== 5 || !controls || !motionControl) return;

  const ambientCanvas = document.createElement("canvas");
  ambientCanvas.className = "lab-ambient-field";
  ambientCanvas.dataset.labAmbientField = "true";
  ambientCanvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(ambientCanvas);
  const ambientContext = ambientCanvas.getContext("2d", { alpha: true });

  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  const labs = [
    {
      title: "Rate Limiting Lab",
      state: isEnglish ? "Available" : "Disponível",
      description: isEnglish
        ? "Four rate-limiting strategies, with Redis shared state for Fixed Window."
        : "Quatro estratégias de rate limiting, com estado compartilhado via Redis para Fixed Window.",
      tags: ["TypeScript", "Node.js", "Redis"],
      href: "https://github.com/engineering-proof-labs/rate-limiting-lab",
    },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This folder is reserved for a future experiment." : "Esta pasta está reservada para um experimento futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This folder is reserved for a future experiment." : "Esta pasta está reservada para um experimento futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This folder is reserved for a future experiment." : "Esta pasta está reservada para um experimento futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This folder is reserved for a future experiment." : "Esta pasta está reservada para um experimento futuro." },
  ];

  const formatIndex = (value) => String(value + 1).padStart(2, "0");
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const isMobileScene = () => window.matchMedia("(max-width: 780px)").matches;
  const smoothstep = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  function fieldNoise(value) {
    const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function makeAmbientParticles() {
    const amount = isMobileScene() ? 84 : 180;
    return Array.from({ length: amount }, (_, index) => {
      const region = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 4, 4][index % 20];
      const horizontal = fieldNoise(index * 13 + 1);
      const vertical = fieldNoise(index * 17 + 2);
      let x;
      let y;
      if (region === 0) {
        x = ambientWidth * (.24 + horizontal * .2);
        y = ambientHeight * (.12 + vertical * .72);
      } else if (region === 1) {
        x = ambientWidth * (.035 + horizontal * .29);
        y = ambientHeight * (.2 + vertical * .66);
      } else if (region === 2) {
        x = ambientWidth * (.06 + horizontal * .78);
        y = ambientHeight * (.72 + vertical * .27);
      } else if (region === 3) {
        x = ambientWidth * (.02 + horizontal * .96);
        y = ambientHeight * (.008 + vertical * .084);
      } else {
        x = ambientWidth * (.49 + horizontal * .46);
        y = ambientHeight * (.14 + vertical * .68);
      }
      const alpha = .2 + fieldNoise(index * 19 + 3) * .25;
      return {
        anchorX: x,
        anchorY: y,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: .65 + fieldNoise(index * 23 + 4) * 1.25,
        alpha,
        phase: fieldNoise(index * 29 + 5) * Math.PI * 2,
        orbitSpeed: .55 + fieldNoise(index * 31 + 6) * .5,
        pulseSpeed: 1.4 + fieldNoise(index * 37 + 7) * 1.7,
        orbitRadiusX: 3 + fieldNoise(index * 41 + 8) * 6,
        orbitRadiusY: 3 + fieldNoise(index * 43 + 9) * 6,
        maxHoverDisplacement: 35 + fieldNoise(index * 47 + 10) * 30,
        binary: fieldNoise(index * 53 + 11) > .92,
        bit: index % 2 ? "0" : "1",
        node: fieldNoise(index * 59 + 12) > .978,
      };
    });
  }

  function drawAmbientField(time, deltaMs) {
    if (!ambientContext) return;
    ambientContext.setTransform(ambientRatio, 0, 0, ambientRatio, 0, 0);
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);
    if (!sceneVisible) return;

    const delta = motionPaused && !ambientPointer.recovering ? 0 : Math.min(.05, Math.max(0, deltaMs) / 1000);
    const pointerRadius = Math.max(80, Math.min(125, Math.min(ambientWidth, ambientHeight) * .24));
    let maxDisplacement = 0;
    let maxVelocity = 0;
    for (const particle of ambientParticles) {
      if (delta > 0) {
        const orbit = time * .00035 * particle.orbitSpeed + particle.phase;
        const homeX = particle.anchorX + (motionPaused ? 0 : Math.cos(orbit) * particle.orbitRadiusX);
        const homeY = particle.anchorY + (motionPaused ? 0 : Math.sin(orbit * 1.31) * particle.orbitRadiusY);
        const dx = particle.x - ambientPointer.x;
        const dy = particle.y - ambientPointer.y;
        const distance = Math.hypot(dx, dy) || .001;
        const awayX = dx / distance;
        const awayY = dy / distance;
        const local = ambientPointer.strength * Math.exp(-(distance * distance) / (2 * pointerRadius * pointerRadius));
        const accelerationX = (homeX - particle.x) * 6.2 - particle.vx * 7 + awayX * local * 1100;
        const accelerationY = (homeY - particle.y) * 6.2 - particle.vy * 7 + awayY * local * 1100;
        particle.vx += accelerationX * delta;
        particle.vy += accelerationY * delta;
        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > 170) {
          particle.vx = particle.vx / speed * 170;
          particle.vy = particle.vy / speed * 170;
        }
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        const offsetX = particle.x - particle.anchorX;
        const offsetY = particle.y - particle.anchorY;
        const offset = Math.hypot(offsetX, offsetY);
        if (offset > particle.maxHoverDisplacement) {
          const scale = particle.maxHoverDisplacement / offset;
          particle.x = particle.anchorX + offsetX * scale;
          particle.y = particle.anchorY + offsetY * scale;
          const outwardVelocity = particle.vx * offsetX + particle.vy * offsetY;
          if (outwardVelocity > 0) {
            particle.vx -= outwardVelocity / (offset * offset) * offsetX;
            particle.vy -= outwardVelocity / (offset * offset) * offsetY;
          }
        }
        particle.x = clamp(particle.x, 0, ambientWidth);
        particle.y = clamp(particle.y, 0, ambientHeight);
      }

      const displacement = Math.hypot(particle.x - particle.anchorX, particle.y - particle.anchorY);
      maxDisplacement = Math.max(maxDisplacement, displacement);
      maxVelocity = Math.max(maxVelocity, Math.hypot(particle.vx, particle.vy));
      const pulse = .58 + (Math.sin(time * .002 * particle.pulseSpeed + particle.phase) + 1) * .21;
      ambientContext.globalAlpha = particle.alpha * pulse * (1 + ambientPointer.strength * .24);
      ambientContext.fillStyle = particle.node ? "#cfe5ff" : "#79b2f2";
      ambientContext.shadowColor = "rgba(91, 169, 255, .42)";
      ambientContext.shadowBlur = particle.node ? 2.2 : 1.1;
      if (particle.binary) {
        ambientContext.font = "8px ui-monospace, SFMono-Regular, Consolas, monospace";
        ambientContext.textAlign = "center";
        ambientContext.textBaseline = "middle";
        ambientContext.fillText(particle.bit, particle.x, particle.y);
      } else {
        ambientContext.beginPath();
        ambientContext.arc(particle.x, particle.y, particle.radius * (particle.node ? 1.3 : 1), 0, Math.PI * 2);
        ambientContext.fill();
      }
    }
    ambientContext.globalAlpha = 1;
    ambientContext.shadowBlur = 0;
    ambientCanvas.dataset.particleCount = String(ambientParticles.length);
    ambientCanvas.dataset.particleDisplacement = maxDisplacement.toFixed(1);
    ambientCanvas.dataset.pointerForce = ambientPointer.strength.toFixed(3);
    ambientCanvas.dataset.pointerTarget = ambientPointer.targetStrength.toFixed(3);
    if (ambientPointer.recovering && ambientPointer.strength < .01 && ambientPointer.targetStrength < .01 && maxVelocity < 3 && (!motionPaused || maxDisplacement < 1.4)) ambientPointer.recovering = false;
  }

  function resetAmbientField() {
    ambientPointer.x = -1000;
    ambientPointer.y = -1000;
    ambientPointer.strength = 0;
    ambientPointer.targetStrength = 0;
    ambientPointer.recovering = false;
    ambientParticles.forEach((particle) => {
      particle.x = particle.anchorX;
      particle.y = particle.anchorY;
      particle.vx = 0;
      particle.vy = 0;
    });
    ambientCanvas.dataset.pointerForce = "0.000";
    ambientCanvas.dataset.pointerTarget = "0.000";
    ambientCanvas.dataset.particleDisplacement = "0";
  }
  let targetPosition = 0;
  let visualPosition = 0;
  let activeIndex = 0;
  let sceneFrame = 0;
  let scrollFrame = 0;
  let pointerGesture = null;
  let sceneVisible = true;
  let motionPaused = false;
  let lastFrameTime = 0;
  let lastCanvasTime = 0;
  let sceneTime = 0;
  let stageWidth = 1;
  let stageHeight = 1;
  let stageRatio = 1;
  let ambientWidth = 1;
  let ambientHeight = 1;
  let ambientRatio = 1;
  let ambientParticles = [];
  const ambientPointer = { x: -1000, y: -1000, strength: 0, targetStrength: 0, recovering: false };
  const folderSystems = [];

  const transitionCanvas = document.createElement("canvas");
  transitionCanvas.className = "lab-transition-field";
  transitionCanvas.setAttribute("aria-hidden", "true");
  stage.appendChild(transitionCanvas);
  const transitionContext = transitionCanvas.getContext("2d", { alpha: true });
  const bridgeParticles = Array.from({ length: 224 }, (_, index) => ({
    phase: index / 224,
    drift: ((Math.sin(index * 71.73) + 1) * .5 - .5) * .1,
    size: .7 + ((Math.sin(index * 18.91) + 1) * .5) * 1.1,
    spreadX: Math.sin(index * 8.17) * (14 + ((Math.sin(index * 29.41) + 1) * .5) * 18),
    spreadY: Math.cos(index * 12.37) * (12 + ((Math.sin(index * 41.03) + 1) * .5) * 16),
    binary: index % 6 === 0,
    bit: index % 2 ? "0" : "1",
  }));

  function pageProgress() {
    const runwayTop = runway.getBoundingClientRect().top + window.scrollY;
    const scrollDistance = Math.max(1, runway.offsetHeight - window.innerHeight);
    return clamp((window.scrollY - runwayTop) / scrollDistance);
  }

  function updateCopy(nextIndex) {
    if (nextIndex === activeIndex && title.textContent) return;
    activeIndex = nextIndex;
    const selected = labs[nextIndex];
    title.textContent = selected.title;
    description.textContent = selected.description;
    state.textContent = selected.state;
    indexLabel.textContent = formatIndex(nextIndex);
    count.textContent = formatIndex(nextIndex);
    const incoming = !selected.href;
    description.hidden = incoming;
    tags.hidden = incoming;
    link.hidden = incoming;
    incomingNote.hidden = !incoming;
    if (!incoming) {
      link.href = selected.href;
      handoffLabel.textContent = isEnglish ? "Next section" : "Próxima seção";
    } else {
      handoffLabel.textContent = nextIndex === folders.length - 1
        ? (isEnglish ? "Collection complete" : "Fim da coleção")
        : (isEnglish ? "Explore another folder" : "Explore outra pasta");
    }
    folders.forEach((folder, index) => {
      folder.classList.toggle("is-active", index === nextIndex);
      folder.dataset.selected = String(index === nextIndex);
    });
    requestSceneAnimation();
  }

  function sceneStep() {
    return window.matchMedia("(max-width: 780px)").matches
      ? stageWidth * .46
      : Math.min(460, stageWidth * .33);
  }

  function transitionState(position) {
    const bounded = clamp(position, 0, folders.length - 1);
    const currentIndex = Math.min(folders.length - 1, Math.floor(bounded + .000001));
    const nextIndex = currentIndex < folders.length - 1 ? currentIndex + 1 : -1;
    const fraction = nextIndex < 0 ? 0 : clamp(bounded - currentIndex);
    const edgeInstability = nextIndex < 0 ? 0 : smoothstep((fraction - .08) / .26);
    const dissolution = nextIndex < 0 ? 0 : smoothstep((fraction - .12) / .7);
    const reconstruction = nextIndex < 0 ? 0 : smoothstep((fraction - .22) / .7);
    const flow = nextIndex < 0 || reduceMotion.matches
      ? 0
      : smoothstep((fraction - .12) / .18) * (1 - smoothstep((fraction - .82) / .18));

    return {
      currentIndex,
      nextIndex,
      fraction,
      edgeInstability,
      dissolution,
      reconstruction,
      currentPresence: 1 - dissolution,
      nextPresence: nextIndex < 0 ? 0 : .42 + .58 * reconstruction,
      flow,
    };
  }

  function paintScene(position, time) {
    const step = sceneStep();
    const transition = transitionState(position);
    sticky.dataset.final = String(transition.nextIndex < 0 && transition.currentIndex === folders.length - 1);
    stage.dataset.transitionFlow = transition.flow.toFixed(3);
    folders.forEach((folder, index) => {
      const isCurrent = index === transition.currentIndex;
      const isNext = index === transition.nextIndex;
      const visible = isCurrent || isNext;
      const role = isCurrent ? "current" : isNext ? "next" : "hidden";
      const wasVisible = folder.dataset.sceneVisible === "true";
      if (!visible && wasVisible) folderSystems[index]?.resetAmbient();
      folder.dataset.sceneVisible = String(visible);
      folder.dataset.sceneRole = role;
      folder.dataset.scenePresence = isCurrent
        ? transition.currentPresence.toFixed(3)
        : isNext ? transition.nextPresence.toFixed(3) : "0";
      if (!visible) {
        folder.style.visibility = "hidden";
        folder.style.pointerEvents = "none";
        folder.style.opacity = "0";
        folder.style.filter = "none";
        folder.style.willChange = "auto";
        folder.dataset.transition = "0";
        if (folderSystems[index]) folderSystems[index].visible = false;
        return;
      }

      const assembling = isNext ? transition.reconstruction : 0;
      const dissolving = isCurrent ? transition.dissolution : 0;
      const x = isCurrent ? 0 : step * .5 * (1 - assembling);
      const y = isCurrent ? 0 : 10 * (1 - assembling);
      const z = isCurrent ? 20 : -320 + 340 * assembling;
      const rotation = isCurrent ? -18 : -14 - 4 * assembling;
      const scale = isCurrent ? 1 : .78 + .22 * assembling;
      const opacity = isCurrent ? transition.currentPresence : transition.nextPresence;
      const blur = isCurrent ? 0 : (1 - assembling) * 2.2;
      folder.style.visibility = opacity > .005 ? "visible" : "hidden";
      folder.style.pointerEvents = isCurrent && opacity > .65 ? "auto" : "none";
      folder.style.willChange = "transform, opacity";
      folder.style.transform = "translate3d(calc(-50% + " + x + "px), calc(-50% + " + y + "px), " + z + "px) rotateY(" + rotation + "deg) scale(" + scale + ")";
      folder.style.opacity = String(opacity);
      folder.style.filter = "blur(" + blur + "px)";
      folder.style.zIndex = "3";
      folder.dataset.transition = isCurrent ? String(dissolving) : String(assembling);
      if (folderSystems[index]) folderSystems[index].visible = opacity > .005;
    });
    if (transitionContext) paintParticleBridge(transition, time);
  }

  function paintParticleBridge(transition, time) {
    transitionContext.setTransform(stageRatio, 0, 0, stageRatio, 0, 0);
    transitionContext.clearRect(0, 0, stageWidth, stageHeight);
    if (transition.nextIndex < 0 || transition.flow < .015) return;

    const from = folders[transition.currentIndex].getBoundingClientRect();
    const to = folders[transition.nextIndex].getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const startX = from.left - stageBounds.left + from.width * .2;
    const startY = from.top - stageBounds.top + from.height * .38;
    const endX = to.left - stageBounds.left + to.width * .68;
    const endY = to.top - stageBounds.top + to.height * .52;
    const controlAX = startX + Math.min(180, stageWidth * .12);
    const controlAY = startY - Math.min(140, stageHeight * .16);
    const controlBX = endX - Math.min(120, stageWidth * .08);
    const controlBY = endY + Math.min(72, stageHeight * .08);
    const travel = (transition.fraction - .06) / .88;

    bridgeParticles.forEach((particle) => {
      const progress = clamp(travel + (particle.phase - .5) * .56 + particle.drift);
      const inverse = 1 - progress;
      const spread = Math.sin(progress * Math.PI);
      const x = inverse ** 3 * startX + 3 * inverse ** 2 * progress * controlAX + 3 * inverse * progress ** 2 * controlBX + progress ** 3 * endX + particle.spreadX * spread;
      const y = inverse ** 3 * startY + 3 * inverse ** 2 * progress * controlAY + 3 * inverse * progress ** 2 * controlBY + progress ** 3 * endY + particle.spreadY * spread;
      const envelope = .45 + Math.sin(progress * Math.PI) * .55;
      const pulse = .9 + Math.sin(time * .0032 + particle.phase * 28) * .1;
      transitionContext.globalAlpha = transition.flow * envelope * pulse * (particle.binary ? .92 : .64);
      transitionContext.fillStyle = particle.binary ? "#8fcaff" : "#4f9ffc";
      transitionContext.shadowColor = "rgba(76, 154, 255, .78)";
      transitionContext.shadowBlur = particle.binary ? 5 : 2.5;
      if (particle.binary) {
        transitionContext.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
        transitionContext.textAlign = "center";
        transitionContext.textBaseline = "middle";
        transitionContext.fillText(particle.bit, x, y);
      } else {
        transitionContext.beginPath();
        transitionContext.arc(x, y, particle.size, 0, Math.PI * 2);
        transitionContext.fill();
      }
    });
    transitionContext.globalAlpha = 1;
    transitionContext.shadowBlur = 0;
  }

  function animateScene(time) {
    sceneFrame = 0;
    if (!sceneVisible || document.hidden) return;

    const delta = Math.min(48, Math.max(1, time - (lastFrameTime || time - 33)));
    lastFrameTime = time;
    if (!motionPaused && !reduceMotion.matches) sceneTime += delta;
    const difference = targetPosition - visualPosition;
    visualPosition += difference * (1 - Math.exp(-delta * .012));
    if (Math.abs(targetPosition - visualPosition) < .001) visualPosition = targetPosition;
    paintScene(visualPosition, sceneTime);

    if (time - lastCanvasTime >= 1000 / 30 || reduceMotion.matches) {
      const canvasDelta = lastCanvasTime ? Math.min(100, time - lastCanvasTime) : delta;
      lastCanvasTime = time;
      folderSystems.forEach((system) => {
        if (!system?.visible) return;
        const deltaStrength = system.pointer.targetStrength - system.pointer.strength;
        system.pointer.strength += deltaStrength * (1 - Math.exp(-canvasDelta * (deltaStrength < 0 ? .007 : .028)));
        if (Math.abs(deltaStrength) < .006) system.pointer.strength = system.pointer.targetStrength;
        const interactionActive = system.pointer.targetStrength > .01 || system.pointer.strength > .01 || system.pointer.recovering;
        system.draw(visualPosition, sceneTime, motionPaused && !interactionActive ? 0 : canvasDelta);
      });
      const ambientDeltaStrength = ambientPointer.targetStrength - ambientPointer.strength;
      ambientPointer.strength += ambientDeltaStrength * (1 - Math.exp(-canvasDelta * (ambientDeltaStrength < 0 ? .007 : .028)));
      if (Math.abs(ambientDeltaStrength) < .006) ambientPointer.strength = ambientPointer.targetStrength;
      const ambientInteractionActive = ambientPointer.targetStrength > .01 || ambientPointer.strength > .01 || ambientPointer.recovering;
      drawAmbientField(sceneTime, motionPaused && !ambientInteractionActive ? 0 : canvasDelta);
    }

    const pointerInMotion = Math.abs(ambientPointer.targetStrength - ambientPointer.strength) > .006 || folderSystems.some((system) => system?.visible && Math.abs(system.pointer.targetStrength - system.pointer.strength) > .006);
    const pointerActive = ambientPointer.targetStrength > .01 || ambientPointer.strength > .01 || ambientPointer.recovering || folderSystems.some((system) => system?.visible && (system.pointer.targetStrength > .01 || system.pointer.strength > .01 || system.pointer.recovering));
    if (!reduceMotion.matches && (!motionPaused || Math.abs(targetPosition - visualPosition) > .002 || pointerInMotion || pointerActive)) {
      sceneFrame = requestAnimationFrame(animateScene);
    }
  }

  function requestSceneAnimation() {
    if (sceneFrame || !sceneVisible || document.hidden) return;
    if (reduceMotion.matches) {
      visualPosition = activeIndex;
      paintScene(visualPosition, sceneTime);
      folderSystems.forEach((system) => {
        if (system?.visible) system.draw(visualPosition, sceneTime, 0);
      });
      drawAmbientField(sceneTime, 0);
      return;
    }
    lastFrameTime = 0;
    sceneFrame = requestAnimationFrame(animateScene);
  }

  function readScroll() {
    scrollFrame = 0;
    const progress = pageProgress();
    targetPosition = progress * (folders.length - 1);
    updateCopy(Math.min(folders.length - 1, Math.round(targetPosition)));
    progressBar.style.transform = "scaleY(" + Math.max(.04, progress) + ")";
    requestSceneAnimation();
  }

  function onScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(readScroll);
  }

  function scrollToIndex(nextIndex) {
    const selected = Math.max(0, Math.min(folders.length - 1, nextIndex));
    const runwayTop = runway.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(0, runway.offsetHeight - window.innerHeight);
    const top = runwayTop + (selected / (folders.length - 1)) * distance;
    window.scrollTo({ top, behavior: reduceMotion.matches ? "auto" : "smooth" });
  }

  previous.addEventListener("click", () => scrollToIndex(activeIndex - 1));
  next.addEventListener("click", () => scrollToIndex(activeIndex + 1));
  motionControl.addEventListener("click", () => {
    motionPaused = !motionPaused;
    const label = motionPaused
      ? (isEnglish ? "Resume ambient motion" : "Retomar movimento ambiente")
      : (isEnglish ? "Pause ambient motion" : "Pausar movimento ambiente");
    motionControl.setAttribute("aria-pressed", String(motionPaused));
    motionControl.setAttribute("aria-label", label);
    motionControl.querySelector("span").textContent = motionPaused ? "▶" : "Ⅱ";
    stage.dataset.motionPaused = String(motionPaused);
    requestSceneAnimation();
  });
  stage.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    }
  });

  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button, a")) return;
    pointerGesture = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    if (event.pointerType !== "touch") stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointerup", (event) => {
    if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
    const deltaX = event.clientX - pointerGesture.x;
    const deltaY = event.clientY - pointerGesture.y;
    pointerGesture = null;
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    scrollToIndex(activeIndex + (deltaX < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => { pointerGesture = null; });

  window.addEventListener("pointermove", (event) => {
    if (!sceneVisible || reduceMotion.matches || event.pointerType === "touch") return;
    ambientPointer.x = event.clientX;
    ambientPointer.y = event.clientY;
    ambientPointer.targetStrength = .95;
    ambientPointer.recovering = false;
    requestSceneAnimation();
  }, { passive: true });
  const releaseAmbientPointer = () => {
    ambientPointer.targetStrength = 0;
    if (!reduceMotion.matches) ambientPointer.recovering = true;
    requestSceneAnimation();
  };
  window.addEventListener("pointerleave", releaseAmbientPointer, { passive: true });
  window.addEventListener("pointercancel", releaseAmbientPointer, { passive: true });
  window.addEventListener("blur", releaseAmbientPointer, { passive: true });
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) releaseAmbientPointer();
  }, { passive: true });

  folders.forEach((folder, folderIndex) => {
    const canvas = folder.querySelector("[data-folder-canvas]");
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const reflectionCanvas = document.createElement("canvas");
    reflectionCanvas.className = "folder-reflection";
    reflectionCanvas.setAttribute("aria-hidden", "true");
    folder.insertBefore(reflectionCanvas, folder.querySelector(".folder-label"));
    const reflectionContext = reflectionCanvas.getContext("2d", { alpha: true });
    const pointer = { x: -1000, y: -1000, strength: 0, targetStrength: 0, recovering: false, width: 1, height: 1, ratio: 1 };
    const system = { folder, canvas, context, reflectionCanvas, reflectionContext, pointer, folderIndex, faces: [], particles: [], bottom: .87, draw: null, visible: false, needsRecovery: false };

    function polygon(width, height, depth = 0, layer = 0) {
      const bottom = isMobileScene() ? .67 : .87;
      const yaw = -.58;
      const pitch = -.14;
      const centerX = width * .5;
      const centerY = height * .52;
      const layerX = width * .012 * layer;
      const layerY = -height * .012 * layer;
      const points = [
        [.055, .205], [.055, .16], [.31, .16], [.38, .232],
        [.54, .225], [.72, .244], [.91, .235], [.91, bottom], [.055, bottom],
      ];
      return points.map(([x, y]) => {
        const localX = width * x + layerX - centerX;
        const localY = height * y + layerY - centerY;
        return [
          centerX + localX + depth * Math.sin(yaw),
          centerY + localY * Math.cos(pitch) - depth * Math.sin(pitch),
        ];
      });
    }

    function pointInPolygon(x, y, points) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
      }
      return inside;
    }

    function noise(value) {
      const sample = Math.sin(value * 127.1 + folderIndex * 311.7) * 43758.5453;
      return sample - Math.floor(sample);
    }

    function blendHex(from, to, amount) {
      const channel = (color, offset) => parseInt(color.slice(offset, offset + 2), 16);
      const mix = (offset) => Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * amount);
      return "rgb(" + mix(1) + " " + mix(3) + " " + mix(5) + ")";
    }

    function distanceToEdge(x, y, points) {
      let distance = Infinity;
      for (let index = 0; index < points.length; index++) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        const edgeX = end[0] - start[0];
        const edgeY = end[1] - start[1];
        const along = clamp(((x - start[0]) * edgeX + (y - start[1]) * edgeY) / (edgeX * edgeX + edgeY * edgeY));
        distance = Math.min(distance, Math.hypot(x - start[0] - edgeX * along, y - start[1] - edgeY * along));
      }
      return distance;
    }

    function makeFace(points, spacingX, spacingY, seed, kind) {
      const minX = Math.max(0, Math.min(...points.map((point) => point[0])));
      const maxX = Math.min(pointer.width, Math.max(...points.map((point) => point[0])));
      const minY = Math.max(0, Math.min(...points.map((point) => point[1])));
      const maxY = Math.min(pointer.height, Math.max(...points.map((point) => point[1])));
      const cells = [];
      const addCell = (x, y, cellSeed, edgeSample = false) => {
        const edgeDistance = distanceToEdge(x, y, points);
        const edgeGlow = clamp(1 - edgeDistance / (spacingX * (edgeSample ? 2.75 : 1.85)));
        const baseBit = noise(cellSeed + 17) > .46 ? "1" : "0";
        cells.push({
          x,
          y,
          edgeGlow,
          edgeSample,
          phase: noise(cellSeed + 11) * Math.PI * 2,
          baseBit,
          bit: baseBit,
          scatterX: (noise(cellSeed + 23) - .5) * 142,
          scatterY: (noise(cellSeed + 31) - .5) * 112,
          order: noise(cellSeed + 41),
          sparse: noise(cellSeed + 53),
          glow: .82 + noise(cellSeed + 61) * .18,
          fieldX: (noise(cellSeed + 101) - .5) * 3.6,
          fieldY: (noise(cellSeed + 113) - .5) * 3.6,
          u: (x - minX) / Math.max(1, maxX - minX),
          v: (y - minY) / Math.max(1, maxY - minY),
          breach: kind === "front" && (x - minX) / Math.max(1, maxX - minX) > .68 && (y - minY) / Math.max(1, maxY - minY) < .42 && noise(cellSeed + 89) > .54,
          flashUntil: 0,
          sizeTier: edgeSample ? 2 : edgeGlow > .78 ? 1 : 0,
        });
      };

      for (let y = minY + spacingY * .5, row = 0; y < maxY; y += spacingY, row++) {
        for (let x = minX + spacingX * .5, column = 0; x < maxX; x += spacingX, column++) {
          if (!pointInPolygon(x, y, points)) continue;
          const cellSeed = row * 83 + column * 29 + seed * 13;
          addCell(x, y, cellSeed);
        }
      }

      if (kind === "front" || kind === "middle" || kind === "rear") {
        const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
        let edgeSample = 0;
        points.forEach((start, edgeIndex) => {
          const end = points[(edgeIndex + 1) % points.length];
          const edgeX = end[0] - start[0];
          const edgeY = end[1] - start[1];
          const edgeLength = Math.hypot(edgeX, edgeY) || 1;
          let normalX = edgeY / edgeLength;
          let normalY = -edgeX / edgeLength;
          const middleX = (start[0] + end[0]) * .5;
          const middleY = (start[1] + end[1]) * .5;
          if (normalX * (middleX - center[0]) + normalY * (middleY - center[1]) < 0) {
            normalX *= -1;
            normalY *= -1;
          }
          const alongStep = Math.max(8, spacingX * .9);
          for (let along = alongStep * .5; along < edgeLength; along += alongStep) {
            const ratio = along / edgeLength;
            for (const depth of [.36, 1.08]) {
              const jitter = (noise(seed * 97 + edgeSample * 13) - .5) * spacingX * .12;
              const x = start[0] + edgeX * ratio - normalX * (spacingY * depth + jitter);
              const y = start[1] + edgeY * ratio - normalY * (spacingY * depth + jitter);
              if (pointInPolygon(x, y, points)) addCell(x, y, seed * 997 + edgeIndex * 233 + edgeSample * 31, true);
              edgeSample++;
            }
          }
        });
      }

      return { points, cells, kind, seed, mutationTick: 0, nextMutationAt: sceneTime + 130 + noise(seed + 77) * 120 };
    }

    function makeEdgeParticles(points, amount) {
      const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
      return Array.from({ length: amount }, (_, index) => {
        const edgeIndex = [0, 1, 2, 3, 4, 5, 5, 6, 7][Math.floor(noise(index * 4) * 9)];
        const start = points[edgeIndex];
        const end = points[(edgeIndex + 1) % points.length];
        const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
        const along = noise(index * 4 + 1);
        let edgeNormalX = (end[1] - start[1]) / edgeLength;
        let edgeNormalY = -(end[0] - start[0]) / edgeLength;
        const middleX = (start[0] + end[0]) * .5;
        const middleY = (start[1] + end[1]) * .5;
        if (edgeNormalX * (middleX - center[0]) + edgeNormalY * (middleY - center[1]) < 0) {
          edgeNormalX *= -1;
          edgeNormalY *= -1;
        }
        const outward = 5 + noise(index * 4 + 2) * 42;
        const rawAnchorX = start[0] + (end[0] - start[0]) * along + edgeNormalX * outward;
        const rawAnchorY = start[1] + (end[1] - start[1]) * along + edgeNormalY * outward;
        const anchorX = clamp(rawAnchorX, 0, pointer.width);
        const anchorY = clamp(rawAnchorY, 0, pointer.height);
        return {
          anchorX,
          anchorY,
          x: anchorX,
          y: anchorY,
          vx: 0,
          vy: 0,
          radius: .55 + noise(index * 4 + 3) * 1.45,
          phase: noise(index * 4 + 4) * Math.PI * 2,
          speed: 1.8 + noise(index * 4 + 5) * 2.5,
          orbitSpeed: .7 + noise(index * 4 + 10) * .65,
          orbitRadiusX: 3 + noise(index * 4 + 11) * 6,
          orbitRadiusY: 3 + noise(index * 4 + 12) * 6,
          maxHoverDisplacement: 35 + noise(index * 4 + 13) * 30,
          depth: noise(index * 4 + 6),
          binary: noise(index * 4 + 7) > .88,
          bit: index % 2 ? "0" : "1",
          node: noise(index * 4 + 8) > .985,
          edgeNormalX,
          edgeNormalY,
        };
      });
    }

    function mutateFace(face, time, enabled) {
      if (!enabled || time < face.nextMutationAt) return;
      face.mutationTick++;
      const share = .02 + noise(face.seed * 37 + face.mutationTick * 11) * .05;
      const changedCount = Math.max(1, Math.round(face.cells.length * share));
      for (let offset = 0; offset < changedCount; offset++) {
        const cellIndex = Math.floor(noise(face.seed * 61 + face.mutationTick * 29 + offset * 17) * face.cells.length);
        const cell = face.cells[cellIndex];
        if (!cell) continue;
        cell.bit = cell.bit === "0" ? "1" : "0";
        cell.flashUntil = time + 180 + noise(face.mutationTick + offset * 31) * 150;
      }
      face.nextMutationAt = time + 120 + noise(face.seed * 73 + face.mutationTick * 19) * 130;
    }

    function drawFace(face, previewAlpha, activeAlpha, roleState, transition, time, enabled) {
      const current = roleState.role === "current";
      const currentness = roleState.currentness;
      const baseAlpha = previewAlpha + (activeAlpha - previewAlpha) * currentness;
      const colors = face.kind === "side" || face.kind === "top"
        ? [blendHex("#1d3550", "#294766", currentness), blendHex("#315678", "#3e78ad", currentness), blendHex("#4c80b5", "#5fa9ed", currentness)]
        : face.kind === "rear"
          ? [blendHex("#14273b", "#1e3450", currentness), blendHex("#254261", "#315f8f", currentness), blendHex("#3c6991", "#3e78ad", currentness)]
        : [blendHex("#27466e", "#315f8f", currentness), blendHex("#3f71a6", "#3e78ad", currentness), blendHex("#568cc4", "#75baf5", currentness)];
      mutateFace(face, time, enabled);
      const radius = Math.max(80, Math.min(125, Math.min(pointer.width, pointer.height) * .24));
      face.cells.forEach((cell) => {
        const interior = cell.edgeGlow < .32;
        if (face.kind === "front" && interior && cell.sparse < .18) return;
        if (face.kind === "middle" && cell.sparse < .66) return;
        if (face.kind === "rear" && cell.sparse < .72) return;
        if (face.kind !== "front" && face.kind !== "middle" && face.kind !== "rear" && cell.sparse < .18) return;
        if (face.kind === "front" && cell.breach && cell.edgeGlow < .7) return;
        if (face.kind === "front" && cell.edgeSample && cell.u > .64 && cell.v < .46 && cell.sparse < .16) return;
        if (face.kind === "front" && cell.edgeSample && cell.u > .96 && cell.sparse < .12) return;
        if (!current && roleState.assembly < .02 && cell.sparse < .36) return;
        const scatter = current
          ? smoothstep((transition.dissolution - cell.order * .22) / .78)
          : 0;
        const resolved = current ? 1 : smoothstep((roleState.assembly - cell.order * .35) / .65);
        const assemblyScatter = current ? 0 : (1 - resolved) * .12;
        const dx = cell.x - pointer.x;
        const dy = cell.y - pointer.y;
        const local = pointer.strength * Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
        const distance = Math.hypot(dx, dy) || 1;
        const pointerWarp = local * (current ? 15 : 3.5);
        const driftX = enabled ? Math.sin(time * .00046 + cell.phase) * .34 : 0;
        const driftY = enabled ? Math.cos(time * .00053 + cell.phase * 1.3) * .38 : 0;
        const edgeJitter = transition.edgeInstability * cell.edgeGlow * Math.sin(time * .004 + transition.fraction * 19 + cell.phase) * 1.8;
        const surfaceX = cell.fieldX * (cell.edgeSample ? .55 : 1);
        const surfaceY = cell.fieldY * (cell.edgeSample ? .55 : 1);
        const x = cell.x + surfaceX + cell.scatterX * (scatter * 1.25 + assemblyScatter) + dx / distance * pointerWarp + driftX + edgeJitter;
        const y = cell.y + surfaceY + cell.scatterY * (scatter * 1.25 + assemblyScatter) + dy / distance * pointerWarp + driftY - edgeJitter * .45;
        const pulse = 1 + Math.sin(time * .0013 + cell.phase) * .115 * cell.sparse + transition.edgeInstability * cell.edgeGlow * .08;
        const flash = time < cell.flashUntil ? 1.12 : 1;
        const edge = Math.pow(cell.edgeGlow, 1.72);
        const contour = face.kind === "front"
          ? .62 + edge * (.74 + currentness * .12) + (cell.edgeSample ? .06 : 0)
          : face.kind === "middle" ? .16 + edge * .42
            : face.kind === "rear" ? .1 + edge * .3
              : .14 + edge * .52;
        const disturbed = local * (current ? .32 : .08);
        const coherence = current ? 1 - scatter * .74 : .82 + resolved * .18;
        const emission = face.kind === "front" && cell.edgeGlow > .76 ? 1.28 : 1;
        const lightAlpha = baseAlpha * contour * pulse * flash * cell.glow * emission * (1 + disturbed) * coherence;
        context.globalAlpha = Math.min(.88 + currentness * .12, lightAlpha);
        context.fillStyle = cell.edgeSample || cell.edgeGlow > .76 ? colors[2] : cell.edgeGlow > .3 ? colors[1] : colors[0];
        const fontSize = (pointer.width < 245 ? 6.5 : 8) * (cell.sizeTier === 2 ? 1.1 : cell.sizeTier === 1 ? 1.06 : 1);
        context.font = fontSize.toFixed(1) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
        context.shadowColor = face.kind === "front" ? "rgba(207, 234, 255, .78)" : "rgba(95, 169, 237, .44)";
        context.shadowBlur = cell.edgeSample ? 1.6 + currentness * (5.5 + cell.edgeGlow * 3) : face.kind === "front" && cell.edgeGlow > .78 ? 2 + currentness * 4 : (face.kind === "side" || face.kind === "top") && cell.edgeGlow > .52 ? 1.4 + currentness * 3 : 0;
        context.fillText(cell.bit, x, y);
      });
      context.shadowBlur = 0;
    }

    function drawParticles(points, roleState, transition, time, deltaMs) {
      const current = roleState.role === "current";
      const pointerRadius = Math.max(80, Math.min(125, Math.min(pointer.width, pointer.height) * .24));
      const delta = motionPaused && !pointer.recovering ? 0 : Math.min(.05, Math.max(0, deltaMs) / 1000);
      const previewAmount = Math.min(104, system.particles.length);
      const amount = Math.round(previewAmount + (system.particles.length - previewAmount) * roleState.currentness);
      const transitionKick = current ? transition.dissolution : roleState.assembly * (1 - roleState.assembly);
      let maxDisplacement = 0;
      let maxVelocity = 0;
      for (let index = 0; index < amount; index++) {
        const particle = system.particles[index];
        if (delta > 0) {
          const orbit = time * .00035 * particle.orbitSpeed + particle.phase;
          const homeX = particle.anchorX + (motionPaused ? 0 : Math.cos(orbit) * particle.orbitRadiusX);
          const homeY = particle.anchorY + (motionPaused ? 0 : Math.sin(orbit * 1.31) * particle.orbitRadiusY);
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy) || .001;
          const awayX = dx / distance;
          const awayY = dy / distance;
          const local = pointer.strength * Math.exp(-(distance * distance) / (2 * pointerRadius * pointerRadius));
          const repulsion = local * (current ? 1100 : 260);
          const outward = local * (current ? 145 : 36);
          const transitionFlow = current ? transition.dissolution * 560 : 0;
          const accelerationX = (homeX - particle.x) * 6.2 - particle.vx * 7 + awayX * (repulsion + outward * particle.edgeNormalX) + particle.edgeNormalX * outward * .22 + transitionFlow;
          const accelerationY = (homeY - particle.y) * 6.2 - particle.vy * 7 + awayY * (repulsion + outward * particle.edgeNormalY) + particle.edgeNormalY * outward * .22;
          particle.vx += accelerationX * delta;
          particle.vy += accelerationY * delta;
          const speed = Math.hypot(particle.vx, particle.vy);
          const transitioning = transitionKick > .02;
          const maxSpeed = transitioning ? (current ? 520 : 210) : (current ? 170 : 95);
          if (speed > maxSpeed) {
            particle.vx = particle.vx / speed * maxSpeed;
            particle.vy = particle.vy / speed * maxSpeed;
          }
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          if (!transitioning) {
            const offsetX = particle.x - particle.anchorX;
            const offsetY = particle.y - particle.anchorY;
            const offset = Math.hypot(offsetX, offsetY);
            if (offset > particle.maxHoverDisplacement) {
              const scale = particle.maxHoverDisplacement / offset;
              particle.x = particle.anchorX + offsetX * scale;
              particle.y = particle.anchorY + offsetY * scale;
              const outwardVelocity = particle.vx * offsetX + particle.vy * offsetY;
              if (outwardVelocity > 0) {
                particle.vx -= outwardVelocity / (offset * offset) * offsetX;
                particle.vy -= outwardVelocity / (offset * offset) * offsetY;
              }
            }
          }
          particle.x = Math.max(0, Math.min(pointer.width, particle.x));
          particle.y = Math.max(0, Math.min(pointer.height, particle.y));
        }
        maxDisplacement = Math.max(maxDisplacement, Math.hypot(particle.x - particle.anchorX, particle.y - particle.anchorY));
        maxVelocity = Math.max(maxVelocity, Math.hypot(particle.vx, particle.vy));
        const transitionFactor = 1 + transitionKick * .72;
        const depthScale = .72 + particle.depth * .64;
        const pulse = .72 + (Math.sin(time * .0035 * particle.speed + particle.phase) + 1) * .14;
        const baseAlpha = current ? .72 : .42;
        const alpha = baseAlpha * pulse * depthScale * transitionFactor;
        context.globalAlpha = alpha;
        context.fillStyle = particle.node ? "#d8eaff" : "#85baf0";
        context.shadowColor = "rgba(91, 169, 255, .7)";
        context.shadowBlur = particle.node ? 5 : particle.depth > .8 ? 3 : 1.2;
        if (particle.binary) {
          context.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(particle.bit, particle.x, particle.y);
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius * depthScale * (particle.node ? 1.45 : 1), 0, Math.PI * 2);
          context.fill();
        }
      }
      context.shadowBlur = 0;
      if (motionPaused && pointer.recovering && pointer.strength < .01 && pointer.targetStrength < .01 && maxDisplacement < 1.4 && maxVelocity < 3) pointer.recovering = false;
      system.needsRecovery = motionPaused && pointer.recovering;
      folder.dataset.particleCount = String(amount);
      folder.dataset.particleDisplacement = maxDisplacement.toFixed(1);
    }

    function draw(position, time, deltaMs = 0) {
      context.setTransform(pointer.ratio, 0, 0, pointer.ratio, 0, 0);
      context.clearRect(0, 0, pointer.width, pointer.height);
      const bottom = system.bottom;
      const depth = pointer.width * .3;
      const front = polygon(pointer.width, pointer.height, 0, 0);
      const middle = polygon(pointer.width, pointer.height, -depth * .48, .8);
      const back = polygon(pointer.width, pointer.height, -depth, 1.6);
      const band = (from, to, start, end) => [...from.slice(start, end + 1), ...to.slice(start, end + 1).reverse()];
      const sideRight = band(front, middle, 6, 7);
      const sideBottom = band(front, middle, 7, 8);
      const sideTop = band(front, middle, 2, 6);
      const rearRight = band(middle, back, 6, 7);
      const rearBottom = band(middle, back, 7, 8);
      const transition = transitionState(position);
      const role = folderIndex === transition.currentIndex ? "current" : folderIndex === transition.nextIndex ? "next" : "hidden";
      if (role === "hidden") {
        if (reflectionContext) reflectionContext.clearRect(0, 0, reflectionCanvas.width, reflectionCanvas.height);
        return;
      }
      const roleState = {
        role,
        assembly: role === "next" ? transition.reconstruction : 0,
        currentness: role === "current" ? 1 : transition.reconstruction,
      };

      context.textAlign = "center";
      context.textBaseline = "middle";
      const enabled = !motionPaused && !reduceMotion.matches;
      drawFace(system.faces[0], .4, .4, roleState, transition, time, enabled);
      drawFace(system.faces[1], .2, .72, roleState, transition, time, enabled);
      drawFace(system.faces[2], .19, .62, roleState, transition, time, enabled);
      drawFace(system.faces[3], .14, .25, roleState, transition, time, enabled);
      drawFace(system.faces[4], .12, .23, roleState, transition, time, enabled);
      drawFace(system.faces[5], .16, .56, roleState, transition, time, enabled);
      drawFace(system.faces[6], .18, .38, roleState, transition, time, enabled);
      drawFace(system.faces[7], .91, 1.02, roleState, transition, time, enabled);
      drawParticles(front, roleState, transition, time, deltaMs);
      context.globalAlpha = 1;

      if (reflectionContext) {
        reflectionContext.setTransform(1, 0, 0, 1, 0, 0);
        reflectionContext.clearRect(0, 0, reflectionCanvas.width, reflectionCanvas.height);
        reflectionContext.save();
        reflectionContext.translate(0, reflectionCanvas.height);
        reflectionContext.scale(1, -1);
        reflectionContext.drawImage(canvas, 0, pointer.height * .11 * pointer.ratio, canvas.width, pointer.height * (bottom - .11) * pointer.ratio, 0, 0, reflectionCanvas.width, reflectionCanvas.height);
        reflectionContext.restore();
        reflectionCanvas.style.opacity = String(.055 + .325 * roleState.currentness);
      }
      folder.dataset.pointerForce = pointer.strength.toFixed(3);
      folder.dataset.particleEnergy = (pointer.strength + (role === "current" ? transition.dissolution : transition.reconstruction)).toFixed(3);
    }

    system.draw = draw;
    system.resetAmbient = () => {
      pointer.x = -1000;
      pointer.y = -1000;
      pointer.strength = 0;
      pointer.targetStrength = 0;
      pointer.recovering = false;
      system.particles.forEach((particle) => {
        particle.x = particle.anchorX;
        particle.y = particle.anchorY;
        particle.vx = 0;
        particle.vy = 0;
      });
      folder.dataset.pointerForce = "0.000";
      folder.dataset.particleCount = "0";
      folder.dataset.particleDisplacement = "0";
      system.needsRecovery = false;
    };
    folderSystems[folderIndex] = system;

    function resize() {
      pointer.width = Math.max(1, folder.clientWidth);
      pointer.height = Math.max(1, folder.clientHeight);
      pointer.ratio = Math.min(window.devicePixelRatio || 1, 1.3);
      canvas.width = Math.round(pointer.width * pointer.ratio);
      canvas.height = Math.round(pointer.height * pointer.ratio);
      system.bottom = isMobileScene() ? .67 : .87;
      folder.dataset.mobile = String(isMobileScene());
      if (reflectionContext) {
        reflectionCanvas.width = canvas.width;
        reflectionCanvas.height = Math.round(canvas.height * (isMobileScene() ? .34 : .43));
      }
      const bottom = system.bottom;
      const depth = pointer.width * .3;
      const front = polygon(pointer.width, pointer.height, 0, 0);
      const middle = polygon(pointer.width, pointer.height, -depth * .48, .8);
      const back = polygon(pointer.width, pointer.height, -depth, 1.6);
      const band = (from, to, start, end) => [...from.slice(start, end + 1), ...to.slice(start, end + 1).reverse()];
      const sideRight = band(front, middle, 6, 7);
      const sideBottom = band(front, middle, 7, 8);
      const sideTop = band(front, middle, 2, 6);
      const rearRight = band(middle, back, 6, 7);
      const rearBottom = band(middle, back, 7, 8);
      system.faces = [
        makeFace(back, 14, 16, 19, "rear"),
        makeFace(sideRight, 11, 14, 5, "side"),
        makeFace(sideBottom, 11, 14, 7, "side"),
        makeFace(rearRight, 10, 12, 23, "side"),
        makeFace(rearBottom, 10, 12, 29, "side"),
        makeFace(sideTop, 10, 12, 31, "top"),
        makeFace(middle, 15, 17, 37, "middle"),
        makeFace(front, pointer.width < 245 ? 12.5 : 14, pointer.width < 245 ? 14 : 15, 11, "front"),
      ];
      folder.dataset.edgeGlyphCount = String(system.faces[7].cells.filter((cell) => cell.edgeSample).length);
      system.particles = makeEdgeParticles(front, 260);
      draw(visualPosition, sceneTime, 0);
      requestSceneAnimation();
    }

    canvas.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches || event.pointerType === "touch") return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / Math.max(1, bounds.width) * pointer.width;
      pointer.y = (event.clientY - bounds.top) / Math.max(1, bounds.height) * pointer.height;
      pointer.targetStrength = .95;
      pointer.recovering = false;
      requestSceneAnimation();
    }, { passive: true });
    const releasePointer = () => {
      pointer.targetStrength = 0;
      if (!reduceMotion.matches) pointer.recovering = true;
      requestSceneAnimation();
    };
    canvas.addEventListener("pointerleave", releasePointer, { passive: true });
    canvas.addEventListener("pointercancel", releasePointer, { passive: true });
    folder.dataset.canvasReady = "true";
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(folder);
    else window.addEventListener("resize", resize, { passive: true });
    resize();
  });

  function resizeStage() {
    stageWidth = Math.max(1, stage.clientWidth);
    stageHeight = Math.max(1, stage.clientHeight);
    stageRatio = Math.min(window.devicePixelRatio || 1, 1);
    transitionCanvas.width = Math.round(stageWidth * stageRatio);
    transitionCanvas.height = Math.round(stageHeight * stageRatio);
    transitionCanvas.style.width = stageWidth + "px";
    transitionCanvas.style.height = stageHeight + "px";
    ambientWidth = Math.max(1, window.innerWidth);
    ambientHeight = Math.max(1, window.innerHeight);
    ambientRatio = Math.min(window.devicePixelRatio || 1, 1);
    ambientCanvas.width = Math.round(ambientWidth * ambientRatio);
    ambientCanvas.height = Math.round(ambientHeight * ambientRatio);
    ambientCanvas.style.width = ambientWidth + "px";
    ambientCanvas.style.height = ambientHeight + "px";
    ambientParticles = makeAmbientParticles();
    resetAmbientField();
    ambientCanvas.style.visibility = sceneVisible ? "visible" : "hidden";
    stage.dataset.ambientParticleCount = String(ambientParticles.length);
    drawAmbientField(sceneTime, 0);
    requestSceneAnimation();
  }

  if ("ResizeObserver" in window) new ResizeObserver(resizeStage).observe(stage);
  else window.addEventListener("resize", resizeStage, { passive: true });
  resizeStage();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  reduceMotion.addEventListener("change", () => {
    folderSystems.forEach((system) => {
      if (!system?.visible) return;
      if (reduceMotion.matches) system.resetAmbient();
      system.draw(targetPosition, sceneTime, 0);
    });
    if (reduceMotion.matches) resetAmbientField();
    if (sceneFrame) cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
    visualPosition = reduceMotion.matches ? activeIndex : targetPosition;
    paintScene(visualPosition, sceneTime);
    drawAmbientField(sceneTime, 0);
    onScroll();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && sceneFrame) {
      cancelAnimationFrame(sceneFrame);
      sceneFrame = 0;
    } else requestSceneAnimation();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      sceneVisible = entry.isIntersecting;
      ambientCanvas.style.visibility = entry.isIntersecting && entry.intersectionRatio >= .01 ? "visible" : "hidden";
      if (sceneVisible) requestSceneAnimation();
      else {
        resetAmbientField();
        if (sceneFrame) {
          cancelAnimationFrame(sceneFrame);
          sceneFrame = 0;
        }
      }
    }, { threshold: [.01] }).observe(stage);
  }

  controls.hidden = false;
  stage.dataset.motionPaused = "false";
  paintScene(0, performance.now());
  readScroll();
})();
