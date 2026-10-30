import { initializeMobileHome, revealMobileCopy } from "../home-mobile.js?v=pbr-tight-1";
import { homeCapture } from "../home-capture.js";

const frame = document.querySelector("#scene-frame");
const status = document.querySelector("#scene-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const isPortuguese = document.documentElement.lang.toLowerCase().startsWith("pt");
const debugMode = new URLSearchParams(location.search).has("knight-debug");
let sceneModulePromise;
let sceneHandle;
let disposed = false;
const mobileHome = initializeMobileHome();

document.body.classList.toggle("knight-debug", debugMode);
frame.dataset.debugMode = String(debugMode);

function showStaticScene() {
  if (disposed) return;
  homeCapture?.fallback();
  revealMobileCopy();
  frame.dataset.sceneState = "poster";
  frame.dataset.modelReady = "false";
  status.textContent = reducedMotion.matches
    ? isPortuguese
      ? "Cena 3D pausada pela preferência de movimento reduzido. A cena estática e a navegação continuam disponíveis."
      : "3D scene paused by reduced-motion preference. The static scene and navigation remain available."
    : isPortuguese
      ? "Cena estática neste tamanho de tela. A navegação e o conteúdo continuam disponíveis."
      : "Static scene at this screen size. Content and navigation remain available.";
}

function loadSceneWhenAppropriate() {
  if (disposed) return;
  if (reducedMotion.matches && !debugMode) {
    if (!sceneModulePromise) showStaticScene();
    return;
  }

  if (sceneModulePromise) return;
  frame.dataset.sceneState = "loading";
  sceneModulePromise = import("../home-hero-scene.js?v=pbr-tight-1").then((module) => {
    sceneHandle = module.homeScene;
    if (disposed) sceneHandle?.dispose();
  }).catch((error) => {
    if (disposed) return;
    homeCapture?.fallback();
    revealMobileCopy();
    sceneModulePromise = null;
    frame.dataset.sceneState = "poster";
    status.textContent = isPortuguese
      ? "Cena 3D indisponível. A cena estática e a navegação continuam disponíveis."
      : "3D scene unavailable. The static scene and navigation remain available.";
    console.error("Portfolio hero scene unavailable; keeping the static poster.", error);
  });
}

function dispose() {
  if (disposed) return;
  disposed = true;
  reducedMotion.removeEventListener("change", loadSceneWhenAppropriate);
  mobileHome.dispose();
  sceneHandle?.dispose();
}

reducedMotion.addEventListener("change", loadSceneWhenAppropriate);
loadSceneWhenAppropriate();
homeCapture?.bindBootstrap({ dispose });
