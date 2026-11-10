import { createAboutCamera } from "./camera.js?v=passage-framing-1";

export async function mountAboutScene(root) {
  const host = root.querySelector("[data-score-thread]");
  if (!host) throw new Error("The About score scene needs its canvas host.");

  const camera = createAboutCamera(root);
  const { mountAboutGpuScroll } = await import("../../about-legacy/score-gpu-scroll.js?v=about-scene-1");
  const renderer = await mountAboutGpuScroll(root, host);
  let disposed = false;

  return {
    update({ chapter, motionEnabled, reducedMotion, playbackSnapshot, timestamp }) {
      if (disposed) return null;
      const framing = camera.sample(chapter);
      const settled = reducedMotion ? {
        journey: Math.max(0, [...root.querySelectorAll("[data-chapter]")].findIndex(item => item.dataset.chapter === chapter)),
        pose: framing.settledPose,
        zoom: framing.settledZoom,
        frameOffset: framing.settledFrameOffset,
      } : framing;
      return renderer.update({
        ...settled,
        chapter,
        motionEnabled,
        reducedMotion,
        playbackSnapshot,
        timestamp,
      });
    },
    invalidate() { camera.invalidate(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
    },
  };
}
