import { createTravelProjector, viewportStaffScale } from './score-travel-geometry.js?v=staff-scale-1';

export function projectedHeadWidth({width,height,score,pose,view,anchor,headWidth,zoom}, scratch = {}) {
  const project = createTravelProjector(width,height,score,pose,view,.2,true,scratch,zoom);
  const middle = (score.staffLines[0]+score.staffLines.at(-1))/2;
  const staffScale = viewportStaffScale(width, zoom, pose);
  const point = project(anchor.u,middle+(anchor.v-middle)*staffScale);
  return point.depth>=0 ? Infinity : headWidth*point.scale*staffScale;
}

/** Fit one engraved head in CSS pixels; its UV and every connected piece stay intact. */
export function fitCloseZoom(options, targetWidth = 28, scratch = {}) {
  let low=.55, high=6;
  for(let step=0;step<16;step++) {
    const zoom=(low+high)/2;
    const width=projectedHeadWidth({...options,zoom},scratch);
    if(width<targetWidth) low=zoom; else high=zoom;
  }
  return (low+high)/2;
}

export function maximumProjectedHeadWidth({width,height,score,pose,view,headWidth,zoom}, scratch={}) {
  const project=createTravelProjector(width,height,score,pose,view,.2,true,scratch,zoom);
  const middle=(score.staffLines[0]+score.staffLines.at(-1))/2;
  const staffScale=viewportStaffScale(width, zoom, pose);
  let maximum=0;
  for(let sample=0;sample<=32;sample++) for(const v of [-14,8]) {
    const point=project(view.x0+(view.x1-view.x0)*sample/32,middle+(v-middle)*staffScale);
    if(point.depth>=-width*.015)return Infinity;
    maximum=Math.max(maximum,headWidth*point.scale*staffScale);
  }
  return maximum;
}

/** Keep the whole visible strip in front of the near plane, including the other branch. */
export function limitCloseZoom(options, maxHeadWidth=90, scratch={}) {
  if(maximumProjectedHeadWidth(options,scratch)<=maxHeadWidth)return options.zoom;
  let low=.10,high=options.zoom;
  for(let step=0;step<16;step++) {
    const zoom=(low+high)/2;
    if(maximumProjectedHeadWidth({...options,zoom},scratch)>maxHeadWidth)high=zoom;else low=zoom;
  }
  return low;
}
