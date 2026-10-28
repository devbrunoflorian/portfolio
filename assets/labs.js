(() => {
  const runway = document.querySelector("[data-labs-runway]");
  const stage = document.querySelector("[data-lab-scene]");
  const collection = document.querySelector("[data-lab-collection]");
  const folders = Array.from(document.querySelectorAll("[data-lab-folder]"));
  const controls = document.querySelector("[data-lab-controls]");
  const previous = document.querySelector("[data-lab-previous]");
  const next = document.querySelector("[data-lab-next]");
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

  if (!runway || !stage || !collection || folders.length !== 5 || !controls) return;

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
  let targetPosition = 0;
  let visualPosition = 0;
  let activeIndex = 0;
  let sceneFrame = 0;
  let scrollFrame = 0;
  let pointerGesture = null;
  let sceneVisible = true;
  const folderPointers = [];

  function pageProgress() {
    const runwayTop = runway.getBoundingClientRect().top + window.scrollY;
    const scrollDistance = Math.max(1, runway.offsetHeight - window.innerHeight);
    return Math.max(0, Math.min(1, (window.scrollY - runwayTop) / scrollDistance));
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
      folderPointers[index]?.draw?.();
    });
  }

  function sceneStep() {
    const mobile = window.matchMedia("(max-width: 780px)").matches;
    return stage.clientWidth * (mobile ? 0.46 : 0.235);
  }

  function paintScene(position) {
    const step = sceneStep();
    folders.forEach((folder, index) => {
      let offset = index - position;
      if (offset > folders.length / 2) offset -= folders.length;
      if (offset < -folders.length / 2) offset += folders.length;
      const distance = Math.abs(offset);
      const scale = Math.max(.48, 1 - distance * (window.matchMedia("(max-width: 780px)").matches ? .25 : .155));
      const x = offset * step;
      const y = Math.min(52, distance * 16);
      const z = -distance * (window.matchMedia("(max-width: 780px)").matches ? 95 : 160);
      const rotation = Math.max(-42, Math.min(42, -offset * 24));
      const opacity = Math.max(.18, 1 - distance * .22);
      const blur = Math.max(0, distance - .8) * (window.matchMedia("(max-width: 780px)").matches ? .7 : 1.2);
      folder.style.transform = "translate3d(calc(-50% + " + x + "px), calc(-50% + " + y + "px), " + z + "px) rotateY(" + rotation + "deg) scale(" + scale + ")";
      folder.style.opacity = String(opacity);
      folder.style.filter = "blur(" + blur + "px)";
      folder.style.zIndex = String(100 - Math.round(distance * 10));
    });
  }

  function animateScene() {
    sceneFrame = 0;
    if (!sceneVisible || document.hidden) return;
    const difference = targetPosition - visualPosition;
    if (reduceMotion.matches || Math.abs(difference) < .002) {
      visualPosition = targetPosition;
      paintScene(visualPosition);
      return;
    }
    visualPosition += difference * .16;
    paintScene(visualPosition);
    sceneFrame = requestAnimationFrame(animateScene);
  }

  function requestSceneAnimation() {
    if (sceneFrame || !sceneVisible || document.hidden) return;
    if (reduceMotion.matches) {
      visualPosition = targetPosition;
      paintScene(visualPosition);
      return;
    }
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
    const pointer = { x: -1000, y: -1000, strength: 0, targetStrength: 0, frame: 0, width: 1, height: 1, ratio: 1 };
    const folderHue = Number(folder.style.getPropertyValue("--folder-hue")) || 210;
    const polygon = (width, height, dx, dy) => {
      const bottom = width < 245 ? .67 : .8;
      return [
        [width * .055 + dx, height * .16 + dy], [width * .33 + dx, height * .16 + dy],
        [width * .415 + dx, height * .25 + dy], [width * .945 + dx, height * .25 + dy],
        [width * .945 + dx, height * bottom + dy], [width * .055 + dx, height * bottom + dy],
      ];
    };
    const pointInPolygon = (x, y, points) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i][0], yi = points[i][1], xj = points[j][0], yj = points[j][1];
        const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
      }
      return inside;
    };
    const trace = (points, close = true) => {
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
      if (close) context.closePath();
    };
    const drawFace = (points, spacingX, spacingY, seed, alpha, side = false) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(pointer.width, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys)), maxY = Math.min(pointer.height, Math.max(...ys));
      const radius = Math.min(pointer.width, pointer.height) * .2;
      for (let y = minY + spacingY * .5; y < maxY; y += spacingY) {
        for (let x = minX + spacingX * .5; x < maxX; x += spacingX) {
          if (!pointInPolygon(x, y, points)) continue;
          const distanceX = x - pointer.x;
          const distanceY = y - pointer.y;
          const local = pointer.strength * Math.exp(-(distanceX * distanceX + distanceY * distanceY) / (2 * radius * radius));
          const distance = Math.hypot(distanceX, distanceY) || 1;
          const warpX = (distanceX / distance) * local * 11;
          const warpY = (distanceY / distance) * local * 11;
          const jitter = Math.sin(x * .037 + y * .021 + seed) * .75;
          const bit = ((Math.floor(x / spacingX) * 13 + Math.floor(y / spacingY) * 7 + seed + folderIndex) % 3 === 0) ? "0" : "1";
          const edge = Math.min(x - minX, maxX - x, y - minY, maxY - y) < spacingX * 1.2;
          context.globalAlpha = Math.min(.98, alpha * (.82 + (edge ? .17 : 0) + local * .14));
          context.fillStyle = "hsl(" + (folderHue + (side ? 13 : 0)) + " 100% " + (edge ? "96" : "89") + "%)";
          context.fillText(bit, x + warpX + jitter, y + warpY);
        }
      }
    };
    function draw() {
      context.clearRect(0, 0, pointer.width, pointer.height);
      const front = polygon(pointer.width, pointer.height, 0, 0);
      const back = polygon(pointer.width, pointer.height, 12, -9);
      const sideRight = [front[3], front[4], back[4], back[3]];
      const sideBottom = [front[4], front[5], back[5], back[4]];

      const backGlow = context.createLinearGradient(0, 0, pointer.width, pointer.height);
      backGlow.addColorStop(0, "rgba(86, 168, 255, .025)");
      backGlow.addColorStop(1, "rgba(39, 108, 201, .01)");
      trace(back);
      context.fillStyle = backGlow;
      context.fill();
      drawFace(back, 16, 17, 19, .18);

      [sideRight, sideBottom].forEach((face, index) => {
        trace(face);
        const shade = context.createLinearGradient(face[0][0], face[0][1], face[2][0], face[2][1]);
        shade.addColorStop(0, "rgba(97, 176, 255, .13)");
        shade.addColorStop(1, "rgba(7, 22, 44, .24)");
        context.fillStyle = shade;
        context.fill();
        drawFace(face, 8, 12, index + 5, .88, true);
      });

      trace(front);
      context.fillStyle = "rgba(3, 11, 24, .055)";
      context.fill();
      drawFace(front, pointer.width < 245 ? 12 : 14, pointer.width < 245 ? 13 : 15, 5, folder.classList.contains("is-active") ? .95 : .76);

      trace(back);
      context.strokeStyle = "rgba(118, 188, 255, .29)";
      context.lineWidth = 1;
      context.stroke();
      trace(front);
      context.strokeStyle = folder.classList.contains("is-active") ? "rgba(194, 227, 255, .91)" : "rgba(121, 182, 246, .5)";
      context.lineWidth = folder.classList.contains("is-active") ? 1.5 : 1;
      context.shadowBlur = folder.classList.contains("is-active") ? 12 : 4;
      context.shadowColor = "rgba(75, 163, 255, .8)";
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }
    pointer.draw = draw;
    folderPointers[folderIndex] = pointer;
    function renderPointer() {
      pointer.frame = 0;
      const blend = 1 - Math.exp(-(pointer.targetStrength < pointer.strength ? .32 : .12));
      pointer.strength += (pointer.targetStrength - pointer.strength) * blend;
      draw();
      if (Math.abs(pointer.targetStrength - pointer.strength) > .01) pointer.frame = requestAnimationFrame(renderPointer);
      else if (pointer.targetStrength === 0 && pointer.strength > 0) {
        pointer.strength = 0;
        draw();
      }
    }
    const requestPointerRender = () => {
      if (!pointer.frame && !reduceMotion.matches) pointer.frame = requestAnimationFrame(renderPointer);
      else if (reduceMotion.matches) draw();
    };
    const resize = () => {
      const bounds = folder.getBoundingClientRect();
      pointer.width = Math.max(1, bounds.width);
      pointer.height = Math.max(1, bounds.height);
      pointer.ratio = Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.round(pointer.width * pointer.ratio);
      canvas.height = Math.round(pointer.height * pointer.ratio);
      context.setTransform(pointer.ratio, 0, 0, pointer.ratio, 0, 0);
      context.font = (pointer.width < 245 ? 9 : 12) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      draw();
    };
    canvas.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches || event.pointerType === "touch") return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.targetStrength = .95;
      requestPointerRender();
    }, { passive: true });
    canvas.addEventListener("pointerleave", () => {
      pointer.targetStrength = 0;
      requestPointerRender();
    }, { passive: true });
    canvas.addEventListener("pointercancel", () => {
      pointer.targetStrength = 0;
      requestPointerRender();
    }, { passive: true });
    folders[folderIndex].dataset.canvasReady = "true";
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(folder);
    else window.addEventListener("resize", resize, { passive: true });
    resize();
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  reduceMotion.addEventListener("change", () => {
    folderPointers.forEach((pointer) => {
      if (pointer.frame) cancelAnimationFrame(pointer.frame);
      pointer.frame = 0;
      pointer.strength = 0;
      pointer.targetStrength = 0;
      pointer.draw();
    });
    if (sceneFrame) cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
    visualPosition = targetPosition;
    paintScene(visualPosition);
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
  paintScene(0);
  readScroll();
})();
