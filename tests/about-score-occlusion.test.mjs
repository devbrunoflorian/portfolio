import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterDepth,paintDepthQueue,SCORE_BACKGROUND} from '../assets/about/score-occlusion.js';

const triangle=depth=>[{x:0,y:0,depth,u:.1},{x:4,y:0,depth,u:.2},{x:0,y:4,depth,u:.1}];
test('depth rasterization retains the near surface regardless of insertion order',()=>{
  for(const order of [[-10,-100],[-100,-10]]){
    const buffer=new Float32Array(16).fill(-Infinity);
    for(const depth of order)rasterDepth(buffer,4,4,triangle(depth));
    assert.equal(buffer[0],-10);
  }
});

test('a depth-only surface produces exactly the background and hides distant ink',()=>{
  let result,current;
  const context={canvas:{width:4,height:4},
    createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
    clearRect(){current=null;},
    getImageData(x,y,w,h){const p=this.createImageData(w,h);for(let i=0;i<p.data.length;i+=4)p.data.set(current??[0,0,0,0],i);return p;},
    putImageData(image){result=image;}};
  const surface=[{x:0,y:0,depth:-10,u:0},{x:4,y:0,depth:-10,u:0},{x:4,y:4,depth:-10,u:0},{x:0,y:4,depth:-10,u:0}];
  paintDepthQueue(context,[{depth:-100,paint(){current=[255,0,0,255];}}],[surface],4,4);
  assert.equal(SCORE_BACKGROUND,'#060609');
  for(let i=0;i<result.data.length;i+=4)assert.deepEqual([...result.data.slice(i,i+4)],[6,6,9,255]);
  paintDepthQueue(context,[{depth:-5,paint(){current=[255,0,0,255];}}],[surface],4,4);
  assert.deepEqual([...result.data.slice(0,4)],[255,0,0,255]);
});
