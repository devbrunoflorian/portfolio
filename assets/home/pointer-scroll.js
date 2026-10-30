import {
  FRONTAL_MODEL_YAW,
  LOOK_DOWN_LIMIT,
  LOOK_UP_LIMIT,
  MAX_YAW,
  MOBILE_RESTING_YAW,
  RESTING_LEFT_YAW,
  RESTING_PITCH,
  TRACKING_FULL_TILT_AT,
  clamp,
} from "./context.js";

export function createPointerScroll(ctx) {
  function updateSceneProgress() {
    if (ctx.debugMode || ctx.reducedMotion.matches) return;
    if (ctx.mobileViewport.matches) {
      ctx.updateMobileProgress();
      ctx.queueFrame();
      return;
    }
    const extent = Math.max(1, ctx.track.offsetHeight - innerHeight);
    ctx.progress = clamp(-ctx.track.getBoundingClientRect().top / extent);
    const stage = Math.min(ctx.stageNames.length - 1, Math.floor(ctx.progress * ctx.stageNames.length));
    ctx.track.dataset.stage = String(stage);
    ctx.frame.dataset.progress = ctx.progress.toFixed(3);
    ctx.stageLabel.textContent = `${String(stage + 1).padStart(2, "0")} / ${ctx.stageNames[stage]}`;
    const stagePhases = ["idea", "structure", "form"];
    ctx.homeEnvironment?.setPhase?.(stagePhases[stage] || "structure");
    ctx.queueFrame();
  }

  function projectTrackingCenter() {
    const bounds = ctx.frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !ctx.knight) return null;
    ctx.camera.updateMatrixWorld(true);
    ctx.trackingRestQuaternion.setFromAxisAngle(ctx.verticalAxis, FRONTAL_MODEL_YAW);
    ctx.trackingRestMatrix.compose(ctx.modelPivot.position, ctx.trackingRestQuaternion, ctx.modelPivot.scale);
    ctx.trackingCenterWorld.copy(ctx.trackingCenterLocal).applyMatrix4(ctx.trackingRestMatrix).project(ctx.camera);
    return {
      x: bounds.left + ((ctx.trackingCenterWorld.x + 1) / 2) * bounds.width,
      y: bounds.top + ((1 - ctx.trackingCenterWorld.y) / 2) * bounds.height,
    };
  }

  function pointerMove(event) {
    if (!ctx.renderer || (ctx.reducedMotion.matches && !ctx.debugMode) || (!ctx.debugMode && (ctx.mobileViewport.matches || !ctx.pointerQuery.matches)) || event.pointerType !== "mouse") return;
    const bounds = ctx.frame.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      pointerLeave();
      return;
    }
    const center = projectTrackingCenter();
    if (!bounds.width || !bounds.height || !center) return;

    const dx = event.clientX - center.x;
    const horizontalSideDistance = dx < 0 ? center.x - bounds.left : bounds.right - center.x;
    const normalizedX = clamp(dx / Math.max(1, horizontalSideDistance), -1, 1);
    const trackingX = clamp(normalizedX / TRACKING_FULL_TILT_AT, -1, 1);
    const dy = event.clientY - center.y;
    const verticalSideDistance = dy < 0 ? center.y - bounds.top : bounds.bottom - center.y;
    const normalizedY = clamp(dy / Math.max(1, verticalSideDistance), -1, 1);
    const trackingY = clamp(normalizedY / TRACKING_FULL_TILT_AT, -1, 1);
    ctx.targetYaw = trackingX * MAX_YAW;
    ctx.targetPitch = trackingY < 0
      ? trackingY * LOOK_UP_LIMIT
      : trackingY * LOOK_DOWN_LIMIT;
    ctx.frame.dataset.pointerCenterX = center.x.toFixed(1);
    ctx.frame.dataset.pointerCenterY = center.y.toFixed(1);
    ctx.frame.dataset.pointerNormalizedX = normalizedX.toFixed(3);
    ctx.frame.dataset.pointerNormalizedY = normalizedY.toFixed(3);
    ctx.frame.dataset.pointerTracking = trackingX.toFixed(3);
    ctx.frame.dataset.pointerTargetYaw = ctx.targetYaw.toFixed(4);
    ctx.frame.dataset.pointerTargetPitch = ctx.targetPitch.toFixed(4);

    if (!ctx.debugMode) {
      const canvasBounds = ctx.canvas.getBoundingClientRect();
      const insideCanvas = event.clientX >= canvasBounds.left
        && event.clientX <= canvasBounds.right
        && event.clientY >= canvasBounds.top
        && event.clientY <= canvasBounds.bottom;
      let hit;
      if (insideCanvas) {
        ctx.pointerNdc.set(((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1, 1 - ((event.clientY - canvasBounds.top) / canvasBounds.height) * 2);
        ctx.raycaster.setFromCamera(ctx.pointerNdc, ctx.camera);
        hit = ctx.raycaster.intersectObject(ctx.knight, true)[0];
      }
      if (hit) {
        ctx.pointerTarget.copy(hit.point);
        ctx.targetReveal = 0.9;
      } else {
        ctx.pointerTarget.set(0, 0, 0);
        ctx.targetReveal = 0;
      }
      ctx.frame.dataset.pointerHit = String(Boolean(hit));
    }
    ctx.queueFrame();
  }

  function pointerLeave() {
    ctx.targetYaw = ctx.mobileViewport.matches && !ctx.debugMode ? MOBILE_RESTING_YAW : RESTING_LEFT_YAW;
    ctx.targetPitch = RESTING_PITCH;
    ctx.targetReveal = 0;
    ctx.pointerTarget.set(0, 0, 0);
    ctx.frame.dataset.pointerHit = "false";
    ctx.frame.dataset.pointerTracking = "0.000";
    ctx.frame.dataset.pointerTargetYaw = ctx.targetYaw.toFixed(4);
    ctx.frame.dataset.pointerTargetPitch = ctx.targetPitch.toFixed(4);
    ctx.frame.dataset.pointerNormalizedX = "0.000";
    ctx.frame.dataset.pointerNormalizedY = "0.000";
    ctx.queueFrame();
  }

  return { updateSceneProgress, pointerMove, pointerLeave, projectTrackingCenter };
}
