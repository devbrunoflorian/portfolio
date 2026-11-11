import {focusWeights,FOCUS_RADII} from './score-focus-profile.js';

let support;
export function filterSupport(){
  if(support)return support;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
  const ctx=canvas.getContext('2d');
  ctx.filter='blur(2px)';ctx.fillRect(10,10,4,4);
  const canvasFilter=ctx.filter==='blur(2px)'&&ctx.getImageData(8,11,1,1).data[3]>0;
  return support={canvasFilter,cssFilter:CSS.supports('filter','blur(2px)'),cssAdd:CSS.supports('mix-blend-mode','plus-lighter')};
}

export function clearFocusLayers(canvas){
  canvas.parentElement.querySelectorAll('[data-focus-layer]').forEach(layer=>layer.remove());
}

/** Split already depth-tested coverage, retaining one compound object in the scene queue. */
export function applyFocusLayers(canvas,snapshot,cssWidth,focusDistance,backend='auto',profile=null){
  let end=profile?.start('focusLayers');
  clearFocusLayers(canvas);
  const capabilities=filterSupport();
  const selected=backend==='css'?'css':capabilities.canvasFilter?'canvas':'css';
  if(selected==='css'&&(!capabilities.cssFilter||!capabilities.cssAdd)){end?.();return 'unsupported';}
  const {image,coverage,depth,sharp}=snapshot;
  const layers=FOCUS_RADII.map(()=>{
    const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
    return {canvas:layer,context:layer.getContext('2d'),image:new ImageData(canvas.width,canvas.height)};
  });
  const background=[6,6,9];
  for(let i=0;i<coverage.length;i++){
    const alpha=coverage[i];if(!alpha)continue;
    const weights=focusWeights(depth[i],cssWidth,focusDistance,sharp[i]===1);
    for(let band=0;band<layers.length;band++){
      if(!weights[band])continue;
      const target=layers[band].image.data,offset=i*4;
      for(let c=0;c<3;c++)target[offset+c]=(image.data[offset+c]-background[c]*(1-alpha))/alpha;
      target[offset+3]=Math.round(alpha*weights[band]*255);
    }
  }
  layers.forEach(layer=>layer.context.putImageData(layer.image,0,0));
  end?.();end=profile?.start('composition');
  const ctx=canvas.getContext('2d');ctx.save();ctx.resetTransform();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(selected==='canvas'){
    ctx.globalCompositeOperation='lighter';
    for(let i=layers.length-1;i>=0;i--){
      ctx.filter=`blur(${FOCUS_RADII[i]*canvas.width/cssWidth}px)`;
      const finish=profile?.start(FOCUS_RADII[i]?'blurSubmit':'composition');
      ctx.drawImage(layers[i].canvas,0,0);
      finish?.();
    }
    ctx.filter='none';ctx.globalCompositeOperation='destination-over';
    ctx.fillStyle='#060609';ctx.fillRect(0,0,canvas.width,canvas.height);
  }else{
    ctx.fillStyle='#060609';ctx.fillRect(0,0,canvas.width,canvas.height);
    const parent=canvas.parentElement;parent.style.position='relative';parent.style.isolation='isolate';
    for(let i=layers.length-1;i>=0;i--){
      const layer=layers[i].canvas;layer.dataset.focusLayer=String(i);
      layer.setAttribute('aria-hidden','true');
      Object.assign(layer.style,{position:'absolute',left:`${canvas.offsetLeft}px`,top:`${canvas.offsetTop}px`,width:`${canvas.clientWidth}px`,height:`${canvas.clientHeight}px`,background:'transparent',border:'0',pointerEvents:'none',filter:`blur(${FOCUS_RADII[i]}px)`,mixBlendMode:'plus-lighter'});
      parent.append(layer);
    }
  }
  ctx.restore();end?.();return selected;
}
