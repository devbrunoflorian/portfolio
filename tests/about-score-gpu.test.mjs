import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTravelProjector} from '../assets/about/score-travel-geometry.js';
import {createRibbonFrameTable} from '../assets/about/score-gpu-ribbon.js';
import {buildRibbonGeometry,trebleClefContoursFromSvg} from '../assets/about/score-gpu-ribbon-geometry.js';
import {buildEngraving} from '../assets/about/score-engraving.js';
import {buildCompoundGroups,glyphContours} from '../assets/about/score-compound-groups.js';
import {scoreRibbonTimeline as score} from '../assets/about/score-ribbon-timeline.js';
import {scoreRibbonData} from '../assets/about/score-ribbon-data.js';
import {createAdaptiveDpr, initialGpuPixelRatio, poseBetweenDocumentCenters} from '../assets/about/score-gpu-budget.js';
import {playbackNotationAtBeat,selectedNotation,selectedNotationForBars} from '../assets/about/score-gpu-scroll.js';
import {staffYForMidi} from '../assets/about/score-ribbon-renderer.js';
import {scorePlaybackWindowAtBeat,scorePositionAtBeat} from '../assets/about/score-ribbon-timeline.js';
import {createGpuEditorialFrame} from '../assets/about/score-gpu-frame.js';

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

test('GPU score keeps both melody contours on the guitar score timeline and staff map',()=>{
  const notation=selectedNotation();
  assert.deepEqual([notation.firstBar,notation.lastBar],[33,35]);
  assert.deepEqual(notation.voicePaths.map(path=>path.track),[1,2]);
  for(const path of notation.voicePaths){
    assert.ok(path.points.length>path.notes.length);
    const visibleNotes=path.notes.filter(note=>note.x>=notation.view.x0&&note.x<=notation.view.x1);
    assert.equal(visibleNotes.length,11);
    for(const note of path.notes){
      assert.ok(Math.abs(note.x-scorePositionAtBeat(note.beat))<.0001);
      assert.equal(note.y,staffYForMidi(note.writtenMidi,score));
    }
  }

  const geometry=buildRibbonGeometry(score,notation.view,notation.groups,notation.engraving,notation.voicePaths);
  const voices=geometry.attributes.voice.array,kind=geometry.attributes.kind.array;
  for(const track of [1,2]){
    assert.ok(voices.some((value,index)=>value===track&&kind[index]===2),`voice ${track} has a curved trail`);
    assert.ok(voices.some((value,index)=>value===track&&kind[index]===1),`voice ${track} has attack markers`);
  }
  geometry.dispose();
});

test('playback windows follow the beat continuously and retain the silent 33–35 preview scale',()=>{
  const preview=selectedNotation();
  const silent=scorePlaybackWindowAtBeat(134,1280,preview.view.x1-preview.view.x0);
  assert.deepEqual([preview.firstBar,preview.lastBar],[33,35]);
  assert.ok(Math.abs((silent.endX-silent.startX)-(preview.view.x1-preview.view.x0))<1e-8);
  const a=scorePlaybackWindowAtBeat(394,1280,preview.view.x1-preview.view.x0);
  const b=scorePlaybackWindowAtBeat(395,1280,preview.view.x1-preview.view.x0);
  assert.ok(Math.abs((a.endX-a.startX)-(preview.view.x1-preview.view.x0))<1e-8);
  assert.ok(b.startX>a.startX&&b.startX-a.startX<20,'playhead window should slide smoothly between adjacent beats');
  const front=createTravelProjector(width,height,score,1,{x0:a.startX,x1:a.endX});
  assert.ok(Math.abs(front.uvAspect-1)<1e-10,'front-frame spacing uses the moving reading window, not the larger notation buffer');
  for(const beat of [0,134,394,422,423.999]){
    const notation=playbackNotationAtBeat(beat);
    assert.ok(notation.firstBar>=1&&notation.lastBar<=score.bars.length);
    assert.ok(notation.sourceRange.x1>notation.sourceRange.x0);
    assert.ok(notation.groups.every(group=>group.heads.length>=1));
  }
});

test('notation windows build from Intro through the final open-note system',()=>{
  const windows=[];
  for(let bar=1;bar<=score.bars.length;bar++){
    const notation=playbackNotationAtBeat((bar-.5)*scoreRibbonData.beatsPerBar);
    windows.push(notation);
  }
  assert.equal(windows.length,106);
  assert.ok(windows.some(notation=>notation.groups.some(group=>group.number)),'tuplet groups remain represented');
  assert.ok(windows.some(notation=>notation.groups.some(group=>group.stems.length===0)),'stemless whole notes remain valid');
  assert.ok(windows.some(notation=>notation.engraving.beams.some(beam=>beam.members.length>3)),
    'multi-beat shared beams are retained as a single source shape');
  for(const index of [0,32,46,97,100,103,105]){
    const notation=windows[index];
    const geometry=buildRibbonGeometry(score,notation.view,notation.groups,notation.engraving,notation.voicePaths);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite),`finite GPU geometry at bar ${index+1}`);
    assert.ok(geometry.attributes.position.count>0);
    geometry.dispose();
  }
});

test('GPU buffers keep the final shared beam bands in one score group',()=>{
  const notation=playbackNotationAtBeat(410);
  const group=notation.groups.find(item=>item.bar===103&&item.heads.length===6);
  assert.ok(group);
  assert.equal(group.beamBands.length,3);
  assert.equal(group.tuplets.length,6);
  const geometry=buildRibbonGeometry(score,notation.view,notation.groups,notation.engraving,notation.voicePaths);
  assert.ok(geometry.attributes.position.array.every(Number.isFinite));
  geometry.dispose();
});

test('study windows can inspect the final six-note triplet group and mark one of its real notes',()=>{
  const notation=selectedNotationForBars(101,103);
  assert.deepEqual([notation.firstBar,notation.lastBar],[101,103]);
  const group=notation.groups.find(item=>item.bar===103&&item.heads.length===6);
  assert.ok(group,'the final measure group is available in the selected window');
  assert.equal(group.beamBands.length,3);
  assert.equal(group.tuplets.length,6);
  assert.deepEqual(group.heads.map(head=>head.glyph.noteId),[
    'guitar-103-1-1','guitar-103-2-1','guitar-103-3-1',
    'guitar-103-4-1','guitar-103-5-1','guitar-103-6-1',
  ]);
  const markerId=group.heads[0].glyph.noteId;
  const geometry=buildRibbonGeometry(score,notation.view,notation.groups,notation.engraving,notation.voicePaths,markerId);
  const gold=geometry.attributes.gold.array,heads=geometry.attributes.frontHead.array;
  assert.ok(gold.some(value=>value===1),'the selected marker note receives the explicit GPU mask');
  gold.forEach((value,index)=>{if(value===1)assert.equal(heads[index],1);});
  assert.ok(geometry.attributes.position.array.every(Number.isFinite));
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

test('camera zoom moves the front pose closer without changing its target',()=>{
  const base=createTravelProjector(width,height,score,1,view);
  const zoomed=createTravelProjector(width,height,score,1,view,.2,true,null,2.5);
  const distance=project=>Math.hypot(...project.camera.position.map((value,index)=>value-project.camera.target[index]));
  assert.deepEqual(zoomed.camera.target,base.camera.target);
  assert.ok(Math.abs(distance(base)/distance(zoomed)-2.5)<1e-10);
  assert.throws(()=>createTravelProjector(width,height,score,1,view,.2,true,null,0),RangeError);
});

test('GPU editorial framing is neutral at Music and reversible for every chapter offset',()=>{
  const music={x:124,y:286,scale:.96},baseZoom=2.5;
  const front=createGpuEditorialFrame(music,music,baseZoom);
  assert.deepEqual(front,{offset:{x:0,y:0},zoom:baseZoom});
  const chapter={x:music.x-173,y:music.y+91,scale:.62};
  const away=createGpuEditorialFrame(chapter,music,baseZoom);
  const back=createGpuEditorialFrame(chapter,music,baseZoom);
  assert.deepEqual(away,back);
  assert.deepEqual(away.offset,{x:-173,y:91});
  assert.ok(Math.abs(away.zoom-(baseZoom*.62/.96))<1e-12);
});

test('GPU editorial frame rejects invalid scales and camera zooms',()=>{
  assert.throws(()=>createGpuEditorialFrame({x:0,y:0,scale:0},{x:0,y:0,scale:1}),/positive scale/);
  assert.throws(()=>createGpuEditorialFrame({x:0,y:0,scale:1},{x:0,y:0,scale:1},0),/positive and finite/);
});

test('notation path reader preserves quadratic treble-clef contours for GPU tessellation',()=>{
  const contours=glyphContours('M0 0 Q5 10 10 0 L10 -2 Q5 8 0 -2 Z');
  assert.equal(contours.length,1);
  assert.ok(contours[0].length>40);
  assert.deepEqual(contours[0][0],[0,0]);
  assert.deepEqual(contours[0].at(-1),[0,-2]);
});

test('existing treble clef is converted to ribbon-space contours and triangulated with the staff',()=>{
  const svg=readFileSync(new URL('../assets/about/guitar-score/notation-header.svg',import.meta.url),'utf8');
  const clef=trebleClefContoursFromSvg(svg);
  const points=clef.flat();
  assert.ok(points.length>100);
  assert.ok(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
  assert.ok(Math.max(...points.map(([x])=>x))>1.5);
  assert.ok(Math.min(...points.map(([,y])=>y))<-4);
  assert.ok(Math.max(...points.map(([,y])=>y))<.2);
  const geometry=buildRibbonGeometry(score,view,groups,engraving,[],undefined,clef);
  const kinds=geometry.attributes.kind.array,uvs=geometry.attributes.sourceUV.array,offsets=geometry.attributes.glyphOffset.array;
  const clefAnchor=view.x0+(view.x1-view.x0)*.12;
  const clefVertices=[...kinds.keys()].filter(index=>kinds[index]===5&&Math.abs(uvs[index*2]-clefAnchor)<1e-3);
  assert.ok(clefVertices.length>100);
  assert.ok(clefVertices.some(index=>offsets[index*2]!==0||offsets[index*2+1]!==0));
  geometry.dispose();
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
