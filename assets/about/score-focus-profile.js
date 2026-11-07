export const DEPTH_BANDS={clearance:.04,farOffset:.7,farOpacity:.32,farBrightness:.72,farSaturation:.2};
export const FOCUS_RADII=[0,.8,1.6,2.8];

export function readingFocus(project,view,width,height,marker,pose){
  const visible=[];
  for(let i=0;i<=280;i++){
    const point=project(view.x0+(view.x1-view.x0)*i/280,-4);
    if(point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height)visible.push(-point.depth/width);
  }
  const closest=Math.min(...visible),gold=project(marker.x,marker.y);
  const goldVisible=gold.x>=0&&gold.x<=width&&gold.y>=0&&gold.y<=height;
  return {distance:Math.max(Number.isFinite(closest)?closest:0,goldVisible?-gold.depth/width:0),fade:pose<.4,blur:pose<.85};
}

export function depthAppearance(depth,width,focusDistance=0){
  const t=Math.max(0,Math.min(1,(-depth/width-focusDistance-DEPTH_BANDS.clearance)/(DEPTH_BANDS.farOffset-DEPTH_BANDS.clearance)));
  const ease=t*t*(3-2*t);
  return {opacity:1+(DEPTH_BANDS.farOpacity-1)*ease,brightness:1+(DEPTH_BANDS.farBrightness-1)*ease,saturation:1+(DEPTH_BANDS.farSaturation-1)*ease};
}

export function focusWeights(depth,width,focusDistance,protectedInk=false){
  const offset=-depth/width-focusDistance;
  if(protectedInk||offset<=.05)return [1,0,0,0];
  const level=Math.max(0,Math.min(3,(offset-.05)/.2));
  const low=Math.floor(level),high=Math.min(3,low+1),weights=[0,0,0,0];
  weights[low]=1-(level-low);weights[high]+=level-low;
  return weights;
}
