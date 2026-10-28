const stage = document.querySelector("[data-contact-stage]");
const canvas = document.querySelector("[data-contact-canvas]");
const motionToggle = document.querySelector("[data-contact-motion-toggle]");
const motionLabel = document.querySelector("[data-contact-motion-label]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (stage && canvas && motionToggle && motionLabel) {
  const context = canvas.getContext("2d", { alpha: true });

  if (context) {
    let points = [];
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
    let seed = 9173;
    let touchResetTimer = 0;

    function random() {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    }

    function buildPoints() {
      seed = 9173;
      const isNarrow = window.matchMedia("(max-width: 720px)").matches;
      const count = isNarrow ? 185 : 360;
      points = Array.from({ length: count }, () => ({
        x: random(),
        y: 0.06 + random() * 0.88,
        phase: random() * Math.PI * 2,
        size: 0.75 + random() * 1.35,
        cool: random() > 0.52,
      }));
    }

    function canAnimate() {
      return !reducedMotion.matches && !document.hidden && sceneVisible
        && (!paused || pointerStrength > 0.006 || pointerTargetStrength > 0.006);
    }

    function scheduleFrame() {
      if (!frameRequest && canAnimate()) frameRequest = requestAnimationFrame(draw);
    }

    function draw(timestamp = 0) {
      frameRequest = 0;
      if (reducedMotion.matches || document.hidden || !sceneVisible) return;
      if (lastDrawAt && timestamp - lastDrawAt < 1000 / 30) {
        scheduleFrame();
        return;
      }

      const elapsed = lastDrawAt ? Math.min(64, timestamp - lastDrawAt) : 16.7;
      lastDrawAt = timestamp;
      const easing = 1 - Math.exp(-elapsed * 0.009);
      pointerX += (pointerTargetX - pointerX) * easing;
      pointerY += (pointerTargetY - pointerY) * easing;
      pointerStrength += (pointerTargetStrength - pointerStrength) * easing;
      context.clearRect(0, 0, width, height);

      const seconds = timestamp * 0.001;
      const radius = Math.min(width, height) * 0.38;
      const blue = { r: 113, g: 201, b: 238 };
      const green = { r: 117, g: 226, b: 177 };

      if (pointerStrength > 0.01) {
        const ratio = Math.min(1, Math.max(0, pointerX / width));
        const red = Math.round(blue.r + (green.r - blue.r) * ratio);
        const greenChannel = Math.round(blue.g + (green.g - blue.g) * ratio);
        const blueChannel = Math.round(blue.b + (green.b - blue.b) * ratio);
        const glow = context.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, radius * 2.1);
        glow.addColorStop(0, `rgba(${red}, ${greenChannel}, ${blueChannel}, ${0.11 * pointerStrength})`);
        glow.addColorStop(1, `rgba(${red}, ${greenChannel}, ${blueChannel}, 0)`);
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }

      for (const point of points) {
        const baseX = point.x * width;
        const baseY = point.y * height;
        const driftX = paused ? 0 : Math.sin(seconds * 0.34 + point.phase) * 1.15;
        const driftY = paused ? 0 : Math.cos(seconds * 0.29 + point.phase) * 0.8;
        const deltaX = baseX - pointerX;
        const deltaY = baseY - pointerY;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        const influence = pointerStrength * Math.exp(-distanceSquared / (2 * radius * radius));
        const distance = Math.sqrt(distanceSquared) || 1;
        const displacement = influence * (14 + point.size * 3.5);
        const positionX = baseX + driftX + (deltaX / distance) * displacement;
        const positionY = baseY + driftY + (deltaY / distance) * displacement;
        const colorMix = point.x;
        const red = Math.round(blue.r + (green.r - blue.r) * colorMix);
        const greenChannel = Math.round(blue.g + (green.g - blue.g) * colorMix);
        const blueChannel = Math.round(blue.b + (green.b - blue.b) * colorMix);
        const alpha = 0.28 + (point.cool ? 0.12 : 0) + influence * 0.42;
        const size = point.size + influence * 0.45;

        context.fillStyle = `rgba(${red}, ${greenChannel}, ${blueChannel}, ${alpha})`;
        context.fillRect(positionX, positionY, size, size);
      }

      if (paused && pointerStrength < 0.006 && pointerTargetStrength < 0.006) {
        context.clearRect(0, 0, width, height);
        lastDrawAt = 0;
        return;
      }
      scheduleFrame();
    }

    function resizeCanvas() {
      const rect = stage.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = window.matchMedia("(max-width: 720px)").matches ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      buildPoints();
      stage.dataset.qualityTier = window.matchMedia("(max-width: 720px)").matches ? "medium" : "high";
      if (!reducedMotion.matches && !paused) scheduleFrame();
    }

    function setPointer(clientX, clientY, strength = 1) {
      const rect = stage.getBoundingClientRect();
      pointerTargetX = clientX - rect.left;
      pointerTargetY = clientY - rect.top;
      pointerTargetStrength = strength;
      stage.dataset.pointerActive = "true";
      scheduleFrame();
    }

    function onPointerMove(event) {
      if (reducedMotion.matches) return;
      if (event.pointerType === "touch") return;
      setPointer(event.clientX, event.clientY);
    }

    function onPointerDown(event) {
      if (reducedMotion.matches || event.pointerType !== "touch") return;
      setPointer(event.clientX, event.clientY, 0.8);
      window.clearTimeout(touchResetTimer);
      touchResetTimer = window.setTimeout(resetPointer, 650);
    }

    function resetPointer() {
      pointerTargetStrength = 0;
      stage.dataset.pointerActive = "false";
      scheduleFrame();
    }

    function focusNode(event) {
      if (reducedMotion.matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setPointer(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.7);
    }

    function updateMotionPreference() {
      if (reducedMotion.matches) {
        pointerTargetStrength = 0;
        pointerStrength = 0;
        context.clearRect(0, 0, width, height);
        if (frameRequest) cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        lastDrawAt = 0;
        stage.dataset.pointerActive = "false";
        motionToggle.hidden = true;
        stage.dataset.motionPaused = "true";
        return;
      }

      motionToggle.hidden = false;
      stage.dataset.motionPaused = String(paused);
      scheduleFrame();
    }

    function toggleMotion() {
      paused = !paused;
      motionLabel.textContent = paused ? motionToggle.dataset.resumeLabel : motionToggle.dataset.pauseLabel;
      motionToggle.setAttribute("aria-label", motionLabel.textContent);
      stage.dataset.motionPaused = String(paused);
      if (paused && pointerTargetStrength < 0.006) {
        pointerStrength = 0;
        context.clearRect(0, 0, width, height);
        if (frameRequest) cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        lastDrawAt = 0;
      } else scheduleFrame();
    }

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(stage);
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
      visibilityObserver.observe(stage);
    }

    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerleave", resetPointer, { passive: true });
    stage.addEventListener("pointerdown", onPointerDown, { passive: true });
    stage.querySelectorAll("[data-contact-node]").forEach((node) => {
      node.addEventListener("focus", focusNode);
      node.addEventListener("blur", resetPointer);
    });
    window.addEventListener("resize", resizeCanvas, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frameRequest) {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      } else scheduleFrame();
    });
    reducedMotion.addEventListener("change", updateMotionPreference);
    motionToggle.addEventListener("click", toggleMotion);

    motionToggle.dataset.pauseLabel = motionLabel.textContent;
    motionToggle.dataset.resumeLabel = document.documentElement.lang === "en" ? "Resume motion" : "Retomar movimento";
    resizeCanvas();
    updateMotionPreference();
    stage.dataset.canvasReady = "true";
  } else {
    stage.dataset.canvasReady = "false";
  }
}
