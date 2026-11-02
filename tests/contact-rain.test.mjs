import test from 'node:test';
import assert from 'node:assert/strict';
import { RainModel } from '../assets/contact/stillflow/rain-model.js';

const create = (seed=42,limit=150) => new RainModel({ seed,limit,contains:(x,y)=>x>0&&x<1340&&y>0&&y<670 });
const run = (model,seconds,target) => { for(let i=0;i<seconds*60;i++)model.step(1/60,target); };

test('rain is repeatable for a fixed seed and simulation timeline',()=>{
  const a=create(), b=create(), other=create(43);
  for(const model of [a,b,other]) {run(model,8,1);run(model,3,.4);}
  assert.deepEqual(a.drops,b.drops);assert.deepEqual(a.trails,b.trails);
  assert.notDeepEqual(a.drops,other.drops);
});

test('dry startup never emits water and rain builds asynchronously within a bounded population',()=>{
  const model=create();run(model,10,0);
  assert.equal(model.births,0);assert.equal(model.drops.length,0);
  run(model,20,1);
  assert(model.drops.length>40&&model.drops.length<=150);
  assert(new Set(model.drops.map(d=>d.age)).size>20);
  assert(model.drops.some(d=>d.age>d.wait));assert(model.drops.some(d=>d.wait===Infinity));
  assert(new Set(model.drops.map(d=>d.speed)).size>20);
  assert(model.trails.length>0&&model.trails.length<=450);
});

test('rain to dry finishes residual droplets and trails and stops emitting',()=>{
  const model=create();run(model,20,1);
  const wet=model.snapshot();assert(wet.drops>0);
  run(model,20,0);
  assert.equal(model.intensity,0);assert.equal(model.drops.length,0);assert.equal(model.trails.length,0);
  const births=model.births;run(model,30,0);assert.equal(model.births,births);
  run(model,4,1);assert(model.drops.length>0);
});

test('small-device population is bounded and an empty aperture cannot emit drops',()=>{
  const mobile=create(42,45);run(mobile,120,1.5);
  assert(mobile.drops.length<=45);assert(mobile.trails.length<=135);
  const closed=new RainModel({contains:()=>false});run(closed,20,1);
  assert.equal(closed.births,0);assert.equal(closed.drops.length,0);
});
