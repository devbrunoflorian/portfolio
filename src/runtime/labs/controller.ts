export interface LabsState { index: number; motionPaused: boolean; webgl: boolean }
export interface LabsController {
  ready: Promise<void>;
  scrollToIndex(index: number): void;
  setMotionPaused(paused: boolean): void;
  dispose(): void;
}
interface LabsModule {
  mountLabsController(root: HTMLElement, options: { onState(state: LabsState): void }): LabsController;
}

export async function loadLabsController(): Promise<LabsModule> {
  // Keep the existing Three vendor and its import map outside Vite's dependency resolution.
  const url = '/assets/labs/controller.js';
  return import(/* @vite-ignore */ url);
}
