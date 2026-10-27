const story = document.querySelector("[data-lab-story]");
const storyPin = document.querySelector("[data-story-pin]");
const storyTrack = document.querySelector("[data-story-track]");
const storyPanels = [...document.querySelectorAll("[data-story-panel]")];
const storyControls = document.querySelector("[data-story-controls]");
const storyButtons = [...document.querySelectorAll("[data-story-step]")];
const scrollCue = document.querySelector("[data-scroll-cue]");
const visual = document.querySelector("[data-lab-visual]");
const scene = document.querySelector("[data-lab-scene]");
const folder = document.querySelector(".lab-folder");
const canvas = document.querySelector("[data-lab-canvas]");
const motionToggle = document.querySelector("[data-motion-toggle]");
const motionLabel = document.querySelector("[data-motion-label]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const touchLayout = window.matchMedia("(max-width: 840px)");
const shortViewport = window.matchMedia("(max-height: 740px)");
const isEnglish = document.documentElement.lang === "en";

if (story && storyPin && storyTrack && storyPanels.length) {
  let storyFrame = 0;
  let storyReady = false;

  function storyProgress() {
    if (touchLayout.matches) {
      const range = Math.max(1, storyTrack.scrollWidth - storyTrack.clientWidth);
      return Math.min(1, Math.max(0, storyTrack.scrollLeft / range));
    }

    const range = Math.max(1, story.offsetHeight - window.innerHeight);
    return Math.min(1, Math.max(0, -story.getBoundingClientRect().top / range));
  }

  function updateStory() {
    storyFrame = 0;
    if (!storyReady) return;

    const progress = storyProgress();
    if (!touchLayout.matches) {
      const maxShift = Math.max(0, storyTrack.scrollWidth - storyPin.clientWidth);
      storyTrack.style.transform = `translate3d(${-progress * maxShift}px, 0, 0)`;
    }

    const activeIndex = Math.min(storyPanels.length - 1, Math.round(progress * (storyPanels.length - 1)));
    storyPanels.forEach((panel, index) => {
      panel.dataset.active = String(index === activeIndex);
    });
    storyButtons.forEach((button, index) => {
      if (index === activeIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function queueStoryUpdate() {
    if (!storyFrame) storyFrame = requestAnimationFrame(updateStory);
  }

  function updateStoryLayout() {
    const enabled = !reducedMotion.matches && !shortViewport.matches;
    document.body.classList.toggle("labs-story-horizontal", enabled);
    storyReady = enabled;
    storyTrack.style.transform = "";
    storyTrack.scrollLeft = 0;
    storyButtons.forEach((button) => button.removeAttribute("aria-current"));

    if (enabled) {
      storyControls.hidden = false;
      storyPanels[0].dataset.active = "true";
      storyButtons[0]?.setAttribute("aria-current", "step");
      if (scrollCue) {
        scrollCue.textContent = touchLayout.matches
          ? (isEnglish ? "Swipe to the side to explore the chapters →" : "Deslize para o lado para explorar os capítulos →")
          : (isEnglish ? "Scroll down to move through the chapters →" : "Role para avançar pelos capítulos →");
      }
    } else {
      storyControls.hidden = true;
      storyPanels.forEach((panel) => delete panel.dataset.active);
    }

    queueStoryUpdate();
  }

  function goToPanel(index) {
    if (!storyReady) return;
    const panelIndex = Math.min(storyPanels.length - 1, Math.max(0, index));

    if (touchLayout.matches) {
      storyTrack.scrollTo({ left: storyPanels[panelIndex].offsetLeft, behavior: "smooth" });
      return;
    }

    const range = Math.max(1, story.offsetHeight - window.innerHeight);
    const top = story.getBoundingClientRect().top + window.scrollY + range * panelIndex / (storyPanels.length - 1);
    window.scrollTo({ top, behavior: "smooth" });
  }

  storyButtons.forEach((button) => {
    button.addEventListener("click", () => goToPanel(Number(button.dataset.storyStep)));
  });

  storyTrack.addEventListener("scroll", queueStoryUpdate, { passive: true });
  window.addEventListener("scroll", queueStoryUpdate, { passive: true });
  window.addEventListener("resize", queueStoryUpdate, { passive: true });
  touchLayout.addEventListener("change", updateStoryLayout);
  reducedMotion.addEventListener("change", updateStoryLayout);
  shortViewport.addEventListener("change", updateStoryLayout);

  story.addEventListener("focusin", (event) => {
    if (!storyReady) return;
    const panelIndex = storyPanels.indexOf(event.target.closest("[data-story-panel]"));
    if (panelIndex < 0) return;

    if (touchLayout.matches) {
      storyTrack.scrollLeft = storyPanels[panelIndex].offsetLeft;
    } else {
      goToPanel(panelIndex);
    }
  });

  let drag = null;
  storyPin.addEventListener("pointerdown", (event) => {
    if (!storyReady || touchLayout.matches || event.pointerType !== "mouse" || event.button !== 0) return;
    const dragRegion = event.target.closest("[data-story-drag]");
    if (!dragRegion) return;

    drag = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false };
    dragRegion.setPointerCapture(event.pointerId);
  });

  storyPin.addEventListener("pointermove", (event) => {
    if (!storyReady || !drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    if (Math.abs(event.clientX - drag.startX) > 4) drag.moved = true;
    if (drag.moved) window.scrollBy(0, -deltaX);
  });

  function finishDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const shouldSnap = drag.moved;
    drag = null;
    if (!storyReady || !shouldSnap) return;
    const activeIndex = Math.round(storyProgress() * (storyPanels.length - 1));
    goToPanel(activeIndex);
  }

  storyPin.addEventListener("pointerup", finishDrag);
  storyPin.addEventListener("pointercancel", finishDrag);
  storyPin.addEventListener("lostpointercapture", finishDrag);

  updateStoryLayout();
}

if (visual && scene && folder && canvas && motionToggle && motionLabel) {
  const context = canvas.getContext("2d", { alpha: true });

  if (context) {
    const points = [];
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frameRequest = 0;
    let lastDrawAt = 0;
    let sceneVisible = true;
    let paused = false;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetStrength = 0;
    let pointerStrength = 0;
    let seed = 4217;

    function random() {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    }

    function insideFolder(x, y) {
      if (y < 0.16 || y > 0.96 || x < 0.02 || x > 0.98) return false;
      const tabEdge = y < 0.28 ? 0.35 + ((y - 0.16) * 1) : 0.98;
      return x < tabEdge;
    }

    const compactGlyphs = window.matchMedia("(max-width: 840px)").matches;
    const rowStep = compactGlyphs ? 0.105 : 0.075;
    const columnStep = compactGlyphs ? 0.055 : 0.038;

    for (let y = 0.14; y < 0.96; y += rowStep) {
      for (let x = 0.025; x < 0.98; x += columnStep) {
        if (!insideFolder(x, y) || random() < 0.12) continue;
        points.push({
          x,
          y,
          bit: random() > 0.5 ? "1" : "0",
          phase: random() * Math.PI * 2,
          cool: random() > 0.76,
        });
      }
    }

    function draw(timestamp = 0) {
      context.clearRect(0, 0, width, height);
      const seconds = timestamp * 0.001;
      const radius = Math.min(width, height) * 0.28;

      for (const point of points) {
        const baseX = point.x * width;
        const baseY = point.y * height;
        const timeX = reducedMotion.matches || paused ? 0 : Math.sin(seconds * 0.62 + point.phase) * 0.45;
        const timeY = reducedMotion.matches || paused ? 0 : Math.cos(seconds * 0.51 + point.phase) * 0.34;
        const deltaX = baseX - pointerX;
        const deltaY = baseY - pointerY;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        const influence = reducedMotion.matches ? 0 : pointerStrength * Math.exp(-distanceSquared / (2 * radius * radius));
        const distance = Math.sqrt(distanceSquared) || 1;
        const offsetX = (deltaX / distance) * influence * 13;
        const offsetY = (deltaY / distance) * influence * 13;

        context.globalAlpha = 0.66 + (point.cool ? 0.14 : 0) + influence * 0.14;
        context.fillStyle = point.cool ? "#83dff2" : "#e4f4fc";
        context.fillText(point.bit, baseX + timeX + offsetX, baseY + timeY + offsetY);
      }

      context.globalAlpha = 1;
    }

    function scheduleFrame() {
      if (frameRequest || !sceneVisible || document.hidden || reducedMotion.matches) return;
      if (paused && pointerTargetStrength === 0 && pointerStrength < 0.005) return;
      frameRequest = requestAnimationFrame(renderFrame);
    }

    function renderFrame(timestamp) {
      frameRequest = 0;
      if (timestamp - lastDrawAt < 1000 / 30) {
        scheduleFrame();
        return;
      }

      const elapsed = lastDrawAt ? Math.min(100, timestamp - lastDrawAt) : 34;
      lastDrawAt = timestamp;
      const damping = 1 - Math.exp(-elapsed / 105);
      pointerX += (pointerTargetX - pointerX) * damping;
      pointerY += (pointerTargetY - pointerY) * damping;
      pointerStrength += (pointerTargetStrength - pointerStrength) * damping;
      draw(paused ? 0 : timestamp);

      if (paused && pointerTargetStrength === 0 && pointerStrength < 0.005) {
        pointerStrength = 0;
        draw(0);
        return;
      }
      scheduleFrame();
    }

    function resizeCanvas() {
      const bounds = folder.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1_200_000 / (width * height)));
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.font = width < 440 ? "8px ui-monospace, SFMono-Regular, Consolas, monospace" : "11px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      draw(0);
      scheduleFrame();
    }

    function onPointerMove(event) {
      if (event.pointerType !== "mouse" || reducedMotion.matches) return;
      const bounds = folder.getBoundingClientRect();
      pointerTargetX = event.clientX - bounds.left;
      pointerTargetY = event.clientY - bounds.top;
      pointerTargetStrength = 1;
      scene.dataset.pointerActive = "true";
      scheduleFrame();
    }

    function onPointerLeave() {
      pointerTargetStrength = 0;
      scene.dataset.pointerActive = "false";
      scheduleFrame();
    }

    function updateMotionPreference() {
      if (reducedMotion.matches) {
        pointerTargetStrength = 0;
        pointerStrength = 0;
        scene.dataset.pointerActive = "false";
        if (frameRequest) cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        lastDrawAt = 0;
        draw(0);
        motionToggle.hidden = true;
        return;
      }

      motionToggle.hidden = false;
      draw(0);
      scheduleFrame();
    }

    function toggleMotion() {
      paused = !paused;
      motionLabel.textContent = paused ? (isEnglish ? "Resume motion" : "Retomar movimento") : (isEnglish ? "Pause motion" : "Pausar movimento");
      motionToggle.setAttribute("aria-label", motionLabel.textContent);
      motionToggle.setAttribute("aria-pressed", String(paused));
      lastDrawAt = 0;
      if (paused) draw(0);
      else scheduleFrame();
    }

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(folder);
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    if ("IntersectionObserver" in window) {
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        sceneVisible = entry.isIntersecting;
        if (sceneVisible) scheduleFrame();
        else if (frameRequest) {
          cancelAnimationFrame(frameRequest);
          frameRequest = 0;
        }
      }, { threshold: 0.05 });
      visibilityObserver.observe(visual);
    }

    folder.addEventListener("pointermove", onPointerMove, { passive: true });
    folder.addEventListener("pointerleave", onPointerLeave, { passive: true });
    folder.addEventListener("pointercancel", onPointerLeave, { passive: true });
    reducedMotion.addEventListener("change", updateMotionPreference);
    motionToggle.addEventListener("click", toggleMotion);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frameRequest) {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      } else scheduleFrame();
    });

    scene.dataset.motionPaused = "false";
    resizeCanvas();
    updateMotionPreference();
    scene.dataset.canvasReady = "true";
  }
}
