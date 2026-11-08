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

test('one compound item fades by local pixel depth; gold and foreground heads retain full ink',()=>{
  let result;
  const context={canvas:{width:4,height:1},createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},clearRect(){},
    getImageData(x,y,w,h){const image=this.createImageData(w,h);for(let i=0;i<image.data.length;i+=4)image.data.set([200,180,220,255],i);return image;},putImageData(image){result=image;}};
  const item={depth:-100,depthAt(x){return x<1?-8:-12;},paint(){},protectedHeads:[
    {bounds:{x0:0,y0:0,x1:1,y1:1},depth:-8,marker:false},
    {bounds:{x0:3,y0:0,x1:4,y1:1},depth:-12,marker:true}
  ]};
  paintDepthQueue(context,[item],[],4,1,{fade:true,focusDistance:2});
  const pixel=x=>[...result.data.slice(x*4,x*4+4)];
  assert.deepEqual(pixel(0),[200,180,220,255]);
  assert.ok(pixel(1)[0]<100);
  assert.deepEqual(pixel(3),[200,180,220,255]);
});

test('non-finite off-camera bounds are skipped before Canvas readback',()=>{
  let painted=false,readbacks=0;
  const context={canvas:{width:4,height:4},createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},clearRect(){},
    getImageData(){readbacks++;throw new Error('invalid Canvas readback');},putImageData(){}};
  paintDepthQueue(context,[{bounds:{x0:NaN,y0:0,x1:1,y1:1},depth:-10,paint(){painted=true;}}],[],4,4);
  assert.equal(painted,false);
  assert.equal(readbacks,0);
});
