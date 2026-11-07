const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/(n||1));};
const controls=[[-.8,.2,.6],[-.8,.2,.6],[-.2,.35,.4],[.8,.3,-.7],[.8,-.3,-.9],[-.4,-.5,0],[-.6,.15,.8],[.2,.4,.9],[.9,-.02,-.5],[1.5,-.12,-.65],[2,-.12,-.65],[3,-.12,-.65],[4,-.12,-.65],[5,-.12,-.65],[6,-.12,-.65],[6,-.12,-.65]];
function curve(t){
  const v=Math.min(controls.length-3-1e-10,t*(controls.length-3));
  const i=Math.floor(v),u=v-i;
  const b=[(1-u)**3/6,(3*u**3-6*u*u+4)/6,(-3*u**3+3*u*u+3*u+1)/6,u**3/6];
  return [0,1,2].map(axis=>b.reduce((sum,w,j)=>sum+w*controls[i+j][axis],0));
}
export function createTravelProjector(width,height,study,progress,view=study,minimumDistance=.2){
  const p=Math.max(0,Math.min(1,progress));
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
  const length=samples.at(-1).distance;
  function at(distance){
    let lo=0,hi=1200;
    while(hi-lo>1){const m=(lo+hi)>>1;if(samples[m].distance<distance)lo=m;else hi=m;}
    const a=samples[lo],b=samples[hi],t=(distance-a.distance)/(b.distance-a.distance);
    return {position:a.position.map((v,i)=>v+(b.position[i]-v)*t),normal:norm(a.normal.map((v,i)=>v+(b.normal[i]-v)*t))};
  }
  const start=p*.65*length,span=(.6-.35*p)*length;
  const visible=Array.from({length:101},(_,i)=>at(start+span*i/100).position);
  const center=[0,1,2].map(axis=>(Math.min(...visible.map(v=>v[axis]))+Math.max(...visible.map(v=>v[axis])))/2);
  const zoomOut=Math.max(0,Math.min(1,(p-.6)/.4));
  const zoomEase=zoomOut*zoomOut*(3-2*zoomOut);
  const focal=width*1.45,distance=focal*span/(width*.94)*(minimumDistance+(1-minimumDistance)*zoomEase);
  const target=[...center];
  const orbit=Math.sin(Math.PI*p);
  const position=[target[0]+Math.sin(p*Math.PI*2)*distance*.15*orbit,target[1]-distance*.08*orbit,target[2]+distance];
  const forward=norm(sub(target,position)),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward));
  const arrive=Math.max(0,Math.min(1,(p-.65)/.2));
  const unit=(width*1.5*(1-arrive)+span*arrive)/(view.x1-view.x0),middle=(study.staffLines[0]+study.staffLines.at(-1))/2;
  const project=(x,y)=>{
    const u=(x-view.x0)/(view.x1-view.x0);
    const frame=at(start+Math.max(0,Math.min(1,u))*span);
    const point=frame.position.map((v,i)=>v+frame.normal[i]*(y-middle)*unit);
    const rel=sub(point,position),z=dot(rel,forward),perspective=focal/z;
    return{x:width/2+dot(rel,right)*perspective,y:height/2+dot(rel,up)*perspective,depth:-z,perspective,scale:unit*perspective,u};
  };
  project.samples=samples;project.arcLength=span;project.uvAspect=unit*(view.x1-view.x0)/span;project.camera={position,target,forward};
  return project;
}
