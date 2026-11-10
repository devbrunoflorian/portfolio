import test from 'node:test';
import assert from 'node:assert/strict';
import {indexSegments} from '../assets/about-legacy/score-segment-index.js';
import {createTravelProjector} from '../assets/about-legacy/score-travel-geometry.js';
import {scoreRibbonTimeline as score} from '../assets/about-legacy/score-ribbon-timeline.js';
const view={x0:score.bars[30].xStart,x1:score.bars[32].xEnd};
function reference(points,x,y){
  let best=Infinity,result;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const distance=(x-a.x-dx*t)**2+(y-a.y-dy*t)**2;
    if(distance<best){best=distance;result={depth:a.depth+(b.depth-a.depth)*t,u:a.u+(b.u-a.u)*t};}
  }
  return result;
}
test('spatial rejection gives exactly the original nearest depth and u on crossing staff lines',()=>{
  for(const pose of [.108,.13,.4,.856,1]){
    const project=createTravelProjector(1280,800/1.8,score,pose,view);
    for(const y of score.staffLines){
      const points=Array.from({length:281},(_,i)=>project(view.x0+(view.x1-view.x0)*i/280,y)),lookup=indexSegments(points);
      for(let i=0;i<400;i++){
        const x=i*419%1400-60,yy=i*631%900-50;
        assert.deepEqual(lookup(x,yy),reference(points,x,yy));
      }
    }
  }
});
test('cached typed world samples preserve the uncached camera and projection in 60 consecutive poses',()=>{
  for(let i=0;i<60;i++){
    const args=[1280,800/1.8,score,i/59,view,.2];
    const a=createTravelProjector(...args,false),b=createTravelProjector(...args,true);
    assert.deepEqual(a.camera,b.camera);
    for(let j=0;j<10;j++)assert.deepEqual(a(view.x0+(view.x1-view.x0)*j/9,-j),b(view.x0+(view.x1-view.x0)*j/9,-j));
  }
});
