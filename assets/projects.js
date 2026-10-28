(() => {
  const options = Array.from(document.querySelectorAll("[data-project-view]"));
  const previous = document.querySelector("[data-view-prev]");
  const next = document.querySelector("[data-view-next]");
  const detail = document.querySelector("[data-view-detail]");
  const index = document.querySelector("[data-view-index]");
  const facets = Array.from(document.querySelectorAll("[data-view-facet]"));
  const viewGroup = document.querySelector(".project-view-options");
  const stage = document.querySelector(".project-stage");
  const card = document.querySelector(".project-card");
  const controls = document.querySelector(".project-view-controls");
  const compactLayout = window.matchMedia("(max-width: 620px)");

  if (!options.length || !previous || !next || !detail || !index || !viewGroup || !stage || !controls) return;

  const views = [
    {
      id: "desktop",
      detail: {
        en: "Electron hosts the desktop app; the interface is built with Vite and React.",
        pt: "Electron hospeda o aplicativo desktop; a interface é construída com Vite e React.",
      },
    },
    {
      id: "data",
      detail: {
        en: "The project uses sql.js with Drizzle ORM for data access.",
        pt: "O projeto usa sql.js com Drizzle ORM para acesso aos dados.",
      },
    },
    {
      id: "archive",
      detail: {
        en: "Archive tooling includes yauzl and node-unrar-js.",
        pt: "As ferramentas de arquivo incluem yauzl e node-unrar-js.",
      },
    },
    {
      id: "matching",
      detail: {
        en: "File-name similarity uses a project-owned Levenshtein implementation.",
        pt: "A similaridade entre nomes de arquivo usa uma implementação própria de Levenshtein.",
      },
    },
  ];
  const language = document.documentElement.lang.toLowerCase().startsWith("pt") ? "pt" : "en";

  let activeIndex = Math.max(0, views.findIndex(({ id }) => options.some((option) => option.dataset.projectView === id && option.getAttribute("aria-pressed") === "true")));

  function selectView(nextIndex) {
    activeIndex = (nextIndex + views.length) % views.length;
    const activeView = views[activeIndex];

    options.forEach((option) => {
      option.setAttribute("aria-pressed", String(option.dataset.projectView === activeView.id));
    });
    facets.forEach((facet) => {
      const facetIndex = views.findIndex(({ id }) => id === facet.dataset.viewFacet);
      const isActive = facetIndex === activeIndex;
      facet.dataset.active = String(isActive);

      if (compactLayout.matches) {
        delete facet.dataset.slot;
        return;
      }

      const offset = (facetIndex - activeIndex + views.length) % views.length;
      let slot = "far-left";
      if (offset === 0) slot = "active";
      else if (offset === 1) slot = "right";
      else if (offset === views.length - 1) slot = "left";
      else if (activeIndex % 2 === 1) slot = "far-right";
      facet.dataset.slot = slot;
    });
    stage.dataset.activeView = activeView.id;
    if (card) card.dataset.activeView = activeView.id;
    detail.textContent = activeView.detail[language];
    index.textContent = String(activeIndex + 1).padStart(2, "0");
  }

  options.forEach((option) => {
    option.addEventListener("click", () => {
      const nextIndex = views.findIndex(({ id }) => id === option.dataset.projectView);
      if (nextIndex >= 0) selectView(nextIndex);
    });
  });

  previous.addEventListener("click", () => selectView(activeIndex - 1));
  next.addEventListener("click", () => selectView(activeIndex + 1));

  viewGroup.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectView(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    options[activeIndex].focus();
  });

  compactLayout.addEventListener("change", () => selectView(activeIndex));

  let pointerStart = null;
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button, a")) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointerup", (event) => {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    selectView(activeIndex + (deltaX < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  selectView(activeIndex);
  controls.hidden = false;
})();
