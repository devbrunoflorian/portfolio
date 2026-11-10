export function scoreGridRowLayout({ firstBar, sheetHasHeader, headerWidth, barsPerSystem, barWidth }) {
  const barOffsetX = sheetHasHeader ? headerWidth : 0;
  const showsHeader = sheetHasHeader && firstBar === 1;

  return {
    barOffsetX,
    leadingSpacerWidth: showsHeader ? 0 : barOffsetX,
    showsHeader,
    width: barOffsetX + barsPerSystem * barWidth,
  };
}
