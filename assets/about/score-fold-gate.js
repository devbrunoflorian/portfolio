import { scoreRibbonData } from './score-ribbon-data.js';
import { scoreRibbonTimeline as score } from './score-ribbon-timeline.js';
import { createProjector } from './score-ribbon-geometry.js?v=gate-depth-2';

document.querySelector('.about-main').hidden = true;
const page = document.createElement('main');
page.className = 'fold-gate';
page.innerHTML = `<h1>Fita musical · passo 2a</h1>
<p>Guitarra, compassos 31–33. Pontos presos à mesma superfície das cinco linhas. O dourado acompanha <strong>guitar-33-4-1</strong> na ida e na volta.</p>
<label><input type="checkbox" checked> Mostrar os pontos das notas</label>
<p data-gate-check></p><div class="fold-gate-poses"></div>
<h2>Descida e subida · dez quadros intermediários</h2>
<p>As extremidades 0% e 100% completam cada sequência. A nota dourada conserva o mesmo ID, pitch e X editorial.</p>
<div class="fold-gate-film"></div>
<h2>Conferência das alturas</h2>
<p>Linhas suplementares acompanham os pontos abaixo da pauta. O compasso 32 tem zero ataques de guitarra no recorte.</p>
<table><thead><tr><th>Nota real</th><th>Pitch escrito</th><th>Posição relativa à linha inferior</th></tr></thead><tbody></tbody></table>
<a href="?score-ribbon=transition#music">Voltar ao About</a>`;
document.querySelector('.about-main').after(page);
const style = document.createElement('style');
style.textContent = `
.about-main[hidden]{display:none!important}
.fold-gate{max-width:1200px;margin:105px auto 80px;padding:0 28px;color:#e9e5f0;font:16px/1.6 Inter,system-ui,sans-serif}
.fold-gate h1{font-size:36px;color:#c19aff}.fold-gate h2{margin-top:42px;font-size:24px}
.fold-gate p{max-width:850px;color:#bcb4c9}.fold-gate label{display:flex;gap:12px;align-items:center;min-height:44px}
.fold-gate-poses,.fold-gate-film{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:25px 0}
.fold-gate figure{margin:0;border:1px solid #383044;background:#08080e;border-radius:8px;overflow:hidden}
.fold-gate figcaption{padding:12px 16px;color:#cfb7ec;font-size:14px}
.fold-gate canvas{display:block;width:100%;aspect-ratio:1.8}
.fold-gate a{color:#c19aff}.fold-gate table{width:100%;border-collapse:collapse;font-size:14px}
.fold-gate td,.fold-gate th{text-align:left;padding:8px;border-bottom:1px solid #302639}
@media(max-width:700px){.fold-gate-poses,.fold-gate-film{grid-template-columns:1fr}.fold-gate{padding:0 16px}}
`;
document.head.append(style);
const view = { x0: score.bars[30].xStart, x1: score.bars[32].xEnd };
const steps = [0,0,1,1,2,3,3,4,4,5,5,6];
const glyphs = new Map(score.pdfGlyphs.filter(g => g.noteId).map(g => [g.noteId,g]));
const heads = scoreRibbonData.systems.flatMap(system => system.heads).filter(h=>h.bar>=31&&h.bar<=33);
const points = heads.map(head=>({
  id:head.id, bar:head.bar, midi:head.writtenMidi, x:glyphs.get(head.id).x,
  y:-((Math.floor(head.writtenMidi/12)-1)*7+steps[head.writtenMidi%12]-30),
}));
const markerId = 'guitar-33-4-1';
const empty32 = points.filter(point=>point.bar===32).length;
if(empty32!==0 || points.some(p=>!Number.isInteger(p.y))) throw new Error('Invalid source grid.');
page.querySelector('[data-gate-check]').textContent = `${points.length} pontos reais · compasso 32: ${empty32} ataques · mesma projeção em todos os quadros.`;
for(const p of points){
  const row=document.createElement('tr');
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const pitch=names[p.midi%12]+(Math.floor(p.midi/12)-1);
  const position=p.y>0 ? `${p.y} meios espaços abaixo · ${Math.floor(p.y/2)} linha(s) suplementar(es)` : p.y===0 ? 'Linha inferior (E4)' : `${-p.y} meios espaços acima`;
  for(const value of [p.id,pitch,position]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  page.querySelector('tbody').append(row);
}
const frames=[];
function addFrame(container,pose,label){
  const figure=document.createElement('figure');
  const caption=document.createElement('figcaption');
  caption.textContent=label;
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label',label+' · '+markerId);
  figure.append(caption,canvas);container.append(figure);frames.push({canvas,pose});
}
[0,.35,.6,1].forEach((p,i)=>addFrame(page.querySelector('.fold-gate-poses'),p,
  `${Math.round(p*100)}% · ${['Entrada pela borda','Retorno','Passagem próxima','Music frontal'][i]}`));
for(let i=0;i<12;i++){
  addFrame(page.querySelector('.fold-gate-film'),i/11,`↓ ${(i/11*100).toFixed(1)}% · ${markerId}`);
  addFrame(page.querySelector('.fold-gate-film'),1-i/11,`↑ ${((1-i/11)*100).toFixed(1)}% · ${markerId}`);
}
function renderFrame(canvas,pose){
  const width=canvas.clientWidth,height=width/1.8;
  canvas.width=Math.round(width*2);canvas.height=Math.round(height*2);
  const ctx=canvas.getContext('2d');ctx.scale(2,2);
  const project=createProjector(width,height,score,pose,view);
  const queue=[];
  const divisions=280;
  function stroke(a,b,color,thickness,depthBias=0){
    queue.push({depth:(a.depth+b.depth)/2+depthBias,paint(){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.stroke();
    }});
  }
  for(let i=0;i<divisions;i++){
    const x0=view.x0+(view.x1-view.x0)*i/divisions;
    const x1=view.x0+(view.x1-view.x0)*(i+1)/divisions;
    const a=project(x0,-8.6),b=project(x1,-8.6),c=project(x1,.6),d=project(x0,.6);
    const depth=project((x0+x1)/2,-4).depth;
    // Opaque surface hides the far staff where the near staff crosses it.
    queue.push({depth:depth-25,paint(){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
      ctx.fillStyle='#08080e';ctx.fill();
    }});
    for(const y of score.staffLines){
      const p=project(x0,y),q=project(x1,y);
      const shade=Math.max(.3,Math.min(1,(p.perspective-.4)/.9));
      stroke(p,q,`rgb(${Math.round(110+shade*110)} ${Math.round(107+shade*100)} ${Math.round(137+shade*102)})`,Math.max(.65,p.perspective*1.2),.15);
    }
  }
  const edges=[score.bars[30].xStart,...score.bars.slice(30,33).map(b=>b.xEnd)];
  for(const x of edges)for(let y=-8;y<0;y+=.25){
    const a=project(x,y),b=project(x,y+.25);stroke(a,b,'#d5c6e8',Math.max(.75,a.perspective*1.4),.2);
  }
  for(const bar of score.bars.slice(30,33)){
    const p=project((bar.xStart+bar.xEnd)/2,-10);
    queue.push({depth:p.depth+.3,paint(){ctx.font='12px system-ui';ctx.fillStyle='#c6afd9';ctx.fillText(bar.number===32?'32 · vazio':String(bar.number),p.x,p.y);}});
  }
  if(page.querySelector('input').checked)for(const note of points){
    const p=project(note.x,note.y);
    for(let y=2;y<=note.y;y+=2)stroke(project(note.x-1.6,y),project(note.x+1.6,y),'#b8accb',Math.max(.8,p.perspective),.25);
    const radius=Math.max(1.3,4.6*p.perspective);
    queue.push({depth:project(note.x,-4).depth+25,paint(){
      ctx.beginPath();ctx.arc(p.x,p.y,radius+1.1,0,Math.PI*2);ctx.fillStyle='#08080e';ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fillStyle=note.id===markerId?'#ffdc83':'#70a8ff';ctx.fill();
      if(note.id===markerId){ctx.beginPath();ctx.arc(p.x,p.y,radius+3,0,Math.PI*2);ctx.lineWidth=1;ctx.strokeStyle='#ffdc83';ctx.stroke();}
    }});
  }
  queue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint());
  canvas.dataset.pose=String(pose);
}
function draw(){for(const frame of frames)renderFrame(frame.canvas,frame.pose);}
const observer=new ResizeObserver(draw);
observer.observe(page.querySelector('.fold-gate-poses'));
page.querySelector('input').addEventListener('change',draw);
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
draw();
