const hosts = [...document.querySelectorAll("[data-media-skeleton]")];
const states = new WeakMap();
const LOAD_DELAY = 320;

function hasSource(image) {
  if (image.getAttribute("src")?.trim() || image.getAttribute("srcset")?.trim()) return true;
  return Boolean(image.closest("picture")?.querySelector("source[srcset]")?.getAttribute("srcset"));
}

function getImages(host) {
  return [...host.querySelectorAll("img")].filter(hasSource);
}

function getSourceKey(image) {
  const pictureSources = [...(image.closest("picture")?.querySelectorAll("source") ?? [])]
    .map(source => `${source.media}|${source.getAttribute("srcset") ?? ""}`)
    .join(";");
  return `${image.currentSrc}|${image.getAttribute("src") ?? ""}|${image.getAttribute("srcset") ?? ""}|${pictureSources}`;
}

function ensureLayer(host, state) {
  if (state.layer?.isConnected) return state.layer;
  const layer = document.createElement("span");
  layer.className = "media-skeleton-layer";
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  state.layer = layer;
  return layer;
}

function clearPending(host, state) {
  window.clearTimeout(state.timer);
  state.timer = 0;
  host.removeAttribute("data-media-loading");
}

function inspect(host, state) {
  state.observerFrame = 0;
  if (!state.armed) return;
  const images = getImages(host);
  if (!images.length) {
    clearPending(host, state);
    return;
  }

  for (const image of images) {
    const sourceKey = getSourceKey(image);
    if (state.boundImages.get(image) === sourceKey) continue;
    state.boundImages.set(image, sourceKey);
    image.addEventListener("load", () => queueInspect(host, state), { once: true });
    image.addEventListener("error", () => queueInspect(host, state), { once: true });
  }

  const hasReadyImage = images.some(image => image.complete && image.naturalWidth > 0);
  if (hasReadyImage) {
    clearPending(host, state);
    return;
  }

  const pending = images.some(image => !image.complete);
  if (!pending) {
    clearPending(host, state);
    return;
  }

  if (state.timer) return;
  state.timer = window.setTimeout(() => {
    state.timer = 0;
    if (!host.isConnected) return;
    const currentImages = getImages(host);
    if (currentImages.some(image => image.complete && image.naturalWidth > 0) || currentImages.every(image => image.complete)) return;
    ensureLayer(host, state);
    host.dataset.mediaLoading = "true";
  }, LOAD_DELAY);
}

function queueInspect(host, state) {
  if (state.observerFrame) return;
  state.observerFrame = window.requestAnimationFrame(() => inspect(host, state));
}

for (const host of hosts) {
  const state = { boundImages: new WeakMap(), timer: 0, observerFrame: 0, layer: null, armed: false, mutationObserver: null, intersectionObserver: null };
  states.set(host, state);

  state.mutationObserver = new MutationObserver(() => queueInspect(host, state));
  state.mutationObserver.observe(host, { subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });

  const lazyImages = [...host.querySelectorAll('img[loading="lazy"]')];
  if (lazyImages.length && "IntersectionObserver" in window) {
    state.intersectionObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      state.armed = true;
      state.intersectionObserver.disconnect();
      queueInspect(host, state);
    }, { rootMargin: "240px 0px" });
    state.intersectionObserver.observe(host);
  } else {
    state.armed = true;
  }

  if (state.armed) queueInspect(host, state);
}

window.addEventListener("resize", () => {
  for (const host of hosts) queueInspect(host, states.get(host));
}, { passive: true });

window.addEventListener("pagehide", event => {
  if (event.persisted) return;
  for (const host of hosts) {
    const state = states.get(host);
    if (!state) continue;
    window.clearTimeout(state.timer);
    if (state.observerFrame) window.cancelAnimationFrame(state.observerFrame);
    state.intersectionObserver?.disconnect();
    state.mutationObserver?.disconnect();
  }
});
