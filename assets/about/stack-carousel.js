const STEP_DESKTOP = 24;
const STEP_MOBILE = 18;
const RESUME_DELAY = 1200;
const AUTO_SCROLL_DIRECTION = -1;

export function mountStackCarousel(page) {
  const root = page.querySelector("[data-stack-root]");
  if (!root) return { setMotionPaused() {}, dispose() {} };

  const collections = [...root.querySelectorAll("[data-stack-collection]")];
  const collectionToggle = root.querySelector("[data-stack-collection-toggle]");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const hoverPreference = matchMedia("(hover: hover) and (pointer: fine)");
  let activeCollection = root.dataset.activeCollection || "main";
  let globalMotionPaused = false;
  let frame = 0;
  let frameTime = 0;
  let disposed = false;

  const now = () => performance.now();

  function setCollectionActive(name) {
    activeCollection = name;
    root.dataset.activeCollection = name;
    for (const collection of collections) {
      const active = collection.dataset.stackCollection === name;
      collection.hidden = !active;
      if (!active) continue;
      const tabState = collectionStates.get(collection);
      const state = panelStates.get(tabState?.panels[tabState.activeIndex]);
      if (state) {
        state.refresh();
        state.activate();
      }
    }
    if (collectionToggle) {
      const showingExtras = name === "extras";
      collectionToggle.setAttribute("aria-pressed", String(showingExtras));
      collectionToggle.querySelector("[data-stack-toggle-label]")?.remove();
      const label = showingExtras ? collectionToggle.dataset.extrasLabel : collectionToggle.dataset.mainLabel;
      const icon = collectionToggle.querySelector("[aria-hidden='true']");
      collectionToggle.textContent = label;
      if (icon) {
        collectionToggle.append(" ", icon);
        icon.textContent = showingExtras ? "↙" : "↗";
      }
    }
    schedule();
  }

  function schedule() {
    if (disposed || document.hidden || frame || !isAnyCarouselRunning()) return;
    frame = requestAnimationFrame(tick);
  }

  function isAnyCarouselRunning() {
    const active = collections.find(collection => collection.dataset.stackCollection === activeCollection);
    const tabState = active && collectionStates.get(active);
    const state = active && panelStates.get(tabState?.panels[tabState.activeIndex]);
    return Boolean(state?.canMove());
  }

  function tick(timestamp) {
    frame = 0;
    if (disposed || document.hidden) return;
    const active = collections.find(collection => collection.dataset.stackCollection === activeCollection);
    const tabState = active && collectionStates.get(active);
    const state = active && panelStates.get(tabState?.panels[tabState.activeIndex]);
    if (!state?.canMove()) {
      frameTime = 0;
      return;
    }
    const elapsed = frameTime ? Math.min(50, timestamp - frameTime) : 0;
    frameTime = timestamp;
    state.advance(elapsed);
    if (state.canMove()) frame = requestAnimationFrame(tick);
  }

  function createCollectionState(collection) {
    const tabs = [...collection.querySelectorAll("[data-stack-tab]")];
    const panels = [...collection.querySelectorAll("[data-stack-panel]")];
    let activeIndex = Number(collection.dataset.activeIndex || 0);

    function setTab(index, { focus = false, delay = true } = {}) {
      activeIndex = (index + tabs.length) % tabs.length;
      collection.dataset.activeIndex = String(activeIndex);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === activeIndex;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected) {
          const tablist = tab.closest("[role='tablist']");
          const left = tab.offsetLeft;
          const right = left + tab.offsetWidth;
          const visibleLeft = tablist.scrollLeft;
          const visibleRight = visibleLeft + tablist.clientWidth;
          if (left < visibleLeft) tablist.scrollLeft = left;
          else if (right > visibleRight) tablist.scrollLeft = right - tablist.clientWidth;
          if (focus) tab.focus({ preventScroll: true });
        }
      });
      panels.forEach((panel, panelIndex) => {
        panel.hidden = panelIndex !== activeIndex;
        if (panelIndex === activeIndex) {
          const state = panelStates.get(panel);
          state?.refresh();
          state?.activate(delay ? RESUME_DELAY : 0);
        }
      });
      schedule();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => setTab(index));
      tab.addEventListener("keydown", event => {
        const key = event.key;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
        event.preventDefault();
        const next = key === "Home" ? 0 : key === "End" ? tabs.length - 1
          : (index + (key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        setTab(next, { focus: true });
      });
    });

    return { setTab, tabs, panels, get activeIndex() { return activeIndex; } };
  }

  const panelStates = new Map();
  const collectionStates = new Map();

  function createPanelState(panel) {
    const viewport = panel.querySelector("[data-stack-window]");
    const track = panel.querySelector("[data-stack-track]");
    const baseList = panel.querySelector("[data-stack-items]");
    const controls = panel.querySelector("[data-stack-controls]");
    const motionButton = panel.querySelector("[data-stack-motion]");
    const carousel = panel.querySelector("[data-stack-carousel]");
    if (!viewport || !track || !baseList || !controls || !motionButton || !carousel) return null;

    let overflow = false;
    let visible = false;
    let hovered = false;
    let interactionPaused = false;
    let explicitlyPaused = false;
    let resumeAt = 0;
    let resumeTimer = 0;
    let copyWidth = 0;
    let expectedProgrammaticScroll = null;
    let autoScrollPosition = 0;
    let lastWrittenScrollLeft = 0;
    let touchStart = null;
    let touchLast = null;
    let gesturePaused = false;
    let disposedState = false;

    const clones = [];
    const setMotionLabel = () => {
      const paused = explicitlyPaused || interactionPaused;
      const label = paused ? motionButton.dataset.resumeLabel : motionButton.dataset.pauseLabel;
      const text = paused ? motionButton.dataset.resumeText : motionButton.dataset.pauseText;
      motionButton.textContent = text;
      motionButton.setAttribute("aria-label", label);
      motionButton.setAttribute("aria-pressed", String(paused));
    };
    const setScrollLeft = value => {
      viewport.scrollLeft = value;
      expectedProgrammaticScroll = viewport.scrollLeft;
      lastWrittenScrollLeft = viewport.scrollLeft;
    };
    const setManualPause = () => {
      interactionPaused = true;
      resumeAt = 0;
      autoScrollPosition = viewport.scrollLeft;
      lastWrittenScrollLeft = viewport.scrollLeft;
      setMotionLabel();
      frameTime = 0;
    };

    function refresh() {
      if (disposedState || !viewport.clientWidth) return;
      for (const clone of clones.splice(0)) clone.remove();
      track.dataset.static = "false";
      viewport.dataset.overflow = "false";
      overflow = baseList.scrollWidth > viewport.clientWidth + 1;
      controls.hidden = !overflow;
      if (!overflow) {
        track.dataset.static = "true";
        copyWidth = 0;
        autoScrollPosition = 0;
        setScrollLeft(0);
        return;
      }
      const firstClone = baseList.cloneNode(true);
      const secondClone = baseList.cloneNode(true);
      for (const clone of [firstClone, secondClone]) {
        clone.removeAttribute("id");
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.dataset.stackClone = "true";
        track.append(clone);
        clones.push(clone);
      }
      copyWidth = baseList.getBoundingClientRect().width;
      viewport.dataset.overflow = "true";
      setScrollLeft(copyWidth);
      autoScrollPosition = copyWidth;
      setMotionLabel();
    }

    function activate(delay = 0) {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeAt = delay ? now() + delay : 0;
      frameTime = 0;
      if (delay) {
        resumeTimer = window.setTimeout(() => {
          resumeTimer = 0;
          schedule();
        }, delay);
      } else {
        schedule();
      }
    }

    function canMove() {
      return overflow && visible && !hovered && !interactionPaused && !explicitlyPaused
        && !gesturePaused && !globalMotionPaused && !motionPreference.matches && !document.hidden
        && (!resumeAt || now() >= resumeAt);
    }

    function advance(elapsed) {
      if (!elapsed || !canMove()) return;
      const speed = innerWidth <= 700 ? STEP_MOBILE : STEP_DESKTOP;
      autoScrollPosition += AUTO_SCROLL_DIRECTION * speed * elapsed / 1000;
      if (autoScrollPosition <= 0) autoScrollPosition += copyWidth;
      const next = Math.round(autoScrollPosition);
      if (next !== lastWrittenScrollLeft) setScrollLeft(next);
    }

    viewport.addEventListener("scroll", () => {
      if (!overflow) return;
      const isProgrammatic = expectedProgrammaticScroll !== null
        && Math.abs(viewport.scrollLeft - expectedProgrammaticScroll) < 1;
      if (isProgrammatic) expectedProgrammaticScroll = null;
      else if (!touchStart) setManualPause();
      if (copyWidth > 0) {
        let left = viewport.scrollLeft;
        if (left < copyWidth * .5) left += copyWidth;
        else if (left > copyWidth * 1.5) left -= copyWidth;
        if (Math.abs(left - viewport.scrollLeft) > 1) {
          setScrollLeft(left);
          autoScrollPosition = left;
        }
      }
      schedule();
    }, { passive: true });

    viewport.addEventListener("focusin", () => setManualPause());
    const findTrackedTouch = (touchList, identifier) =>
      Array.from(touchList).find(touch => touch.identifier === identifier);
    viewport.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) return;
      const touch = event.changedTouches[0];
      touchStart = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
      touchLast = { x: touch.clientX, y: touch.clientY };
      gesturePaused = true;
      frameTime = 0;
    }, { passive: true });
    viewport.addEventListener("touchmove", event => {
      if (!touchStart) return;
      const touch = findTrackedTouch(event.changedTouches, touchStart.identifier);
      if (touch) touchLast = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    const finishTouch = event => {
      if (!touchStart) return;
      const touch = findTrackedTouch(event.changedTouches, touchStart.identifier);
      const end = touch ? { x: touch.clientX, y: touch.clientY } : touchLast;
      const dx = end.x - touchStart.x;
      const dy = end.y - touchStart.y;
      const horizontalSwipe = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
      touchStart = null;
      touchLast = null;
      gesturePaused = false;
      if (horizontalSwipe) setManualPause();
      else schedule();
    };
    viewport.addEventListener("touchend", finishTouch, { passive: true });
    viewport.addEventListener("touchcancel", finishTouch, { passive: true });
    viewport.addEventListener("wheel", event => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 4) setManualPause();
    }, { passive: true });
    viewport.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      setManualPause();
      const target = event.key === "Home" ? 0 : event.key === "End" ? viewport.scrollWidth
        : viewport.scrollLeft + (event.key === "ArrowRight" ? 1 : -1) * Math.max(160, viewport.clientWidth * .72);
      viewport.scrollTo({ left: target, behavior: motionPreference.matches ? "auto" : "smooth" });
    });
    carousel.addEventListener("pointerenter", () => {
      if (!hoverPreference.matches) return;
      hovered = true;
      frameTime = 0;
    });
    carousel.addEventListener("pointerleave", () => {
      if (!hoverPreference.matches) return;
      hovered = false;
      schedule();
    });
    for (const control of panel.querySelectorAll("[data-stack-step]")) {
      control.addEventListener("click", () => {
        setManualPause();
        const direction = Number(control.dataset.stackStep);
        viewport.scrollBy({ left: direction * Math.max(160, viewport.clientWidth * .72), behavior: motionPreference.matches ? "auto" : "smooth" });
      });
    }
    motionButton.addEventListener("click", () => {
      const shouldResume = explicitlyPaused || interactionPaused;
      explicitlyPaused = !shouldResume;
      interactionPaused = false;
      resumeAt = 0;
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = 0;
      setMotionLabel();
      frameTime = 0;
      schedule();
    });

    const visibilityObserver = new IntersectionObserver(entries => {
      visible = Boolean(entries[0]?.isIntersecting);
      frameTime = 0;
      schedule();
    }, { threshold: 0.01 });
    visibilityObserver.observe(viewport);

    return {
      refresh,
      activate,
      canMove,
      advance,
      setGlobalPaused(value) { globalMotionPaused = value; frameTime = 0; schedule(); },
      dispose() {
        disposedState = true;
        if (resumeTimer) window.clearTimeout(resumeTimer);
        visibilityObserver.disconnect();
        for (const clone of clones) clone.remove();
      },
    };
  }

  for (const collection of collections) {
    const tabState = createCollectionState(collection);
    collectionStates.set(collection, tabState);
    for (const panel of collection.querySelectorAll("[data-stack-panel]")) {
      const state = createPanelState(panel);
      if (!state) continue;
      panelStates.set(panel, state);
    }
  }

  collectionToggle?.addEventListener("click", () => {
    setCollectionActive(activeCollection === "main" ? "extras" : "main");
  });

  const observers = new ResizeObserver(() => {
    for (const collection of collections) {
      if (collection.dataset.stackCollection !== activeCollection) continue;
      const tabState = collectionStates.get(collection);
      const activePanel = tabState?.panels[tabState.activeIndex];
      panelStates.get(activePanel)?.refresh();
    }
    schedule();
  });
  observers.observe(root);
  for (const viewport of root.querySelectorAll("[data-stack-window]")) observers.observe(viewport);
  document.fonts?.ready.then(() => {
    if (disposed) return;
    for (const collection of collections) {
      if (collection.dataset.stackCollection !== activeCollection) continue;
      const tabState = collectionStates.get(collection);
      panelStates.get(tabState?.panels[tabState.activeIndex])?.refresh();
    }
    schedule();
  });
  const onVisibility = () => { frameTime = 0; if (!document.hidden) schedule(); };
  const onMotionPreference = () => { frameTime = 0; schedule(); };
  document.addEventListener("visibilitychange", onVisibility);
  motionPreference.addEventListener?.("change", onMotionPreference);

  setCollectionActive(activeCollection);

  return {
    setMotionPaused(value) {
      globalMotionPaused = value;
      frameTime = 0;
      schedule();
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observers.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionPreference.removeEventListener?.("change", onMotionPreference);
      for (const state of panelStates.values()) state.dispose();
    },
  };
}
