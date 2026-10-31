import { homeEnvironment, mobileViewport } from "./home-environment.js?v=pbr-tight-1";
import { createMobileAdapter } from "./home/mobile.js?v=pbr-tight-1";

const mobileHome = createMobileAdapter({ homeEnvironment, mobileViewport });

export { mobileViewport };
export const initializeMobileHome = mobileHome.initializeMobileHome;
export const revealMobileCopy = mobileHome.revealMobileCopy;
export const updateMobileProgress = mobileHome.updateMobileProgress;
