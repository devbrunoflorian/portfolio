import test from 'node:test';
import assert from 'node:assert/strict';
import {fitCloseZoom,projectedHeadWidth,limitCloseZoom,maximumProjectedHeadWidth} from '../assets/about-legacy/score-close-framing.js';
import {selectedNotation} from '../assets/about-legacy/score-gpu-scroll.js';
import {scoreRibbonTimeline as score} from '../assets/about-legacy/score-ribbon-timeline.js';
const notation=selectedNotation();
const head=notation.groups.flatMap(g=>g.heads).find(h=>h.noteId==='guitar-33-3-1');
const contour=head.contours.flat();
const headWidth=Math.max(...contour.map(p=>p.u))-Math.min(...contour.map(p=>p.u));

test('the real engraved head fits the reading size of each phone across poses',()=>{
  for(const [width,height] of [[320,720],[390,844]]) for(const pose of [.55,.65,.72,.8,.9]) {
    const options={width,height,score,pose,view:notation.view,anchor:head.anchor,headWidth};
    const target=width<=360?22:28;
    const zoom=fitCloseZoom(options,target);
    const actual=projectedHeadWidth({...options,zoom});
    assert.ok(Math.abs(actual-target)<.02,`${width}px pose${pose}: ${actual}px`);
    assert.ok(zoom>=.55&&zoom<=6);
  }
});
test('fitting has no scroll direction or previous-pose state',()=>{
  const positions=[.55,.61,.7,.76,.85];
  const options={width:390,height:844,score,view:notation.view,anchor:head.anchor,headWidth};
  const scratch={};
  const down=positions.map(pose=>fitCloseZoom({...options,pose},28,scratch));
  const up=positions.toReversed().map(pose=>fitCloseZoom({...options,pose},28,scratch)).reverse();
  assert.deepEqual(up,down);
});

test('the approaching branch cannot explode across the reading surface',()=>{
  for(const [width,height] of [[320,720],[390,844],[1280,800]]) for(const pose of [.42,.52,.6,.71,.9]) {
    const options={width,height,score,pose,view:notation.view,headWidth:headWidth*1.1,zoom:2};
    const limit=width<=700?50:90;
    const zoom=limitCloseZoom(options,limit);
    const maximum=maximumProjectedHeadWidth({...options,zoom});
    assert.ok(maximum<=limit+.02,`${width} pose${pose}: ${maximum}`);
    assert.ok(zoom<=options.zoom);
  }
});
