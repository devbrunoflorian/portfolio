import { polygonBounds, quadTriangles } from './score-occlusion.js';
import {indexSegments} from './score-segment-index.js';
export const HALO_HALF_WIDTH=6.5;

export function staffInk(project, view, y, thickness, divisions = 280) {
  const upper = [], lower = [];
  for (let i = 0; i <= divisions; i++) {
    const u = view.x0 + (view.x1 - view.x0) * i / divisions;
    upper.push(project(u, y - thickness / 2));
    lower.push(project(u, y + thickness / 2));
  }
  return { points: [...upper, ...lower.toReversed()],
    depthTriangles: upper.slice(1).flatMap((p, i) => quadTriangles([upper[i], p, lower[i + 1], lower[i]])) };
}

export function enqueueStaffLine(queue, context, project, view, y, thickness, indexed=false) {
  const { points, depthTriangles } = staffInk(project, view, y, thickness);
  const center=Array.from({length:281},(_,i)=>project(view.x0+(view.x1-view.x0)*i/280,y));
  const lookup=indexed?indexSegments(center):null;
  queue.push({ kind: 'staff-line', bounds: polygonBounds(points), depthTriangles, range: [0, 1],
    sampleAt(x,y){
      if(lookup)return lookup(x,y);
      let best=Infinity,result;
      for(let i=0;i<center.length-1;i++){
        const a=center[i],b=center[i+1],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
        const distance=(x-a.x-dx*t)**2+(y-a.y-dy*t)**2;
        if(distance<best){best=distance;result={depth:a.depth+(b.depth-a.depth)*t,u:a.u+(b.u-a.u)*t};}
      }
      return result;
    },
    depth: project((view.x0 + view.x1) / 2, y).depth, paint() {
      context.beginPath();
      points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
      context.closePath(); context.fillStyle = '#cfc2e2'; context.fill();
    } });
}
