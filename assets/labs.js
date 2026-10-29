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
  let stageWidth = 1;
  let stageHeight = 1;
  let stageRatio = 1;
  const folderSystems = [];

  const transitionCanvas = document.createElement("canvas");
  transitionCanvas.className = "lab-transition-field";
  transitionCanvas.setAttribute("aria-hidden", "true");
  stage.appendChild(transitionCanvas);
  const transitionContext = transitionCanvas.getContext("2d", { alpha: true });
  const bridgeParticles = Array.from({ length: 156 }, (_, index) => ({
    phase: index / 156,
    drift: ((Math.sin(index * 71.73) + 1) * .5 - .5) * .12,
    size: .45 + ((Math.sin(index * 18.91) + 1) * .5) * 1.25,
    spreadX: Math.sin(index * 8.17) * (6 + ((Math.sin(index * 29.41) + 1) * .5) * 11),
    spreadY: Math.cos(index * 12.37) * (8 + ((Math.sin(index * 41.03) + 1) * .5) * 15),
    binary: index % 9 === 0,
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
    sticky.dataset.final = String(nextIndex === folders.length - 1);
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
    const segment = Math.min(folders.length - 2, Math.floor(position));
    const fraction = clamp(position - segment);
    const energy = reduceMotion.matches ? 0 : Math.pow(Math.sin(Math.PI * fraction), 1.35);
    return { segment, fraction, energy };
  }

  function paintScene(position, time) {
    const mobile = window.matchMedia("(max-width: 780px)").matches;
    const step = sceneStep();
    const transition = transitionState(position);
    folders.forEach((folder, index) => {
      let offset = index - position;
      if (offset > folders.length / 2) offset -= folders.length;
      if (offset < -folders.length / 2) offset += folders.length;
      const distance = Math.abs(offset);
      const scale = Math.max(.48, 1 - distance * (mobile ? .25 : .155));
      const isOutgoing = index === transition.segment;
      const isIncoming = index === transition.segment + 1;
      const participating = isOutgoing || isIncoming;
      const energy = participating ? transition.energy : 0;
      const directionalLift = isOutgoing ? 1 : -1;
      const x = offset * step;
      const y = Math.min(52, distance * 16) + (participating ? energy * 10 * directionalLift : 0);
      const z = -distance * (mobile ? 95 : 160) - (participating ? energy * 18 : 0);
      const rotation = Math.max(-42, Math.min(42, -offset * 24 - (distance < .02 ? 6 : 0))) + (participating ? energy * 4 * directionalLift : 0);
      const opacity = Math.max(.18, 1 - distance * .22) * (participating ? 1 - energy * .16 : 1);
      const blur = Math.max(0, distance - .8) * (mobile ? .7 : 1.2) + (participating ? energy * .35 : 0);
      folder.style.transform = "translate3d(calc(-50% + " + x + "px), calc(-50% + " + y + "px), " + z + "px) rotateY(" + rotation + "deg) scale(" + scale + ")";
      folder.style.opacity = String(opacity);
      folder.style.filter = "blur(" + blur + "px)";
      folder.style.zIndex = String(100 - Math.round(distance * 10));
      folder.dataset.transition = participating ? String(energy) : "0";
    });
    if (transitionContext) paintParticleBridge(transition, time);
  }

  function paintParticleBridge(transition, time) {
    transitionContext.setTransform(stageRatio, 0, 0, stageRatio, 0, 0);
    transitionContext.clearRect(0, 0, stageWidth, stageHeight);
    const intensity = smoothstep((transition.energy - .04) / .7);
    if (intensity < .015) return;

    const from = folders[transition.segment].getBoundingClientRect();
    const to = folders[transition.segment + 1].getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const startX = from.left - stageBounds.left + from.width * .56;
    const startY = from.top - stageBounds.top + from.height * .53;
    const endX = to.left - stageBounds.left + to.width * .48;
    const endY = to.top - stageBounds.top + to.height * .51;
    const curveX = (startX + endX) * .5;
    const curveY = (startY + endY) * .5 - Math.min(70, stageHeight * .09);
    const travel = transition.fraction * .72 + time * .000012;

    bridgeParticles.forEach((particle) => {
      const progress = (particle.phase + travel + particle.drift + 1) % 1;
      const inverse = 1 - progress;
      const spread = Math.sin(progress * Math.PI);
      const x = inverse * inverse * startX + 2 * inverse * progress * curveX + progress * progress * endX + particle.spreadX * spread;
      const y = inverse * inverse * startY + 2 * inverse * progress * curveY + progress * progress * endY + particle.spreadY * spread;
      const envelope = .38 + Math.sin(progress * Math.PI) * .62;
      const pulse = .78 + Math.sin(time * .0016 + particle.phase * 28) * .22;
      transitionContext.globalAlpha = intensity * envelope * pulse * (particle.binary ? 1.1 : .86);
      transitionContext.fillStyle = particle.binary ? "#e1f2ff" : "#91c8ff";
      transitionContext.shadowColor = "rgba(95, 174, 255, .76)";
      transitionContext.shadowBlur = particle.binary ? 12 : 8;
      if (particle.binary) {
        transitionContext.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
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
    const difference = targetPosition - visualPosition;
    visualPosition += difference * (1 - Math.exp(-delta * .012));
    if (Math.abs(targetPosition - visualPosition) < .001) visualPosition = targetPosition;
    paintScene(visualPosition, time);

    if (time - lastCanvasTime >= 1000 / 30 || reduceMotion.matches) {
      const canvasDelta = lastCanvasTime ? Math.min(100, time - lastCanvasTime) : delta;
      lastCanvasTime = time;
      folderSystems.forEach((system) => {
        const deltaStrength = system.pointer.targetStrength - system.pointer.strength;
        system.pointer.strength += deltaStrength * (1 - Math.exp(-canvasDelta * (deltaStrength < 0 ? .022 : .013)));
        if (Math.abs(deltaStrength) < .006) system.pointer.strength = system.pointer.targetStrength;
        system.draw(visualPosition, time);
      });
    }

    const pointerInMotion = folderSystems.some((system) => Math.abs(system.pointer.targetStrength - system.pointer.strength) > .006);
    if (!reduceMotion.matches && (!motionPaused || Math.abs(targetPosition - visualPosition) > .002 || pointerInMotion)) {
      sceneFrame = requestAnimationFrame(animateScene);
    }
  }

  function requestSceneAnimation() {
    if (sceneFrame || !sceneVisible || document.hidden) return;
    if (reduceMotion.matches) {
      visualPosition = activeIndex;
      paintScene(visualPosition, performance.now());
      folderSystems.forEach((system) => system.draw(visualPosition, performance.now()));
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
    const pointer = { x: -1000, y: -1000, strength: 0, targetStrength: 0, width: 1, height: 1, ratio: 1 };
    const system = { folder, canvas, context, reflectionCanvas, reflectionContext, pointer, folderIndex, faces: [], particles: [], bottom: .87, draw: null };

    function polygon(width, height, dx = 0, dy = 0) {
      const bottom = isMobileScene() ? .67 : .87;
      return [
        [width * .055 + dx, height * .16 + dy], [width * .33 + dx, height * .16 + dy],
        [width * .415 + dx, height * .25 + dy], [width * .91 + dx, height * .25 + dy],
        [width * .91 + dx, height * bottom + dy], [width * .055 + dx, height * bottom + dy],
      ];
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
      for (let y = minY + spacingY * .5, row = 0; y < maxY; y += spacingY, row++) {
        for (let x = minX + spacingX * .5, column = 0; x < maxX; x += spacingX, column++) {
          if (!pointInPolygon(x, y, points)) continue;
          const cellSeed = row * 83 + column * 29 + seed * 13;
          const edgeDistance = distanceToEdge(x, y, points);
          cells.push({
            x,
            y,
            edgeGlow: clamp(1 - edgeDistance / (spacingX * 1.65)),
            phase: noise(cellSeed + 11) * Math.PI * 2,
            baseBit: noise(cellSeed + 17) > .46 ? "1" : "0",
            scatterX: (noise(cellSeed + 23) - .5) * 78,
            scatterY: (noise(cellSeed + 31) - .5) * 66,
            order: noise(cellSeed + 41),
            sparse: noise(cellSeed + 53),
            glow: .78 + noise(cellSeed + 61) * .22,
          });
        }
      }
      return { points, cells, kind };
    }

    function makeEdgeParticles(points, amount) {
      return Array.from({ length: amount }, (_, index) => {
        const edgeIndex = [0, 1, 1, 2, 2, 2, 3, 3, 5][Math.floor(noise(index * 4) * 9)];
        const start = points[edgeIndex];
        const end = points[(edgeIndex + 1) % points.length];
        const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
        return {
          edgeIndex,
          along: noise(index * 4 + 1),
          outward: 1.5 + noise(index * 4 + 2) * 54,
          radius: .5 + noise(index * 4 + 3) * 1.6,
          phase: noise(index * 4 + 4) * Math.PI * 2,
          speed: .18 + noise(index * 4 + 5) * .36,
          scatterX: (noise(index * 4 + 6) - .5) * 90,
          scatterY: (noise(index * 4 + 7) - .5) * 74,
          edgeNormalX: (end[1] - start[1]) / edgeLength,
          edgeNormalY: -(end[0] - start[0]) / edgeLength,
        };
      });
    }

    function transitionAmount(role, energy, cellOrder, fraction) {
      if (!role || energy <= .015) return 0;
      const scatter = role === "outgoing"
        ? energy * .82
        : .45 * (1 - smoothstep(fraction / .83));
      return smoothstep((scatter - cellOrder * .2) / .58);
    }

    function drawFace(face, baseAlpha, isActive, role, energy, fraction, time) {
      const active = isActive;
      context.fillStyle = face.kind === "side"
        ? (active ? "#9ccfff" : "#5988bd")
        : (active ? "#dceeff" : "#83b4e8");
      const radius = Math.min(pointer.width, pointer.height) * .19;
      face.cells.forEach((cell) => {
        if (!active && cell.sparse < .2) return;
        const scatter = transitionAmount(role, energy, cell.order, fraction);
        const dx = cell.x - pointer.x;
        const dy = cell.y - pointer.y;
        const local = pointer.strength * Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
        const distance = Math.hypot(dx, dy) || 1;
        const pointerWarp = local * (active ? 13 : 7);
        const driftX = Math.sin(time * .00031 + cell.phase) * .34;
        const driftY = Math.cos(time * .00039 + cell.phase * 1.3) * .44;
        const x = cell.x + cell.scatterX * scatter + dx / distance * pointerWarp + driftX;
        const y = cell.y + cell.scatterY * scatter + dy / distance * pointerWarp + driftY;
        const flicker = Math.sin(time * (.00055 + cell.sparse * .00065) + cell.phase);
        const changed = flicker > .985;
        const bit = changed ? (cell.baseBit === "0" ? "1" : "0") : cell.baseBit;
        const shimmer = .86 + (flicker + 1) * .07;
        const contour = .78 + cell.edgeGlow * (active ? .78 : .34);
        const disturbed = local * (active ? .28 : .12);
        const coherence = 1 - scatter * (role === "outgoing" ? .2 : .1);
        const lightAlpha = baseAlpha * contour * shimmer * cell.glow * (1 + disturbed) * coherence;
        context.globalAlpha = Math.min(active ? 1 : .5, lightAlpha);
        context.fillStyle = active && cell.edgeGlow > .48 ? "#f0f8ff" : (face.kind === "side"
          ? (active ? "#9ccfff" : "#5988bd")
          : (active ? "#dceeff" : "#83b4e8"));
        context.fillText(bit, x, y);
      });
    }

    function drawParticles(points, isActive, role, energy, fraction, time) {
      const active = isActive;
      const pointerRadius = Math.min(pointer.width, pointer.height) * .2;
      const amount = active ? system.particles.length : Math.min(68, system.particles.length);
      for (let index = 0; index < amount; index++) {
        const particle = system.particles[index];
        const start = points[particle.edgeIndex];
        const end = points[(particle.edgeIndex + 1) % points.length];
        const along = (particle.along + time * .000016 * particle.speed) % 1;
        const scatter = transitionAmount(role, energy, noise(index + 61), fraction);
        const baseX = start[0] + (end[0] - start[0]) * along + particle.edgeNormalX * particle.outward;
        const baseY = start[1] + (end[1] - start[1]) * along + particle.edgeNormalY * particle.outward;
        const dx = baseX - pointer.x;
        const dy = baseY - pointer.y;
        const falloff = pointer.strength * Math.exp(-(dx * dx + dy * dy) / (2 * pointerRadius * pointerRadius));
        const distance = Math.hypot(dx, dy) || 1;
        const float = Math.sin(time * .00055 + particle.phase) * (active ? 2.4 : 1.1);
        const x = baseX + particle.scatterX * (scatter * .42) + dx / distance * falloff * 11;
        const y = baseY + particle.scatterY * (scatter * .42) + float + dy / distance * falloff * 11;
        const alpha = (active ? .78 : .15) * (.46 + (Math.sin(time * .0012 + particle.phase) + 1) * .27) * (1 - scatter * .4);
        context.globalAlpha = alpha;
        context.fillStyle = "#d9eeff";
        context.shadowColor = "rgba(111, 184, 255, .86)";
        context.shadowBlur = active ? 8 : 2;
        context.beginPath();
        context.arc(x, y, particle.radius * (active ? 1.25 : .78), 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
    }

    function draw(position, time) {
      context.setTransform(pointer.ratio, 0, 0, pointer.ratio, 0, 0);
      context.clearRect(0, 0, pointer.width, pointer.height);
      const front = polygon(pointer.width, pointer.height);
      const bottom = system.bottom;
      const back = [
        [pointer.width * .14, pointer.height * .075],
        [pointer.width * .375, pointer.height * .075],
        [pointer.width * .46, pointer.height * .195],
        [pointer.width * .965, pointer.height * .195],
        [pointer.width * .94, pointer.height * (bottom - .012)],
        [pointer.width * .09, pointer.height * (bottom + .012)],
      ];
      const sideRight = [front[3], front[4], back[4], back[3]];
      const sideBottom = [front[4], front[5], back[5], back[4]];
      const active = folder.classList.contains("is-active");
      const transition = transitionState(position);
      const role = folderIndex === transition.segment ? "outgoing" : folderIndex === transition.segment + 1 ? "incoming" : "";
      const energy = role ? transition.energy : 0;

      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = (pointer.width < 245 ? 7 : 9) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
      drawFace(system.faces[0], active ? .36 : .1, active, role, energy, transition.fraction, time);
      drawFace(system.faces[1], active ? .34 : .12, active, role, energy, transition.fraction, time);
      drawFace(system.faces[2], active ? .29 : .1, active, role, energy, transition.fraction, time);
      context.font = (pointer.width < 245 ? 10 : 13) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
      drawFace(system.faces[3], active ? 1.1 : .53, active, role, energy, transition.fraction, time);
      drawParticles(front, active, role, energy, transition.fraction, time);
      context.globalAlpha = 1;

      if (reflectionContext) {
        reflectionContext.setTransform(1, 0, 0, 1, 0, 0);
        reflectionContext.clearRect(0, 0, reflectionCanvas.width, reflectionCanvas.height);
        reflectionContext.save();
        reflectionContext.translate(0, reflectionCanvas.height);
        reflectionContext.scale(1, -1);
        reflectionContext.drawImage(canvas, 0, pointer.height * .11 * pointer.ratio, canvas.width, pointer.height * bottom * pointer.ratio, 0, 0, reflectionCanvas.width, reflectionCanvas.height);
        reflectionContext.restore();
      }
      folder.dataset.pointerForce = pointer.strength.toFixed(3);
    }

    system.draw = draw;
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
      const front = polygon(pointer.width, pointer.height);
      const bottom = system.bottom;
      const back = [
        [pointer.width * .14, pointer.height * .075], [pointer.width * .375, pointer.height * .075],
        [pointer.width * .46, pointer.height * .195], [pointer.width * .965, pointer.height * .195],
        [pointer.width * .94, pointer.height * (bottom - .012)], [pointer.width * .09, pointer.height * (bottom + .012)],
      ];
      const sideRight = [front[3], front[4], back[4], back[3]];
      const sideBottom = [front[4], front[5], back[5], back[4]];
      system.faces = [
        makeFace(back, 14, 16, 19, "rear"),
        makeFace(sideRight, 11, 14, 5, "side"),
        makeFace(sideBottom, 11, 14, 7, "side"),
        makeFace(front, pointer.width < 245 ? 12.5 : 14, pointer.width < 245 ? 14 : 15, 11, "front"),
      ];
      system.particles = makeEdgeParticles(front, 260);
      draw(visualPosition, performance.now());
      requestSceneAnimation();
    }

    canvas.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches || event.pointerType === "touch") return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / Math.max(1, bounds.width) * pointer.width;
      pointer.y = (event.clientY - bounds.top) / Math.max(1, bounds.height) * pointer.height;
      pointer.targetStrength = .95;
      requestSceneAnimation();
    }, { passive: true });
    const releasePointer = () => {
      pointer.targetStrength = 0;
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
    requestSceneAnimation();
  }

  if ("ResizeObserver" in window) new ResizeObserver(resizeStage).observe(stage);
  else window.addEventListener("resize", resizeStage, { passive: true });
  resizeStage();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  reduceMotion.addEventListener("change", () => {
    folderSystems.forEach((system) => {
      system.pointer.strength = 0;
      system.pointer.targetStrength = 0;
      system.draw(targetPosition, performance.now());
    });
    if (sceneFrame) cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
    visualPosition = reduceMotion.matches ? activeIndex : targetPosition;
    paintScene(visualPosition, performance.now());
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
      if (sceneVisible) requestSceneAnimation();
      else if (sceneFrame) {
        cancelAnimationFrame(sceneFrame);
        sceneFrame = 0;
      }
    }, { threshold: .01 }).observe(stage);
  }

  controls.hidden = false;
  stage.dataset.motionPaused = "false";
  paintScene(0, performance.now());
  readScroll();
})();
