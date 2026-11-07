/** Exact nearest-segment query; boxes only reject segments that cannot beat the current result. */
export function indexSegments(points){
  const count=points.length-1,stride=10,data=new Float64Array(count*stride);
  for(let i=0;i<count;i++){
    const a=points[i],b=points[i+1],o=i*stride;
    data.set([a.x,a.y,b.x-a.x,b.y-a.y,a.depth,b.depth-a.depth,a.u,b.u-a.u,Math.min(a.x,b.x),Math.min(a.y,b.y)],o);
  }
  function build(ids){
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const i of ids){const o=i*stride;x0=Math.min(x0,data[o+8]);y0=Math.min(y0,data[o+9]);x1=Math.max(x1,data[o],data[o]+data[o+2]);y1=Math.max(y1,data[o+1],data[o+1]+data[o+3]);}
    if(ids.length<=6)return{x0,y0,x1,y1,ids};
    const axis=x1-x0>y1-y0?0:1;
    ids.sort((a,b)=>data[a*stride+axis]+data[a*stride+axis+2]/2-data[b*stride+axis]-data[b*stride+axis+2]/2);
    const middle=ids.length>>1;
    return{x0,y0,x1,y1,left:build(ids.slice(0,middle)),right:build(ids.slice(middle))};
  }
  const root=build(Array.from({length:count},(_,i)=>i));
  return (x,y)=>{
    let best=Infinity,bestIndex=Infinity,result;
    const distance=node=>Math.max(node.x0-x,0,x-node.x1)**2+Math.max(node.y0-y,0,y-node.y1)**2;
    const visit=node=>{
      if(distance(node)>best+1e-9)return;
      if(node.ids){
        for(const i of node.ids){const o=i*stride,ax=data[o],ay=data[o+1],dx=data[o+2],dy=data[o+3];
          const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
          const d=(x-ax-dx*t)**2+(y-ay-dy*t)**2;
          if(d<best||d===best&&i<bestIndex){best=d;bestIndex=i;result={depth:data[o+4]+data[o+5]*t,u:data[o+6]+data[o+7]*t};}
        }
      }else{
        const near=distance(node.left)<=distance(node.right)?node.left:node.right;
        visit(near);visit(near===node.left?node.right:node.left);
      }
    };
    visit(root);return result;
  };
}
