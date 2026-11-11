import test from 'node:test';
import assert from 'node:assert/strict';
import {readingChapterIndex, visibleReadingRegions} from '../assets/about/scene/reading.js';
const bounds=[{top:0,bottom:700},{top:700,bottom:2100},{top:2400,bottom:3200},{top:3200,bottom:4000},{top:4000,bottom:4700},{top:4700,bottom:5300}];
test('a tall stack stays active throughout its reading area',()=>{
  for(const line of [701,1000,1600,2099])assert.equal(readingChapterIndex(bounds,line),1);
  const expanded=bounds.map(x=>({...x}));expanded[1].bottom=3700;expanded[2]={top:4000,bottom:4700};
  assert.equal(readingChapterIndex(expanded,3500),1);
});
test('large forward and reverse jumps select directly from geometry',()=>{
  const points=[0,850,2600,3500,4400,5100];
  const down=points.map(x=>readingChapterIndex(bounds,x));
  assert.deepEqual(down,[0,1,2,3,4,5]);
  assert.deepEqual(points.toReversed().map(x=>readingChapterIndex(bounds,x)).reverse(),down);
});
test('gaps choose the nearest reading section without prior state',()=>{
  assert.equal(readingChapterIndex(bounds,2200),1);
  assert.equal(readingChapterIndex(bounds,2300),2);
  assert.equal(readingChapterIndex([],500),-1);
});

test('reading protection follows visible copy bounds and excludes offscreen text', () => {
  const rects = [
    {left: 22, top: 120, right: 368, bottom: 320, width: 346, height: 200},
    {left: 22, top: 900, right: 368, bottom: 950, width: 346, height: 50},
    {left: 22, top: -200, right: 368, bottom: -20, width: 346, height: 180},
    {left: 22, top: 50, right: 22, bottom: 50, width: 0, height: 0},
  ];
  const root = {querySelectorAll: () => rects.map(rect => ({getBoundingClientRect: () => rect}))};
  assert.deepEqual(visibleReadingRegions(root, 390, 844), [[12, 110, 378, 330]]);
});
