export function createOpeningController({ frame, heroScreen, revealCopy }) {
  let disposed = false;

  return {
    presentFirstInteractiveFrame() {
      if (disposed || frame.dataset.sceneState !== "loading") return;
      frame.dataset.sceneState = "live";
      heroScreen.classList.add("scene-live");
      revealCopy();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
    },
  };
}
