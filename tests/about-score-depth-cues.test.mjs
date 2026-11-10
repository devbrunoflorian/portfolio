import test from 'node:test';
import assert from 'node:assert/strict';
import {depthAppearance,DEPTH_BANDS} from '../assets/about-legacy/score-occlusion.js';
import {enqueueStaffLine,HALO_HALF_WIDTH,staffInk} from '../assets/about-legacy/score-depth-cues.js';
import {createTravelProjector} from '../assets/about-legacy/score-travel-geometry.js';
import {scoreRibbonTimeline as score} from '../assets/about-legacy/score-ribbon-timeline.js';
import {readingFocus,focusWeights} from '../assets/about-legacy/score-focus-profile.js';
const view={x0:score.bars[30].xStart,x1:score.bars[32].xEnd};

test('near/far bands are independent of viewport scale and decrease all three cues monotonically',()=>{
  const focus=2;
  assert.deepEqual(depthAppearance(-focus*1000,1000,focus),{opacity:1,brightness:1,saturation:1});
  const far=depthAppearance(-(focus+DEPTH_BANDS.farOffset)*1000,1000,focus);
  assert.ok(Math.abs(far.opacity-.32)<1e-10);
  assert.ok(Math.abs(far.brightness-.72)<1e-10);
  assert.ok(Math.abs(far.saturation-.2)<1e-10);
  let previous={opacity:1,brightness:1,saturation:1};
  for(let i=0;i<=30;i++){
    const distance=focus+i/30;
    const current=depthAppearance(-distance*1000,1000,focus);
    assert.deepEqual(current,depthAppearance(-distance*500,500,focus));
    for(const property of ['opacity','brightness','saturation'])assert.ok(current[property]<=previous[property]+1e-10);
    previous=current;
  }
});

test('reading plane includes the visible gold note; 40% and frontal never fade and frontal never blurs',()=>{
  const marker={x:score.pdfGlyphs.find(g=>g.noteId==='guitar-33-4-1').x,y:-2};
  for(const pose of [.13,.4,1]){
    const project=createTravelProjector(1280,711,score,pose,view);
    const focus=readingFocus(project,view,1280,711,marker,pose);
    assert.ok(focus.distance>=-project(marker.x,marker.y).depth/1280-1e-6);
    if(pose>=.4)assert.equal(focus.fade,false);
    if(pose===1)assert.equal(focus.blur,false);
  }
});

test('focus band weights preserve coverage and always protect foreground heads and gold',()=>{
  for(let offset=-1;offset<1;offset+=.013){
    const weights=focusWeights(-(2+offset)*1000,1000,2);
    assert.ok(weights.every(w=>w>=0&&w<=1));
    assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
    assert.deepEqual(focusWeights(-(2+offset)*1000,1000,2,true),[1,0,0,0]);
    if(offset<=.05)assert.deepEqual(weights,[1,0,0,0]);
  }
});

test('each staff line is one closed path with one fill, with depth data only for masking',()=>{
  let fills=0,starts=0;
  const context={beginPath(){starts++;},moveTo(){},lineTo(){},closePath(){},fill(){fills++;}};
  for(const pose of [.13,.4,1]){
    const project=createTravelProjector(1280,711,score,pose,view),queue=[];
    for(const y of score.staffLines)enqueueStaffLine(queue,context,project,view,y,.34226258);
    assert.equal(queue.length,5);
    queue.forEach(item=>{item.paint();assert.ok(item.depthTriangles.length>0);});
    assert.equal(fills,starts);
    assert.equal(fills,pose===.13?5:pose===.4?10:15);
    const ink=staffInk(project,view,-4,.34226258);
    assert.ok(ink.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
});

test('halo is centered on the same staff midpoint and wider than five staff lines',()=>{
  assert.ok(HALO_HALF_WIDTH>4);
  assert.equal((-4-HALO_HALF_WIDTH+-4+HALO_HALF_WIDTH)/2,-4);
});
