const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/(n||1));};
const WORLD_UP=[0,1,0];
const controls=[[-.8,.2,.6],[-.8,.2,.6],[-.2,.35,.4],[.8,.3,-.7],[.8,-.3,-.9],[-.4,-.5,0],[-.6,.15,.8],[.2,.4,.9],[.9,-.02,-.5],[1.5,-.12,-.65],[2,-.12,-.65],[3,-.12,-.65],[4,-.12,-.65],[5,-.12,-.65],[6,-.12,-.65],[6,-.12,-.65]];
function curve(t){
  const v=Math.min(controls.length-3-1e-10,t*(controls.length-3));
  const i=Math.floor(v),u=v-i;
  const b=[(1-u)**3/6,(3*u**3-6*u*u+4)/6,(-3*u**3+3*u*u+3*u+1)/6,u**3/6];
  return [0,1,2].map(axis=>b.reduce((sum,w,j)=>sum+w*controls[i+j][axis],0));
}
const worldCache=new Map();
function ribbonSamples(width,height,cache){
  const key=`${width}:${height}`;
  if(cache&&worldCache.has(key))return worldCache.get(key);
  const samples=Array.from({length:1201},(_,i)=>({position:curve(i/1200).map((v,axis)=>v*(axis===1?height:width)),distance:0}));
  let normal=[0,1,0],last=norm(sub(samples[1].position,samples[0].position));
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    if(i)s.distance=samples[i-1].distance+Math.hypot(...sub(s.position,samples[i-1].position));
    const tangent=norm(sub(samples[Math.min(i+1,1200)].position,samples[Math.max(i-1,0)].position));
    const axis=cross(last,tangent),first=cross(axis,normal),second=cross(axis,first);
    normal=norm(normal.map((v,j)=>v+first[j]+second[j]/Math.max(.00001,1+dot(last,tangent))));
    const straighten=Math.max(0,Math.min(1,(s.position[0]/width-1.3)/.8));
    const ease=straighten*straighten*(3-2*straighten);
    const upright=norm([0,1,0].map((v,j)=>v-tangent[j]*tangent[1]));
    s.normal=norm(normal.map((v,j)=>v*(1-ease)+upright[j]*ease));last=tangent;
  }
  const positions=new Float64Array(samples.length*3),normals=new Float64Array(samples.length*3),distances=new Float64Array(samples.length);
  samples.forEach((s,i)=>{positions.set(s.position,i*3);normals.set(s.normal,i*3);distances[i]=s.distance;});
  const world={samples,positions,normals,distances,length:samples.at(-1).distance};
  if(worldCache.size>=8)worldCache.delete(worldCache.keys().next().value);
  if(cache)worldCache.set(key,world);return world;
}
export function createTravelProjector(width,height,study,progress,view=study,minimumDistance=.2,cache=true,scratch=null){
  const p=Math.max(0,Math.min(1,progress));
  const {samples,positions,normals,distances,length}=ribbonSamples(width,height,cache);
  const reuse=scratch!==null;
  const framePosition=reuse?(scratch.framePosition??=new Float64Array(3)):null;
  const frameNormal=reuse?(scratch.frameNormal??=new Float64Array(3)):null;
  const normalWork=reuse?(scratch.normalWork??=new Float64Array(3)):null;
  const center=reuse?(scratch.center??=new Float64Array(3)):new Float64Array(3);
  const minimum=reuse?(scratch.minimum??=new Float64Array(3)):null;
  const maximum=reuse?(scratch.maximum??=new Float64Array(3)):null;
  const cameraPosition=reuse?(scratch.cameraPosition??=new Float64Array(3)):null;
  const forward=reuse?(scratch.forward??=new Float64Array(3)):null;
  const right=reuse?(scratch.right??=new Float64Array(3)):null;
  const up=reuse?(scratch.up??=new Float64Array(3)):null;
  const worldPoint=reuse?(scratch.worldPoint??=new Float64Array(3)):null;
  const relative=reuse?(scratch.relative??=new Float64Array(3)):null;
  const frame=reuse?(scratch.frame??={position:framePosition,normal:frameNormal}):null;
  const camera=reuse?(scratch.camera??={position:cameraPosition,target:center,forward}):null;
  const projected=reuse?(scratch.projected??={}):null;
  function normalizeInto(source,target){
    const magnitude=Math.hypot(source[0],source[1],source[2])||1;
    target[0]=source[0]/magnitude;target[1]=source[1]/magnitude;target[2]=source[2]/magnitude;
    return target;
  }
  function crossInto(a,b,target){
    target[0]=a[1]*b[2]-a[2]*b[1];target[1]=a[2]*b[0]-a[0]*b[2];target[2]=a[0]*b[1]-a[1]*b[0];
    return target;
  }
  function at(distance){
    let lo=0,hi=1200;
    while(hi-lo>1){const m=(lo+hi)>>1;if(distances[m]<distance)lo=m;else hi=m;}
    const t=(distance-distances[lo])/(distances[hi]-distances[lo]);
    if(reuse){
      for(let i=0;i<3;i++){
        framePosition[i]=positions[lo*3+i]+(positions[hi*3+i]-positions[lo*3+i])*t;
        normalWork[i]=normals[lo*3+i]+(normals[hi*3+i]-normals[lo*3+i])*t;
      }
      normalizeInto(normalWork,frameNormal);
      return frame;
    }
    return {position:[0,1,2].map(i=>positions[lo*3+i]+(positions[hi*3+i]-positions[lo*3+i])*t),normal:norm([0,1,2].map(i=>normals[lo*3+i]+(normals[hi*3+i]-normals[lo*3+i])*t))};
  }
  const start=p*.65*length,span=(.6-.35*p)*length;
  if(reuse){
    minimum.fill(Infinity);maximum.fill(-Infinity);
    for(let i=0;i<=100;i++){
      const position=at(start+span*i/100).position;
      for(let axis=0;axis<3;axis++){minimum[axis]=Math.min(minimum[axis],position[axis]);maximum[axis]=Math.max(maximum[axis],position[axis]);}
    }
    for(let axis=0;axis<3;axis++)center[axis]=(minimum[axis]+maximum[axis])/2;
  }else{
    const visible=Array.from({length:101},(_,i)=>at(start+span*i/100).position);
    for(let axis=0;axis<3;axis++)center[axis]=(Math.min(...visible.map(v=>v[axis]))+Math.max(...visible.map(v=>v[axis])))/2;
  }
  const zoomOut=Math.max(0,Math.min(1,(p-.6)/.4));
  const zoomEase=zoomOut*zoomOut*(3-2*zoomOut);
  const focal=width*1.45,distance=focal*span/(width*.94)*(minimumDistance+(1-minimumDistance)*zoomEase);
  const orbit=Math.sin(Math.PI*p);
  if(reuse){
    cameraPosition[0]=center[0]+Math.sin(p*Math.PI*2)*distance*.15*orbit;
    cameraPosition[1]=center[1]-distance*.08*orbit;cameraPosition[2]=center[2]+distance;
    for(let i=0;i<3;i++)normalWork[i]=center[i]-cameraPosition[i];
    normalizeInto(normalWork,forward);normalizeInto(crossInto(forward,WORLD_UP,normalWork),right);
    normalizeInto(crossInto(right,forward,normalWork),up);
  }
  const position=reuse?cameraPosition:[center[0]+Math.sin(p*Math.PI*2)*distance*.15*orbit,center[1]-distance*.08*orbit,center[2]+distance];
  const cameraForward=reuse?forward:norm(sub(center,position));
  const cameraRight=reuse?right:norm(cross(cameraForward,[0,1,0]));
  const cameraUp=reuse?up:norm(cross(cameraRight,cameraForward));
  const arrive=Math.max(0,Math.min(1,(p-.65)/.2));
  const unit=(width*1.5*(1-arrive)+span*arrive)/(view.x1-view.x0),middle=(study.staffLines[0]+study.staffLines.at(-1))/2;
  const project=(x,y)=>{
    const u=(x-view.x0)/(view.x1-view.x0);
    const sample=at(start+Math.max(0,Math.min(1,u))*span);
    const vertical=(y-middle)*unit;
    let xCamera=0,yCamera=0,z=0;
    if(reuse){
      for(let i=0;i<3;i++){
        worldPoint[i]=sample.position[i]+sample.normal[i]*vertical;
        relative[i]=worldPoint[i]-position[i];
      }
      xCamera=dot(relative,cameraRight);yCamera=dot(relative,cameraUp);z=dot(relative,cameraForward);
    }else{
      const point=sample.position.map((v,i)=>v+sample.normal[i]*vertical),rel=sub(point,position);
      xCamera=dot(rel,cameraRight);yCamera=dot(rel,cameraUp);z=dot(rel,cameraForward);
    }
    const perspective=focal/z;
    const result=reuse?projected:{};
    result.x=width/2+xCamera*perspective;result.y=height/2+yCamera*perspective;
    result.depth=-z;result.perspective=perspective;result.scale=unit*perspective;result.u=u;
    return result;
  };
  project.samples=samples;project.arcLength=span;project.uvAspect=unit*(view.x1-view.x0)/span;
  if(reuse){camera.target=center;camera.forward=forward;project.camera=camera;}
  else project.camera={position,target:center,forward:cameraForward};
  return project;
}
