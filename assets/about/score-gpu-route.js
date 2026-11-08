export function shouldUseGpuScoreScroll(searchParams) {
  const mode = searchParams.get("score-gpu");
  const studyRoute = searchParams.has("score-gate")
    || searchParams.has("score-grid")
    || searchParams.has("score-ribbon");

  return mode === "scroll" || (mode !== "off" && !studyRoute);
}

export function shouldEnableScoreLight(searchParams) {
  return searchParams.get("score-light") !== "off";
}
