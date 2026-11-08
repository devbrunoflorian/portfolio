import test from 'node:test';
import assert from 'node:assert/strict';
import {createTravelProjector} from '../assets/about/score-travel-geometry.js';
import {createRibbonFrameTable} from '../assets/about/score-gpu-ribbon.js';
import {buildRibbonGeometry} from '../assets/about/score-gpu-ribbon-geometry.js';
import {buildEngraving} from '../assets/about/score-engraving.js';
import {buildCompoundGroups} from '../assets/about/score-compound-groups.js';
import {scoreRibbonTimeline as score} from '../assets/about/score-ribbon-timeline.js';
import {scoreRibbonData} from '../assets/about/score-ribbon-data.js';
import {createAdaptiveDpr, initialGpuPixelRatio, poseBetweenDocumentCenters} from '../assets/about/score-gpu-budget.js';

const view={x0:score.bars[30].xStart,x1:score.bars[32].xEnd},width=1142,height=width/1.8;
const step=[0,0,1,1,2,3,3,4,4,5,5,6];
const notes=scoreRibbonData.systems.flatMap(s=>s.heads).filter(h=>h.bar>=31&&h.bar<=33).map(h=>({id:h.id,x:score.pdfGlyphs.find(g=>g.noteId===h.id).x,
  y:-((Math.floor(h.writtenMidi/12)-1)*7+step[h.writtenMidi%12]-30)}));
const engraving=buildEngraving(score,notes,view),groups=buildCompoundGroups(engraving,score);

test('static UV attributes have equal finite lengths, explicit gold coverage and no per-pose coordinates',()=>{
  const geometry=buildRibbonGeometry(score,view,groups,engraving);
  const count=geometry.attributes.position.count;
  assert.ok(count>0);assert.equal(count%3,0);
  for(const attr of Object.values(geometry.attributes)){
    assert.equal(attr.count,count);assert.ok(attr.array instanceof Float32Array);assert.ok(attr.array.every(Number.isFinite));
  }
  const gold=geometry.attributes.gold.array,head=geometry.attributes.frontHead.array;
  assert.ok(gold.some(x=>x===1));assert.ok(gold.some(x=>x===0));
  gold.forEach((x,i)=>{if(x===1)assert.equal(head[i],1);});
  assert.ok(geometry.attributes.kind.array.some(x=>x===3));
  const curvedGlyphs=[...geometry.attributes.kind.array.keys()].filter(i=>geometry.attributes.kind.array[i]===5);
  assert.ok(curvedGlyphs.length>0,'triplet numbers use surface-deformed glyph geometry');
  assert.ok(curvedGlyphs.some(i=>geometry.attributes.glyphOffset.array[i*2]!==0));
  geometry.dispose();
});

test('Float32 arc table reconstructs the reference projection across sixty camera poses',()=>{
  const base=createTravelProjector(width,height,score,0,view);
  const table=createRibbonFrameTable(base.samples),N=table.size,T=table.data;
  const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let maximum=0;
  for(let pose=0;pose<60;pose++){
    const p=pose/59,project=createTravelProjector(width,height,score,p,view),span=project.arcLength;
    const arrive=Math.max(0,Math.min(1,(p-.65)/.2)),unit=(width*1.5*(1-arrive)+span*arrive)/(view.x1-view.x0);
    const forward=project.camera.forward,right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward));
    for(let j=0;j<100;j++){
      const u=(j*47%101)/100,v=-14+(j*31%23);
      const f=(p*.65*table.length+u*span)/table.length*(N-1),i=Math.min(N-2,Math.floor(f)),t=f-i;
      const pos=[0,1,2].map(k=>T[i*4+k]+(T[(i+1)*4+k]-T[i*4+k])*t);
      const normal=norm([0,1,2].map(k=>T[N*4+i*4+k]+(T[N*4+(i+1)*4+k]-T[N*4+i*4+k])*t));
      const rel=pos.map((x,k)=>x+normal[k]*(v+4)*unit-project.camera.position[k]),z=dot(rel,forward);
      const a=project(view.x0+u*(view.x1-view.x0),v);
      const x=width/2+dot(rel,right)*width*1.45/z,y=height/2+dot(rel,up)*width*1.45/z;
      maximum=Math.max(maximum,Math.hypot(a.x-x,a.y-y));
    }
  }
  assert.ok(maximum<.5,`maximum table error ${maximum}px`);
  console.log(`Float32 table maximum screen deviation: ${maximum.toFixed(6)}px (6000 deterministic points)`);
});

test('reused projector scratch preserves coordinates and object identity across sixty poses',()=>{
  const scratch={};let project,point,camera,position;
  for(let index=0;index<60;index++){
    const pose=index/59;
    const reference=createTravelProjector(width,height,score,pose,view);
    project=createTravelProjector(width,height,score,pose,view,.2,true,scratch);
    const expected=reference(view.x0+(view.x1-view.x0)*.43,-7.5);
    const actual=project(view.x0+(view.x1-view.x0)*.43,-7.5);
    assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8);
    assert.ok(Math.abs(actual.depth-expected.depth)<1e-8);
    assert.ok(Math.abs(actual.scale-expected.scale)<1e-8);
    if(point)assert.equal(actual,point);
    if(camera)assert.equal(project.camera,camera);
    if(position)assert.equal(project.camera.position,position);
    point=actual;camera=project.camera;position=project.camera.position;
  }
});

test('adaptive DPR starts at 1.5, only steps down after 60 consecutive frames above 20ms p95',()=>{
  assert.equal(initialGpuPixelRatio(3),1.5);
  assert.equal(initialGpuPixelRatio(1),1);
  const fast=createAdaptiveDpr(2);
  assert.equal(fast.pixelRatio,1.5);
  let result;
  for(let frame=0;frame<60;frame++)result=fast.observe(frame*16);
  assert.equal(result.frames,60);assert.equal(result.intervals,59);assert.equal(result.p95,16);
  assert.equal(result.pixelRatio,1.5);assert.equal(result.lowered,false);

  const slow=createAdaptiveDpr(1.5);
  for(let frame=0;frame<60;frame++)result=slow.observe(frame*24);
  assert.equal(result.p95,24);assert.equal(result.pixelRatio,1.25);assert.equal(result.lowered,true);
  for(let frame=0;frame<60;frame++)result=slow.observe(2000+frame*24);
  assert.equal(result.pixelRatio,1);
  for(let frame=0;frame<60;frame++)result=slow.observe(4000+frame*24);
  assert.equal(result.pixelRatio,1);
});

test('adaptive DPR discards a window across an idle gap',()=>{
  const budget=createAdaptiveDpr(1.5);
  for(let frame=0;frame<40;frame++)assert.equal(budget.observe(frame*16),null);
  assert.equal(budget.observe(2000),null);
  for(let frame=1;frame<59;frame++)assert.equal(budget.observe(2000+frame*16),null);
  const result=budget.observe(2000+59*16);
  assert.equal(result.intervals,59);assert.equal(result.pixelRatio,1.5);
});

test('scroll camera pose is pure, clamped, and reversible between the two reading centers',()=>{
  const codeTop=500,codeHeight=300,musicTop=1800,musicHeight=400,viewport=800;
  const start=codeTop+codeHeight/2, end=musicTop+musicHeight/2;
  const scrollAt=(center)=>center-viewport/2;
  const poseAt=(scroll)=>poseBetweenDocumentCenters(scroll,viewport,codeTop,codeHeight,musicTop,musicHeight);
  assert.equal(poseAt(scrollAt(start)),0);
  assert.equal(poseAt(scrollAt((start+end)/2)),.5);
  assert.equal(poseAt(scrollAt(end)),1);
  const positions=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1].map(p=>start+(end-start)*p);
  const descending=positions.map(center=>poseAt(scrollAt(center)));
  const ascending=[...positions].reverse().map(center=>poseAt(scrollAt(center)));
  assert.deepEqual(ascending,[...descending].reverse());
  assert.ok(descending.every((pose,index)=>index===0||pose>=descending[index-1]));
  assert.equal(poseAt(scrollAt(start)-100),0);
  assert.equal(poseAt(scrollAt(end)+100),1);
});
