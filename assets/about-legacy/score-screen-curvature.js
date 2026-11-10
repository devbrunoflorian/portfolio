export const SCREEN_CURVATURE_LIMIT = .12;
export function measureScreenCurvature(project,view,staffLines,divisions=1000){
  let maximum=0,at=null;
  for(const y of staffLines){
    const points=Array.from({length:divisions+1},(_,i)=>project(view.x0+(view.x1-view.x0)*i/divisions,y));
    for(let i=1;i<divisions;i++){
      const a=points[i-1],b=points[i],c=points[i+1];
      const vx=b.x-a.x,vy=b.y-a.y,wx=c.x-b.x,wy=c.y-b.y;
      const l=Math.hypot(vx,vy),r=Math.hypot(wx,wy);
      const curvature=2*Math.abs(vx*wy-vy*wx)/(l*r*Math.hypot(c.x-a.x,c.y-a.y));
      if(!Number.isFinite(curvature))return {maximum:Infinity,at:{u:i/divisions,y}};
      if(curvature>maximum){maximum=curvature;at={u:i/divisions,y};}
    }
  }
  return {maximum,at};
}
