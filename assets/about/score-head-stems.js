export function noteHeadStemPairs(study,notes){
  return notes.map(note=>{
    const glyph=study.pdfGlyphs.find(item=>item.noteId===note.id);
    if(!glyph)throw new Error('Missing note head '+note.id);
    const stems=study.pdfDrawings.filter(d=>d.maxX-d.minX<.1)
      .flatMap(d=>d.commands.filter(c=>c.kind==='l'&&Math.abs(c.points[0][1]-c.points[1][1])>2).map(c=>({drawing:d,points:c.points})));
    let best=null;
    for(const stem of stems)for(let i=0;i<2;i++){
      const contact=stem.points[i],end=stem.points[1-i];
      const distance=Math.hypot(contact[0]-glyph.x,contact[1]-glyph.y);
      if(distance<3.5&&(!best||distance<best.distance))best={distance,contact,end,width:stem.drawing.width};
    }
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
