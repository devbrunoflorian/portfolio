import test from "node:test";
import assert from "node:assert/strict";
import { scoreGridRowLayout } from "../assets/about-legacy/score-grid-study-layout.js";

const system = { headerWidth: 150, barsPerSystem: 3, barWidth: 320 };

test("full score rows keep all bar starts under the same header offset", () => {
  const first = scoreGridRowLayout({ firstBar: 1, sheetHasHeader: true, ...system });
  const next = scoreGridRowLayout({ firstBar: 4, sheetHasHeader: true, ...system });

  assert.deepEqual(first, { barOffsetX: 150, leadingSpacerWidth: 0, showsHeader: true, width: 1110 });
  assert.deepEqual(next, { barOffsetX: 150, leadingSpacerWidth: 150, showsHeader: false, width: 1110 });
  assert.equal(first.barOffsetX, next.barOffsetX);
});

test("an excerpt that begins after bar one does not reserve a missing header", () => {
  const excerpt = scoreGridRowLayout({ firstBar: 34, sheetHasHeader: false, ...system });

  assert.deepEqual(excerpt, { barOffsetX: 0, leadingSpacerWidth: 0, showsHeader: false, width: 960 });
});
