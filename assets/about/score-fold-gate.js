import { scoreRibbonData } from './score-ribbon-data.js';
import { scoreRibbonTimeline as score } from './score-ribbon-timeline.js';
import { createProjector } from './score-ribbon-geometry.js';

const root = document.querySelector('.about-main');
root.hidden = true;
const page = document.createElement('main');
page.className = 'fold-gate';
page.innerHTML = `<h1>Fita musical · passo 2a</h1>
  <p>Guitarra real, compassos 31–33. Cinco linhas e barras compartilham o projetor dos pontos. O compasso 32 contém a pausa inteira.</p>
  <label><input type="checkbox" checked> Mostrar os pontos das notas</label>
  <p data-gate-check></p><div class="fold-gate-poses"></div>
  <a href="?score-ribbon=transition#music">Voltar ao About</a>`;
root.after(page);
const style = document.createElement('style');
style.textContent = `.fold-gate{max-width:1200px;margin:110px auto 80px;padding:0 28px;color:#e9e5f0;font:16px/1.6 Inter,system-ui,sans-serif}.fold-gate h1{font-size:38px;color:#c19aff}.fold-gate p{max-width:760px;color:#bcb4c9}.fold-gate label{display:flex;gap:12px;align-items:center;min-height:44px}.fold-gate-poses{display:grid;gap:28px;margin:28px 0}.fold-gate figure{margin:0;border:1px solid #383044;background:#08080e;border-radius:8px;overflow:hidden}.fold-gate figcaption{padding:14px 20px;color:#cfb7ec}.fold-gate canvas{display:block;width:100%;aspect-ratio:2/1}.fold-gate a{color:#c19aff}.about-main[hidden]{display:none!important}`;
document.head.append(style);
style.textContent += '@media(min-width:850px){.fold-gate-poses{grid-template-columns:repeat(2,minmax(0,1fr))}}';
const window = { x0: score.bars[30].xStart, x1: score.bars[32].xEnd };
const naturalStep = [0,0,1,1,2,3,3,4,4,5,5,6];
const heads = scoreRibbonData.systems.flatMap(system => system.heads)
  .filter(head => head.bar >= 31 && head.bar <= 33);
const glyphs = new Map(score.pdfGlyphs.filter(glyph => glyph.noteId).map(glyph => [glyph.noteId, glyph]));
const points = heads.map(head => ({
  id: head.id,
  x: glyphs.get(head.id).x,
  y: -( (Math.floor(head.writtenMidi / 12) - 1) * 7 + naturalStep[head.writtenMidi % 12] - 30 ),
}));
if (points.some(point => !Number.isInteger(point.y))) throw new Error('A note is off the diatonic grid.');
page.querySelector('[data-gate-check]').textContent = `${points.length} pontos reais · altura diatônica inteira · mesmas coordenadas nas quatro poses.`;
const poses = [0, .35, .6, 1];
const names = ['Entrada em profundidade', 'A curva retorna', 'Passagem próxima', 'Chegada frontal'];
const canvases = poses.map((pose, index) => {
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = `${Math.round(pose * 100)}% · ${names[index]}`;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', caption.textContent);
  figure.append(caption, canvas);
  page.querySelector('.fold-gate-poses').append(figure);
  return canvas;
});
function draw() {
  canvases.forEach((canvas, index) => {
    const width = canvas.clientWidth;
    const height = width / 2;
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2,2);
    // Keep the whole return visible in this inspection sheet.
    ctx.translate(width * .15, height * .15);
    ctx.scale(.7,.7);
    const project = createProjector(width, height, score, poses[index], window);
    const queue = [];
    function segment(x1,y1,x2,y2,color,lineWidth=1) {
      const a = project(x1,y1), b = project(x2,y2);
      queue.push({depth:(a.depth+b.depth)/2,paint(){
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();
      }});
    }
    for (const y of score.staffLines) {
      for (let i=0;i<240;i++) {
        const x=window.x0+(window.x1-window.x0)*i/240;
        segment(x,y,x+(window.x1-window.x0)/240,y,'#aca1bc',1.1);
      }
    }
    const bars = [score.bars[30].xStart,...score.bars.slice(30,33).map(bar=>bar.xEnd)];
    for(const x of bars) for(let y=-8;y<0;y+=.25) segment(x,y,x,y+.25,'#cdbce0',1.5);
    if(page.querySelector('input').checked) for(const point of points){
      const p=project(point.x,point.y);
      queue.push({depth:p.depth+.02,paint(){ctx.beginPath();ctx.arc(p.x,p.y,3.4,0,Math.PI*2);ctx.fillStyle='#70a8ff';ctx.fill();}});
    }
    queue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint());
  });
}
const observer = new ResizeObserver(draw);
canvases.forEach(canvas=>observer.observe(canvas));
page.querySelector('input').addEventListener('change',draw);
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
draw();
