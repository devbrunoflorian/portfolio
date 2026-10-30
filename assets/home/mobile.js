export function createMobileAdapter({ homeEnvironment, mobileViewport }) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const hero = document.querySelector(".hero-screen");
  const track = document.querySelector("#hero-track");
  const frame = document.querySelector("#scene-frame");
  const stageNote = document.querySelector(".hero-side-note");
  const menu = document.querySelector(".mobile-menu");
  const stageNames = document.documentElement.lang.startsWith("pt")
    ? ["IDEIA", "ESTRUTURA", "FORMA"] : ["IDEA", "STRUCTURE", "FORM"];
  let scrollFrame = 0;
  let mobileController = null;

  function revealMobileCopy() {
    hero.classList.add("mobile-intro-ready");
  }

  function updateMobileProgress() {
    if (!mobileViewport.matches) return;
    const bounds = track.getBoundingClientRect();
    const extent = Math.max(160, Math.min(frame.clientHeight * 0.85, track.offsetHeight - innerHeight * 0.55));
    const progress = Math.min(1, Math.max(0, -bounds.top / extent));
    const stage = Math.min(2, Math.floor(progress * 3));
    track.dataset.stage = String(stage);
    frame.dataset.progress = progress.toFixed(3);
    document.querySelector("#scene-stage").textContent = `${String(stage + 1).padStart(2, "0")} / ${stageNames[stage]}`;
    document.querySelector(".mobile-stage-progress").textContent = `${String(stage + 1).padStart(2, "0")} / 03`;
    for (const label of stageNote.querySelectorAll("[data-scene-state]")) {
      label.classList.toggle("is-complete", Number(label.dataset.sceneState) < stage);
    }
    homeEnvironment?.setPhase(["idea", "structure", "form"][stage]);
    homeEnvironment?.setProgress(progress);
  }

  function positionMobileLayers() {
    if (document.body.classList.contains("knight-debug")) return;
    if (mobileViewport.matches) {
      if (homeEnvironment?.element.parentElement !== frame) frame.append(homeEnvironment.element);
      if (stageNote.parentElement !== frame) frame.append(stageNote);
      updateMobileProgress();
    } else {
      if (homeEnvironment?.element.parentElement !== hero) hero.prepend(homeEnvironment.element);
      if (stageNote.parentElement !== hero) hero.append(stageNote);
      stageNote.querySelectorAll(".is-complete").forEach((label) => label.classList.remove("is-complete"));
    }
  }

  function initializeMobileHome() {
    if (mobileController) return mobileController;

    document.body.classList.add("home-enhanced");
    positionMobileLayers();
    const listeners = [];
    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }
    const onResize = () => {
      if (mobileViewport.matches) updateMobileProgress();
    };
    const onScroll = () => {
      if (!mobileViewport.matches || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateMobileProgress();
      });
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || !menu.open || !mobileViewport.matches) return;
      menu.open = false;
      menu.querySelector("summary").focus();
    };
    const onClick = (event) => {
      if (!menu.open || !mobileViewport.matches) return;
      if (!menu.contains(event.target) || event.target.closest("a")) menu.open = false;
    };

    listen(mobileViewport, "change", positionMobileLayers);
    listen(window, "resize", onResize, { passive: true });
    listen(window, "scroll", onScroll, { passive: true });
    listen(document, "keydown", onKeyDown);
    listen(document, "click", onClick);
    if (reducedMotion.matches) revealMobileCopy();

    mobileController = {
      dispose() {
        if (!mobileController) return;
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        scrollFrame = 0;
        for (const remove of listeners.splice(0)) remove();
        mobileController = null;
      },
    };
    return mobileController;
  }

  return { initializeMobileHome, revealMobileCopy, updateMobileProgress };
}
