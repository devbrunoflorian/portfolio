import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scoreGridStudy } from "../assets/about/score-grid-study-data.js";

const scoreDirectory = fileURLToPath(new URL("../assets/about/guitar-score/", import.meta.url));
const systemStarts = Array.from({ length: 36 }, (_, index) => index * 3 + 1);

test("the 36 generated systems match the current source and cover all 106 bars", () => {
  const systemFiles = readdirSync(scoreDirectory).filter(name => /^system-\d{3}\.svg$/.test(name));
  assert.equal(systemFiles.length, systemStarts.length);

  for (const firstBar of systemStarts) {
    const fileName = `system-${String(firstBar).padStart(3, "0")}.svg`;
    const svg = readFileSync(new URL(`../assets/about/guitar-score/${fileName}`, import.meta.url), "utf8");
    const metadata = svg.match(/<metadata>(.*?)<\/metadata>/)?.[1];
    assert.ok(metadata, `${fileName} has source metadata`);
    const details = JSON.parse(metadata);
    const lastBar = Math.min(firstBar + 2, scoreGridStudy.bars.length);

    assert.equal(details.sourceSha256, scoreGridStudy.sourceSha256, fileName);
    assert.equal(details.firstBar, firstBar, fileName);
    assert.equal(details.lastBar, lastBar, fileName);
    for (let bar = firstBar; bar <= lastBar; bar += 1) {
      assert.ok(svg.includes(`id="bar-${String(bar).padStart(3, "0")}"`), `${fileName} contains bar ${bar}`);
    }
  }
});
