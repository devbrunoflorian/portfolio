(() => {
  const gallery = document.querySelector("[data-project-gallery]");
  const stage = document.querySelector("[data-project-arc]");
  const screens = Array.from(document.querySelectorAll("[data-project-screen]"));
  const controls = document.querySelector("[data-project-controls]");
  const selectButtons = Array.from(document.querySelectorAll("[data-project-select]"));
  const previous = document.querySelector("[data-project-previous]");
  const next = document.querySelector("[data-project-next]");
  const title = document.querySelector("[data-project-title]");
  const description = document.querySelector("[data-project-description]");
  const status = document.querySelector("[data-project-status]");
  const index = document.querySelector("[data-project-index]");
  const tags = document.querySelector("[data-project-tags]");
  const link = document.querySelector("[data-project-link]");
  const incomingNote = document.querySelector("[data-project-incoming]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!gallery || !stage || screens.length !== 5 || selectButtons.length !== screens.length || !controls) return;

  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  const projects = [
    {
      title: "CC Catalog",
      state: isEnglish ? "Available" : "Disponível",
      description: isEnglish
        ? "A desktop catalog for organizing credits attached to The Sims custom content."
        : "Um catálogo desktop para organizar créditos associados a conteúdos personalizados de The Sims.",
      tags: ["Electron", "Vite", "React", "sql.js", "Drizzle"],
      href: "https://github.com/devbrunoflorian/CC-Catalog",
    },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This space is reserved for a future project." : "Este espaço está reservado para um projeto futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This space is reserved for a future project." : "Este espaço está reservado para um projeto futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This space is reserved for a future project." : "Este espaço está reservado para um projeto futuro." },
    { title: isEnglish ? "Incoming" : "Em breve", state: "INCOMING", description: isEnglish ? "This space is reserved for a future project." : "Este espaço está reservado para um projeto futuro." },
  ];
  const formatIndex = (value) => String(value + 1).padStart(2, "0");
  let activeIndex = 0;
  let visualIndex = 0;
  let sceneFrame = 0;
  let pointerGesture = null;
  let wheelDelta = 0;
  let lastWheelSelection = 0;
  let stageVisible = true;

  function updateCopy(nextIndex) {
    const project = projects[nextIndex];
    title.textContent = project.title;
    description.textContent = project.description;
    status.textContent = project.state;
    index.textContent = formatIndex(nextIndex);
    const incoming = !project.href;
    tags.hidden = incoming;
    link.hidden = incoming;
    incomingNote.hidden = !incoming;
    if (!incoming) {
      link.href = project.href;
    }
    selectButtons.forEach((button, buttonIndex) => {
      button.setAttribute("aria-pressed", String(buttonIndex === nextIndex));
    });
    screens.forEach((screen, screenIndex) => {
      screen.classList.toggle("is-active", screenIndex === nextIndex);
    });
  }

  function layoutStep() {
    const mobile = window.matchMedia("(max-width: 780px)").matches;
    return Math.min(mobile ? 230 : 370, stage.clientWidth * (mobile ? .6 : .245));
  }

  function paintScene(position) {
    const step = layoutStep();
    const mobile = window.matchMedia("(max-width: 780px)").matches;
    screens.forEach((screen, itemIndex) => {
      let offset = itemIndex - position;
      if (offset > screens.length / 2) offset -= screens.length;
      if (offset < -screens.length / 2) offset += screens.length;
      const distance = Math.abs(offset);
      const scale = Math.max(mobile ? .52 : .47, 1 - distance * (mobile ? .23 : .17));
      const x = offset * step;
      const y = Math.min(54, distance * (mobile ? 14 : 19));
      const z = -distance * (mobile ? 112 : 182);
      const rotation = Math.max(-38, Math.min(38, -offset * (mobile ? 20 : 19)));
      const opacity = Math.max(.1, 1 - distance * (mobile ? .34 : .22));
      const blur = Math.max(0, distance - 1.05) * (mobile ? .6 : 1.1);
      screen.style.transform = "translate3d(calc(-50% + " + x + "px), calc(-50% + " + y + "px), " + z + "px) rotateY(" + rotation + "deg) scale(" + scale + ")";
      screen.style.opacity = String(opacity);
      screen.style.filter = "blur(" + blur + "px)";
      screen.style.zIndex = String(100 - Math.round(distance * 10));
    });
  }

  function animateScene() {
    sceneFrame = 0;
    if (!stageVisible || document.hidden) return;
    const difference = activeIndex - visualIndex;
    if (reduceMotion.matches || Math.abs(difference) < .002) {
      visualIndex = activeIndex;
      paintScene(visualIndex);
      return;
    }
    visualIndex += difference * .16;
    paintScene(visualIndex);
    sceneFrame = requestAnimationFrame(animateScene);
  }

  function requestScene() {
    if (!stageVisible || document.hidden) return;
    if (reduceMotion.matches) {
      visualIndex = activeIndex;
      paintScene(visualIndex);
      return;
    }
    if (!sceneFrame) sceneFrame = requestAnimationFrame(animateScene);
  }

  function selectProject(nextIndex) {
    const selected = Math.max(0, Math.min(projects.length - 1, nextIndex));
    if (selected === activeIndex) return;
    activeIndex = selected;
    updateCopy(activeIndex);
    requestScene();
  }

  previous.addEventListener("click", () => selectProject(activeIndex - 1));
  next.addEventListener("click", () => selectProject(activeIndex + 1));
  selectButtons.forEach((button) => {
    button.addEventListener("click", () => selectProject(Number(button.dataset.projectSelect)));
  });
  stage.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectProject(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectProject(activeIndex + 1);
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
    selectProject(activeIndex + (deltaX < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => { pointerGesture = null; });
  stage.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    const direction = event.deltaY > 0 ? 1 : -1;
    if ((direction > 0 && activeIndex === projects.length - 1) || (direction < 0 && activeIndex === 0)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelSelection < 470) {
      wheelDelta = 0;
      return;
    }
    if (wheelDelta && Math.sign(wheelDelta) !== direction) wheelDelta = 0;
    wheelDelta += event.deltaY;
    if (Math.abs(wheelDelta) < 42) return;
    selectProject(activeIndex + direction);
    wheelDelta = 0;
    lastWheelSelection = now;
  }, { passive: false });

  window.addEventListener("resize", () => paintScene(visualIndex), { passive: true });
  reduceMotion.addEventListener("change", () => {
    if (sceneFrame) cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
    visualIndex = activeIndex;
    paintScene(visualIndex);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && sceneFrame) {
      cancelAnimationFrame(sceneFrame);
      sceneFrame = 0;
    } else requestScene();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      if (stageVisible) requestScene();
      else if (sceneFrame) {
        cancelAnimationFrame(sceneFrame);
        sceneFrame = 0;
      }
    }, { threshold: .01 }).observe(gallery);
  }

  controls.hidden = false;
  updateCopy(0);
  paintScene(0);
})();
