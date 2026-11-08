import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRibbonTimeline as score } from '../assets/about/score-ribbon-timeline.js';
import { scoreRibbonData } from '../assets/about/score-ribbon-data.js';
import { buildEngraving,projectedRest } from '../assets/about/score-engraving.js';
import {buildCompoundGroups,projectCompoundGroup,enqueueCompoundGroups} from '../assets/about/score-compound-groups.js';
import { createTravelProjector } from '../assets/about/score-ribbon-geometry.js';
import { projectHeadStem } from '../assets/about/score-head-stems.js';

const view = { x0: score.bars[30].xStart, x1: score.bars[32].xEnd };
const notes = score.pdfGlyphs.filter(g => g.noteId && g.x >= view.x0 && g.x <= view.x1)
  .map(g => ({ id: g.noteId, x: g.x, y: Math.round(g.y) }));
const engraving = buildEngraving(score, notes, view);
const groups=buildCompoundGroups(engraving,score);

test('the source has six triplet groups, six figures and twenty-four unique bracket strokes', () => {
  assert.equal(engraving.beams.length, 6);
  assert.deepEqual(engraving.beams.map(b => b.members.length), [3, 3, 3, 3, 3, 3]);
  assert.equal(new Set(engraving.beams.flatMap(b => b.members.map(m => m.note.id))).size, 18);
  assert.equal(engraving.glyphs.filter(g => g.glyph.text === '3').length, 6);
  assert.equal(engraving.brackets.length, 24);
  assert.equal(new Set(engraving.brackets.map(b => JSON.stringify(b.command))).size, 24);
  assert.ok(engraving.brackets.every(b => b.command.kind === 'l'), 'No ties or slurs in this source excerpt');
});

test('every group projects its stem tips and beam boundary through identical ribbon anchors', () => {
  for (const pose of [1, .13,.4]) {
    const project = createTravelProjector(1280, 711, score, pose, view,.42);
    for (const group of groups.filter(g=>g.beam)) {
      const shape=projectCompoundGroup(group,project);
      for(const [index,stem] of group.stems.entries()){
        assert.equal(stem.contact.u,stem.tip.u);
        assert.ok([...group.upper,...group.lower].some(p=>p.u===stem.tip.u&&p.v===stem.tip.v));
        const tip=shape.stems[index].points.at(-1);
        assert.ok(shape.beam.some(p=>Math.hypot(p.x-tip.x,p.y-tip.y)<1e-8),stem.noteId);
      }
    }
  }
});

test('one printed sharp applies to both D sharp 5 events in bar 31', () => {
  const accidental = engraving.glyphs.filter(g => g.glyph.text !== '3');
  assert.equal(accidental.length, 1);
  assert.equal(accidental[0].glyph.text, 'D'); // Guitar Pro's embedded sharp glyph, checked against the PDF.
  assert.equal(accidental[0].pair.note.id, 'guitar-31-4-1');
  const heads = scoreRibbonData.systems.flatMap(s => s.heads);
  for (const id of ['guitar-31-4-1', 'guitar-31-10-1']) {
    assert.equal(heads.find(h => h.id === id).writtenMidi, 75);
  }
});

test('bar 32 uses the requested whole-measure rest and does not resurrect the old high chord', () => {
  assert.equal(engraving.pairs.filter(p => p.note.id.startsWith('guitar-32-')).length, 0);
  assert.equal(engraving.glyphs.filter(g => g.glyph.text === '=').length, 0);
  assert.equal(engraving.rest.bar, 32);
  assert.equal(engraving.rest.x, (score.bars[31].xStart + score.bars[31].xEnd) / 2);
  assert.equal(engraving.rest.y, -6);
});

test('one queue item owns each complete group, and simplified detail is an explicit alternative',()=>{
  for(const pose of [.13,.4,1]){
    const queue=[],context={};
    const project=createTravelProjector(1280,711,score,pose,view,.42);
    enqueueCompoundGroups(queue,context,groups,score,project,true);
    assert.equal(queue.length,8);
    assert.equal(new Set(queue.map(item=>item.id)).size,8);
    groups.forEach(group=>{
      const item=queue.find(item=>item.id===group.id);
      assert.equal(item.depth,projectCompoundGroup(group,project).center.depth);
      assert.ok(item.depthTriangles.length>0);
    });
    const rest=projectedRest(engraving.rest,project);
    assert.ok(rest.width>=12&&rest.height>=4);
    assert.ok(rest.anchor.x>rest.width/2&&rest.anchor.x<1280-rest.width/2);
  }
});

test('bracket clearance, number offset and gap are defined in ribbon units and do not depend on the camera',()=>{
  assert.equal(new Set(groups.map(g=>g.id)).size,8);
  assert.ok(groups.every(group=>group.anchors.every(point=>Number.isFinite(point.u)&&Number.isFinite(point.v))));
  for(const group of groups.filter(g=>g.bracket)){
    const b=group.bracket;
    for(let i=0;i<=20;i++){
      const u=b.u0+(b.u1-b.u0)*i/20;
      assert.ok(Math.abs(b.at(u)-group.beamAt(u,b.side)-b.offset)<1e-10);
    }
    assert.equal(group.number.anchor.u,b.centerU);
    assert.ok(Math.abs(group.number.anchor.v-b.at(b.centerU)-group.number.normalOffset)<1e-10);
    const left=b.paths[0].at(-1),right=b.paths[1][0];
    assert.ok(Math.abs((right.u-left.u)/(b.u1-b.u0)-b.gapFraction)<1e-10);
    const serialized=JSON.stringify(group.anchors);
    for(const pose of [.13,.4,1])projectCompoundGroup(group,createTravelProjector(1280,711,score,pose,view,.42));
    assert.equal(JSON.stringify(group.anchors),serialized,'Projection must not mutate ribbon definitions');
  }
});

test('the frontal glyph contours and stem contacts retain the approved uniform placement',()=>{
  const project=createTravelProjector(1130,1130/1.8,score,1,view,.42);
  for(const group of groups){
    const shape=projectCompoundGroup(group,project);
    group.heads.forEach((head,index)=>{
      const anchor=project(head.anchor.u,head.anchor.v);
      head.contours.forEach((points,j)=>points.forEach((point,k)=>{
        const expected={x:anchor.x+(point.u-head.anchor.u)*anchor.scale,y:anchor.y+(point.v-head.anchor.v)*anchor.scale};
        const actual=shape.heads[index].contours[j][k];
        assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<.15);
      }));
      const pair=engraving.pairs.find(p=>p.note.id===head.noteId),old=projectHeadStem(pair,project);
      const contact=shape.stems[index].points[0];
      assert.ok(Math.hypot(contact.x-old.contact.x,contact.y-old.contact.y)<.15);
    });
  }
});

test('printed line weights, ledger lengths and the double barline are retained',()=>{
  assert.ok(Math.abs(engraving.staffWidth-.34226258)<1e-6);
  assert.equal(engraving.barlines.length,5);
  const around33=engraving.barlines.filter(line=>Math.abs(line.x-score.bars[32].xStart)<1);
  assert.equal(around33.length,2);
  const lowE=engraving.ledgerLines.filter(line=>line.pair.note.id==='guitar-33-1-1');
  assert.deepEqual(lowE.map(line=>line.y).sort((a,b)=>a-b),[2,4,6]);
  assert.ok(lowE.every(line=>line.x0<line.pair.glyph.x&&line.x1>line.pair.glyph.x+2));
});

test('the final six-note beam group keeps three source bands and all six triplet labels together',()=>{
  const bar=score.bars[102],barView={x0:bar.xStart,x1:bar.xEnd};
  const barNotes=score.pdfGlyphs.filter(g=>g.noteId&&g.x>=barView.x0&&g.x<=barView.x1)
    .map(g=>({id:g.noteId,x:g.x,y:Math.round(g.y)}));
  const source=buildEngraving(score,barNotes,barView);
  const beam=source.beams.find(item=>item.members.length===6);
  assert.ok(beam,'the PDF has one shared six-note beamed group');
  assert.equal(beam.drawings.length,3,'the three engraved beam strips stay as separate contours');
  const allCompounds=buildCompoundGroups(source,score);
  const compound=allCompounds.find(group=>group.heads.length===6);
  assert.ok(compound);
  assert.equal(allCompounds.filter(group=>group.heads.some(head=>beam.members.some(member=>member.note.id===head.noteId))).length,1);
  assert.equal(compound.beamBands.length,3);
  assert.equal(compound.stems.length,6);
  assert.equal(compound.tuplets.length,6,'every printed triplet number is retained');
  assert.equal(new Set(compound.heads.map(head=>head.noteId)).size,6);
  const shape=projectCompoundGroup(compound,createTravelProjector(1280,711,score,.4,barView,.42));
  assert.equal(shape.beams.length,3);
  assert.equal(shape.tuplets.length,6);
  assert.ok(shape.beams.flat().every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
});
