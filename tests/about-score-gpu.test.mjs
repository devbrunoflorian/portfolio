import test from 'node:test';
import assert from 'node:assert/strict';
import {createTravelProjector} from '../assets/about/score-travel-geometry.js';
import {createRibbonFrameTable} from '../assets/about/score-gpu-ribbon.js';
import {buildRibbonGeometry} from '../assets/about/score-gpu-ribbon-geometry.js';
import {buildEngraving} from '../assets/about/score-engraving.js';
import {buildCompoundGroups} from '../assets/about/score-compound-groups.js';
import {scoreRibbonTimeline as score} from '../assets/about/score-ribbon-timeline.js';
import {scoreRibbonData} from '../assets/about/score-ribbon-data.js';

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
