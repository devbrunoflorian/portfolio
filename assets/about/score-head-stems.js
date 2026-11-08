const sourceIndex=new WeakMap();

function indexSource(study){
  if(sourceIndex.has(study))return sourceIndex.get(study);
  const glyphs=new Map(study.pdfGlyphs.filter(item=>item.noteId).map(item=>[item.noteId,item]));
  const stems=study.pdfDrawings.filter(d=>d.maxX-d.minX<.1)
    .flatMap(d=>d.commands.filter(c=>c.kind==='l'&&Math.abs(c.points[0][1]-c.points[1][1])>2)
      .map(c=>({drawing:d,points:c.points})));
  const index={glyphs,stems};sourceIndex.set(study,index);return index;
}

export function noteHeadStemPairs(study,notes){
  const {glyphs,stems}=indexSource(study);
  return notes.map(note=>{
    const glyph=glyphs.get(note.id);
    if(!glyph)throw new Error('Missing note head '+note.id);
    let best=null;
    for(const stem of stems)for(let i=0;i<2;i++){
      const contact=stem.points[i],end=stem.points[1-i];
      const distance=Math.hypot(contact[0]-glyph.x,contact[1]-glyph.y);
      if(distance<3.5&&(!best||distance<best.distance))best={distance,contact,end,width:stem.drawing.width};
    }
    // Chord stems can pass beside several noteheads without ending at each one.
    // Keep the existing endpoint match for ordinary notes, then use the closest
    // point on a nearby source stem only when endpoint matching found nothing.
    if(!best&&glyph.text!=='=')for(const stem of stems){
      const [a,b]=stem.points;
      const dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,Math.abs(dy)<1e-6?0:(glyph.y-a[1])/dy));
      const contact=[a[0]+(b[0]-a[0])*t,a[1]+dy*t];
      const distance=Math.hypot(contact[0]-glyph.x,contact[1]-glyph.y);
      if(distance<3.5&&(!best||distance<best.distance)){
        const end=Math.hypot(a[0]-glyph.x,a[1]-glyph.y)>Math.hypot(b[0]-glyph.x,b[1]-glyph.y)?a:b;
        best={distance,contact,end,width:stem.drawing.width};
      }
    }
    // Open whole-note heads in the source PDF have no stem by design.
    if(!best&&glyph.text==='=')return {note,glyph,stem:null};
    if(!best)throw new Error('Missing source stem '+note.id);
    return {note,glyph,stem:best};
  });
}
export function projectHeadStem(pair,project){
  const head=project(pair.note.x,pair.note.y);
  const contact={x:head.x+(pair.stem.contact[0]-pair.glyph.x)*head.scale,
    y:head.y+(pair.stem.contact[1]-pair.glyph.y)*head.scale};
  return {head,contact,end:{x:contact.x,y:contact.y+(pair.stem.end[1]-pair.stem.contact[1])*head.scale}};
}
