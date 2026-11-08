import { scoreRibbonData } from './score-ribbon-data.js';
import { scoreRibbonTimeline as score } from './score-ribbon-timeline.js';
import { createProjector } from './score-ribbon-geometry.js?v=travel-1';
import { createTravelProjector } from './score-travel-geometry.js?v=profile-2';
import { noteHeadStemPairs, projectHeadStem } from './score-head-stems.js';
import { buildEngraving, enqueueRest, projectedRest } from './score-engraving.js?v=compound-1';
import { buildCompoundGroups, enqueueCompoundGroups } from './score-compound-groups.js?v=profile-3';
import { paintDepthQueue, polygonBounds, SCORE_BACKGROUND, DEPTH_BANDS } from './score-occlusion.js?v=profile-1';
import {readingFocus,FOCUS_RADII} from './score-focus-profile.js';
import {applyFocusLayers,clearFocusLayers,filterSupport} from './score-focus-layers.js?v=profile-1';
import { enqueueStaffLine, HALO_HALF_WIDTH } from './score-depth-cues.js?v=profile-2';
import { mountFrontComparison } from './score-front-comparison.js';
import {mountDrawProfile} from './score-draw-profile.js?v=3';
import {mountBackendComparison} from './score-backend-comparison.js?v=build-profile';
const optimization=Number(new URLSearchParams(location.search).get('score-optimization')??0);

const gate = new URLSearchParams(location.search).get('score-gate');
const gpuStudyOnly=new URLSearchParams(location.search).get('score-gpu')==='study';
const engravingStudy = gate === '3b';
const glyphStudy = gate === '3a' || engravingStudy;
const traveling = gate === '2b' || glyphStudy;

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
style.textContent += '.travel-panel{margin:24px 0}.travel-panel canvas{width:100%;aspect-ratio:1.8;display:block;background:#08080e;border:1px solid #383044}.travel-controls{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.travel-controls input{width:min(400px,50vw)}.travel-controls button{padding:10px 18px;background:#30203e;border:1px solid #8562ac;color:#eee}.travel-scroll{height:160vh}.travel-sticky{position:sticky;top:74px;background:#060609;padding:10px 0}.travel-sticky canvas{max-height:65vh;object-fit:contain}';
const view = { x0: score.bars[30].xStart, x1: score.bars[32].xEnd };
const steps = [0,0,1,1,2,3,3,4,4,5,5,6];
const glyphs = new Map(score.pdfGlyphs.filter(g => g.noteId).map(g => [g.noteId,g]));
const heads = scoreRibbonData.systems.flatMap(system => system.heads).filter(h=>h.bar>=31&&h.bar<=33);
const points = heads.map(head=>({
  id:head.id, bar:head.bar, midi:head.writtenMidi, x:glyphs.get(head.id).x,
  y:-((Math.floor(head.writtenMidi/12)-1)*7+steps[head.writtenMidi%12]-30),
}));
const markerId = 'guitar-33-4-1';
const headStems = glyphStudy ? noteHeadStemPairs(score,points) : [];
const engraving = engravingStudy ? buildEngraving(score,points,view) : null;
const groups = engravingStudy ? buildCompoundGroups(engraving,score) : [];
let showDetails = new URLSearchParams(location.search).get('notation') !== 'compact';
let focusBackend='auto';
if(glyphStudy){
  page.querySelector('h1').textContent='Cabeças e hastes · frente e proximidade';
  page.querySelector('label').lastChild.textContent=' Mostrar cabeças e hastes';
  page.querySelectorAll('h2')[0].remove();
  page.querySelector('.fold-gate-film').previousElementSibling.remove();
  page.querySelector('.fold-gate-film').remove();
}
if(engravingStudy){
  page.classList.add('engraving-gate');
  page.querySelector('h1').textContent='Gravura musical · frente e proximidade';
  page.querySelector('label').lastChild.textContent=' Mostrar notação';
  page.querySelector('h1 + p').textContent='Guitarra, compassos 31–33. B: recorte e esmaecimento atrás do plano de leitura. C: o mesmo B com foco por profundidade. Sem vozes, mouse ou áudio.';
  style.textContent += '.engraving-gate > .fold-gate-poses{grid-template-columns:1fr}.engraving-gate figure,.engraving-gate canvas{background:#060609}';
  const detailLabel=document.createElement('label');
  detailLabel.innerHTML='<input type="checkbox" data-details> Tercinas completas (desmarque para comparar a versão simplificada)';
  detailLabel.querySelector('input').checked=showDetails;
  page.querySelector('[data-gate-check]').before(detailLabel);
  detailLabel.querySelector('input').addEventListener('change',event=>{showDetails=event.target.checked;draw();});
}
let liveCanvas, poseSlider, liveLabel, pairDown, pairUp, animationFrame = 0;
let direction = 1, lastTime = 0;
let manualPose = false;
if(traveling && !glyphStudy){
  page.querySelector('h1').textContent='Fita musical · câmera em viagem';
  const panel=document.createElement('section');
  panel.className='travel-panel';
  panel.innerHTML='<div class="travel-scroll"><div class="travel-sticky"><div class="travel-controls"><button type="button" data-play>Reproduzir ida e volta</button><label>Posição <input aria-label="Posição da câmera" type="range" min="0" max="1000" value="0"></label><output>↓ 0.0%</output></div><p>31 · 32 vazio · 33 — nota dourada guitar-33-4-1</p><canvas aria-label="Passagem contínua com câmera viajando"></canvas></div></div><h2>Mesma posição, sentidos opostos</h2><div class="fold-gate-poses" data-pair><figure><figcaption data-down>↓ 0%</figcaption><canvas></canvas></figure><figure><figcaption data-up>↑ 0%</figcaption><canvas></canvas></figure></div>';
  page.querySelector('.fold-gate-poses').before(panel);
  liveCanvas=panel.querySelector('.travel-sticky canvas');
  poseSlider=panel.querySelector('input');liveLabel=panel.querySelector('output');
  const studyPose=new URLSearchParams(location.search).get('study-pose');
  if(studyPose!==null){poseSlider.value=String(Number(studyPose)*1000);manualPose=true;direction=-1;}
  pairDown=panel.querySelector('[data-pair] figure:first-child canvas');
  pairUp=panel.querySelector('[data-pair] figure:last-child canvas');
  function live(){
    const p=Number(poseSlider.value)/1000;
    renderFrame(liveCanvas,p);renderFrame(pairDown,p);renderFrame(pairUp,1-(1-p));
    liveLabel.value=(direction===1?'↓ ':'↑ ')+(p*100).toFixed(1)+'%';
    panel.querySelector('[data-down]').textContent='↓ '+(p*100).toFixed(1)+'% · '+markerId;
    panel.querySelector('[data-up]').textContent='↑ '+(p*100).toFixed(1)+'% · '+markerId;
  }
  function stop(){cancelAnimationFrame(animationFrame);animationFrame=0;panel.querySelector('[data-play]').textContent='Reproduzir ida e volta';}
  function tick(now){
    let next=Number(poseSlider.value)+direction*(lastTime?Math.min(50,now-lastTime):0)/8;
    lastTime=now;if(next>=1000){next=1000;direction=-1;}else if(next<=0){next=0;direction=1;}
    poseSlider.value=String(next);live();animationFrame=requestAnimationFrame(tick);
  }
  panel.querySelector('[data-play]').addEventListener('click',()=>{
    if(animationFrame){stop();return;}lastTime=0;panel.querySelector('[data-play]').textContent='Pausar';animationFrame=requestAnimationFrame(tick);
  });
  poseSlider.addEventListener('input',()=>{manualPose=true;stop();live();});
  const followScroll=document.createElement('button');
  followScroll.type='button';followScroll.textContent='Seguir scroll';
  panel.querySelector('.travel-controls').append(followScroll);
  followScroll.addEventListener('click',()=>{stop();manualPose=false;});
  addEventListener('scroll',()=>{
    if(animationFrame||manualPose)return;
    const bounds=panel.querySelector('.travel-scroll').getBoundingClientRect();
    if(bounds.top>90||bounds.bottom<innerHeight*.5)return;
    const next=Math.max(0,Math.min(1000,(80-bounds.top)/Math.max(1,bounds.height-innerHeight*.7)*1000));
    direction=next>=Number(poseSlider.value)?1:-1;poseSlider.value=String(next);live();
  },{passive:true});
  addEventListener('pagehide',stop,{once:true});
  requestAnimationFrame(live);
}
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
let comparison;
function addFrame(container,pose,label,details,variant='B',crop=false){
  const figure=document.createElement('figure');
  const caption=document.createElement('figcaption');
  caption.textContent=label;
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label',label+' · '+markerId);
  figure.append(caption,canvas);container.append(figure);frames.push({canvas,pose,details,variant,crop});
}
(engravingStudy?[1,.13,.4]:glyphStudy?[1,.13]:[0,.35,.6,1]).forEach((p,i)=>addFrame(page.querySelector('.fold-gate > .fold-gate-poses'),p,
  `${Math.round(p*100)}% · ${(glyphStudy?['Music frontal','Passagem próxima','Passagem intermediária']:['Entrada pela borda','Retorno','Passagem próxima','Music frontal'])[i]}`));
for(let i=0;!glyphStudy&&i<12;i++){
  addFrame(page.querySelector('.fold-gate-film'),i/11,`↓ ${(i/11*100).toFixed(1)}% · ${markerId}`);
  addFrame(page.querySelector('.fold-gate-film'),1-i/11,`↑ ${((1-i/11)*100).toFixed(1)}% · ${markerId}`);
}
if(engravingStudy){
  const alternatives=document.createElement('section');
  alternatives.className='notation-alternatives';
  alternatives.innerHTML='<h2>B corrigido × C · foco relativo</h2><p>Frente e nota dourada protegidas. Em 40% e 100%, sem esmaecimento; a frontal também não recebe blur. C usa faixas de 0 / 0,8 / 1,6 / 2,8 px, apenas atrás do plano de leitura.</p>';
  const fallback=document.createElement('label');fallback.innerHTML='<input type="checkbox"> Testar C com canvases separados e blur CSS';
  fallback.querySelector('input').addEventListener('change',event=>{
    focusBackend=event.target.checked?'css':'auto';
    for(const frame of frames.filter(frame=>frame.variant==='C'))renderFrame(frame.canvas,frame.pose,true,'C',focusBackend);
  });alternatives.append(fallback);
  for(const pose of [.13,.4]){
    const row=document.createElement('div');row.className='fold-gate-poses';alternatives.append(row);
    row.dataset.comparison=String(pose);
    addFrame(row,pose,`${Math.round(pose*100)}% · B corrigido`,true,'B');
    addFrame(row,pose,`${Math.round(pose*100)}% · C foco por profundidade`,true,'C');
  }
  const crossing=document.createElement('div');crossing.className='fold-gate-poses';crossing.dataset.crossing='true';
  alternatives.append(crossing);
  addFrame(crossing,.13,'13% · A cruzamento ampliado',true,'A',true);
  addFrame(crossing,.13,'13% · B cruzamento ampliado',true,'B',true);
  const strip=document.createElement('section');strip.dataset.strip='true';
  strip.innerHTML='<h2>Passagem próxima · 12 quadros de 0% a 50%</h2><div class="focus-strip"></div>';
  alternatives.append(strip);
  style.textContent+='.focus-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.focus-strip figcaption{font-size:12px;padding:6px}.focus-benchmark{white-space:pre-wrap;font:13px/1.4 monospace}.focus-measure{padding:12px 18px;background:#30203e;color:#eee;border:1px solid #8562ac}';
  for(let i=0;i<12;i++)addFrame(strip.querySelector('div'),i*.5/11,`${(i*50/11).toFixed(1)}% · mesma nota dourada`,true,'B');
  const measure=document.createElement('button');measure.className='focus-measure';measure.textContent='Medir B / C / fallback CSS';
  const report=document.createElement('pre');report.className='focus-benchmark';report.dataset.benchmark='true';
  alternatives.append(measure,report);
  measure.addEventListener('click',async()=>{
    measure.disabled=true;const results=[];const canvas=frames[1].canvas;
    for(const pose of [.13,.4])for(const [variant,backend] of [['B','auto'],['C','auto'],['C','css']]){
      const samples=[];
      for(let i=0;i<3;i++){
        await new Promise(requestAnimationFrame);const start=performance.now();
        renderFrame(canvas,pose,true,variant,backend);
        const cpu=performance.now()-start;await new Promise(requestAnimationFrame);
        samples.push({cpuMs:+cpu.toFixed(1),rafMs:+(performance.now()-start).toFixed(1)});
      }
      results.push({pose,variant,requested:backend,actual:canvas.dataset.focusBackend,width:canvas.clientWidth,height:canvas.clientHeight,samples});
    }
    report.textContent=JSON.stringify({support:filterSupport(),devicePixelRatio,bufferScale:2,results},null,2);
    renderFrame(canvas,.13,true,'B');measure.disabled=false;
  });
  page.querySelector('.fold-gate > .fold-gate-poses').after(alternatives);
}
function renderFrame(canvas,pose,details=showDetails,variant='B',backend='auto',crop=false,profile=null,optimizationLevel=optimization){
  let finish=profile?.start('setup');
  const started=performance.now();clearFocusLayers(canvas);
  const width=canvas.clientWidth,height=width/1.8;
  if(optimizationLevel<3||canvas.width!==Math.round(width*2)||canvas.height!==Math.round(height*2)){
    canvas.width=Math.round(width*2);canvas.height=Math.round(height*2);
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);
  finish?.();finish=profile?.start('geometry');
  let project=traveling?createTravelProjector(width,height,score,pose,view,.2,optimizationLevel>=1):createProjector(width,height,score,pose,view);
  finish?.();if(profile)project=profile.projector(project);
  finish=profile?.start('pathAssembly');
  const depthEnabled=engravingStudy&&pose<.85&&variant!=='A';
  const focus=readingFocus(project,view,width,height,points.find(note=>note.id===markerId),pose);
  const queue=[];
  const surfaces=[];
  const divisions=280;
  function stroke(a,b,color,thickness,depthBias=0){
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    queue.push({bounds:polygonBounds([a,b],thickness+2),range:[Math.min(a.u,b.u)-.003,Math.max(a.u,b.u)+.003],depth:(a.depth+b.depth)/2+depthBias,
      depthAt(x,y){const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(length2||1)));return a.depth+(b.depth-a.depth)*t+depthBias+1;},paint(){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.stroke();
    }});
  }
  for(let i=0;i<divisions;i++){
    const x0=view.x0+(view.x1-view.x0)*i/divisions;
    const x1=view.x0+(view.x1-view.x0)*(i+1)/divisions;
    const top=depthEnabled?-4-HALO_HALF_WIDTH:-8.6,bottom=depthEnabled?-4+HALO_HALF_WIDTH:.6;
    const a=project(x0,top),b=project(x1,top),c=project(x1,bottom),d=project(x0,bottom);
    const depth=project((x0+x1)/2,-4).depth;
    surfaces.push([a,b,c,d]);
    // The engraving study uses a depth-only surface; older gates retain their reference rendering.
    if(!engravingStudy)queue.push({depth:depth-25,paint(){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
      ctx.fillStyle='#08080e';ctx.fill();
    }});
    if(!engravingStudy)for(const y of score.staffLines){
      const p=project(x0,y),q=project(x1,y);
      const shade=Math.max(.3,Math.min(1,(p.perspective-.4)/.9));
      stroke(p,q,engravingStudy?'#cfc2e2':`rgb(${Math.round(110+shade*110)} ${Math.round(107+shade*100)} ${Math.round(137+shade*102)})`,engravingStudy?engraving.staffWidth*p.scale:Math.max(.65,p.perspective*1.2),.15);
    }
  }
  if(engravingStudy)for(const y of score.staffLines)enqueueStaffLine(queue,ctx,project,view,y,engraving.staffWidth,optimizationLevel>=2);
  const edges=engravingStudy?engraving.barlines.filter(line=>pose>=.85||line.x>view.x0+.01).map(line=>line.x)
    :[score.bars[30].xStart,...score.bars.slice(30,33).map(b=>b.xEnd)];
  for(const x of edges)for(let y=-8;y<0;y+=.25){
    const a=project(x,y),b=project(x,y+.25);stroke(a,b,'#cfc2e2',engravingStudy?engraving.staffWidth*a.scale:Math.max(.75,a.perspective*1.4),.2);
  }
  if(!engravingStudy&&page.querySelector('input').checked)for(const note of points){
    const p=project(note.x,note.y);
    if(engravingStudy){
      for(const line of engraving.ledgerLines.filter(line=>line.pair.note.id===note.id))stroke(project(line.x0,line.y),project(line.x1,line.y),'#cfc2e2',line.width*p.scale,.25);
    }else for(let y=2;y<=note.y;y+=2)stroke(project(note.x-1.6,y),project(note.x+1.6,y),'#b8accb',Math.max(.8,p.perspective),.25);
    const radius=Math.max(1.3,4.6*p.perspective);
    const shape = glyphStudy ? projectHeadStem(headStems.find(pair=>pair.note.id===note.id),project) : null;
    const bounds = shape ? polygonBounds([shape.head,shape.end,shape.contact],Math.max(3,p.scale*4)) : polygonBounds([p],radius+5);
    queue.push({bounds,range:[p.u-.012,p.u+.012],depth:engravingStudy?p.depth+3:project(note.x,-4).depth+25,paint(){
      if(glyphStudy){
        const pair=headStems.find(pair=>pair.note.id===note.id);
        ctx.beginPath();ctx.moveTo(shape.contact.x,shape.contact.y);ctx.lineTo(shape.end.x,shape.end.y);
        ctx.strokeStyle=note.id===markerId?'#ffdc83':'#cfc2e2';ctx.lineWidth=Math.max(.65,pair.stem.width*p.scale);ctx.stroke();
        ctx.save();ctx.translate(p.x,p.y);ctx.scale(pair.glyph.scaleX*p.scale,pair.glyph.scaleY*p.scale);
        ctx.fillStyle=note.id===markerId?'#ffdc83':'#a7caff';ctx.fill(new Path2D(score.pdfGlyphPaths[pair.glyph.glyph]));ctx.restore();
        return;
      }
      ctx.beginPath();ctx.arc(p.x,p.y,radius+1.1,0,Math.PI*2);ctx.fillStyle='#08080e';ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fillStyle=note.id===markerId?'#ffdc83':'#70a8ff';ctx.fill();
      if(note.id===markerId){ctx.beginPath();ctx.arc(p.x,p.y,radius+3,0,Math.PI*2);ctx.lineWidth=1;ctx.strokeStyle='#ffdc83';ctx.stroke();}
    }});
  }
  if(engravingStudy&&page.querySelector('input').checked){
    enqueueCompoundGroups(queue,ctx,groups,score,project,details,profile,optimizationLevel>=3);
    enqueueRest(queue,ctx,engraving.rest,project);
  }
  finish?.();
  if(engravingStudy){
    const focusEnabled=variant==='C'&&focus.blur;
    const snapshot=paintDepthQueue(ctx,queue,surfaces,width,height,{fade:depthEnabled&&focus.fade,focusDistance:focus.distance,captureFocus:focusEnabled,profile});
    canvas.dataset.focusBackend=focusEnabled?applyFocusLayers(canvas,snapshot,width,focus.distance,backend,profile):'none';
    canvas.dataset.filterSupport=JSON.stringify(filterSupport());
    canvas.dataset.focusDistance=String(focus.distance);
    canvas.dataset.fadeEnabled=String(depthEnabled&&focus.fade);
    canvas.dataset.blurEnabled=String(focusEnabled);
    canvas.dataset.variant=variant;
    canvas.dataset.depthEnabled=String(depthEnabled);
    canvas.dataset.depthBands=JSON.stringify(DEPTH_BANDS);
    canvas.dataset.staffPaths=String(queue.filter(item=>item.kind==='staff-line').length);
    const rest=projectedRest(engraving.rest,project);
    canvas.dataset.rest=JSON.stringify({bar:32,width:rest.width,height:rest.height,x:rest.anchor.x,y:rest.anchor.y});
    canvas.dataset.groups=JSON.stringify(queue.filter(item=>item.kind==='notation-group').map(item=>item.id));
    canvas.dataset.beams=String(groups.filter(group=>group.beam).length);
    canvas.dataset.details=String(details);
    canvas.dataset.background=SCORE_BACKGROUND;
  }else queue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint());
  canvas.dataset.pose=String(pose);
  canvas.dataset.camera=JSON.stringify(project.camera);
  const marked = points.find(note=>note.id===markerId);
  canvas.dataset.marker=JSON.stringify(project(marked.x,marked.y));
  if(crop){
    const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);
    const anchor=project(marked.x,-4),cropWidth=width*.42,cropHeight=height*.42;
    const x=Math.max(0,Math.min(width-cropWidth,anchor.x-cropWidth*.5));
    const y=Math.max(0,Math.min(height-cropHeight,anchor.y-cropHeight*.5));
    ctx.save();ctx.resetTransform();ctx.drawImage(copy,x*2,y*2,cropWidth*2,cropHeight*2,0,0,canvas.width,canvas.height);ctx.restore();
    canvas.dataset.crop=JSON.stringify({x,y,width:cropWidth,height:cropHeight});
  }
  canvas.dataset.drawMs=(performance.now()-started).toFixed(1);
  canvas.dataset.optimization=String(optimizationLevel);
}
function draw(){
  if(gpuStudyOnly)return;
  for(const frame of frames)renderFrame(frame.canvas,frame.pose,frame.details??showDetails,frame.variant,focusBackend,frame.crop);
  comparison?.draw();
  if(liveCanvas){
    const pose=Number(poseSlider.value)/1000;
    renderFrame(liveCanvas,pose);renderFrame(pairDown,pose);renderFrame(pairUp,1-(1-pose));
  }
}
const observer=new ResizeObserver(draw);
observer.observe(page.querySelector('.fold-gate > .fold-gate-poses'));
page.querySelector('input').addEventListener('change',draw);
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
draw();
if(engravingStudy&&!gpuStudyOnly){
  const sourceSystem=scoreRibbonData.systems.find(system=>system.bars.some(bar=>bar.number===31));
  comparison=mountFrontComparison(page,frames[0].canvas,score,sourceSystem,view);
  mountDrawProfile(page,frames[1].canvas,renderFrame);
  mountBackendComparison(page,{score,view,points,groups,engraving},renderFrame);
}
if(engravingStudy&&gpuStudyOnly){
  for(const child of page.children)child.hidden=true;
  style.textContent+=' .fold-gate > [hidden]{display:none!important}';
  const title=page.querySelector('h1');title.hidden=false;title.textContent='Dissonância · projeção na GPU';
  const {mountGpuStudy}=await import('./score-gpu-study.js?v=4');
  await mountGpuStudy(page,{score,view,points,groups,engraving},renderFrame);
}
