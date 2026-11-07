import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawProfile,summarizeSamples} from '../assets/about/score-draw-profile.js';
import {paintDepthQueue} from '../assets/about/score-occlusion.js';

test('sample summaries use the median and nearest-rank p95 without dropping slow samples',()=>{
  const samples=Array.from({length:30},(_,i)=>({total:i+1}));
  assert.deepEqual(summarizeSamples(samples).total,{median:15.5,p95:29,min:1,max:30});
});

test('exclusive nested CPU stages do not count child work twice',()=>{
  const profile=createDrawProfile();
  const end=profile.start('pathAssembly');
  const projection=profile.projector(Object.assign((x,y)=>({x,y}),{uvAspect:2}));
  assert.deepEqual(projection(2,3),{x:2,y:3});end();
  assert.equal(profile.projectionCalls,1);assert.equal(projection.uvAspect,2);
  assert.ok(profile.values.geometry>=0&&profile.values.pathAssembly>=0);
});

test('instrumented visibility and shading preserve the uninstrumented pixels',()=>{
  const render=profile=>{
    let image;
    const ctx={canvas:{width:8,height:2},clearRect(){},createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
      getImageData(x,y,w,h){const p=this.createImageData(w,h);for(let i=0;i<p.data.length;i+=4)p.data.set([210,190,230,160],i);return p;},putImageData(p){image=p;}};
    const queue=[{depth:-12,depthAt(x){return x<4?-10:-20;},paint(){}},{depth:-8,paint(){}}];
    paintDepthQueue(ctx,queue,[],8,2,{fade:true,focusDistance:1,profile});return image.data;
  };
  assert.deepEqual(render(createDrawProfile()),render(null));
});
