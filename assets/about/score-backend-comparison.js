import {summarizeSamples} from './score-draw-profile.js';

export function mountBackendComparison(page,options,renderCanvas){
  const section=document.createElement('section');section.dataset.backendComparison='true';
  section.innerHTML='<h2>Canvas × Three.js · tomada experimental</h2><p>Mesma câmera, dados e resolução. O Canvas aprovado permanece. O blur do estudo WebGL é uma aproximação por profundidade, não uma reprodução pixel a pixel de C.</p><button data-load type="button">Abrir comparação Three.js</button><button data-measure type="button" disabled>Medir backends · 30 + 60 quadros</button><output aria-live="polite"></output><div data-scenes hidden><figure><figcaption>Canvas C · 13%</figcaption><canvas aria-label="Referência Canvas C para comparação de backends"></canvas></figure><figure><figcaption>Three.js C · 13% · experimental</figcaption><div data-three></div></figure><button data-front type="button">Conferir frontal 100%</button><button data-near type="button">Voltar a 13%</button></div><pre style="white-space:pre-wrap;font:13px/1.4 monospace"></pre>';
  page.querySelector('.notation-alternatives').append(section);
  let study;const output=section.querySelector('output'),pre=section.querySelector('pre'),canvas=section.querySelector('canvas');
  const load=section.querySelector('[data-load]'),measure=section.querySelector('[data-measure]');
  function draw(pose){
    renderCanvas(canvas,pose,true,'C');study.draw(pose,'C');
    const captions=section.querySelectorAll('figcaption');
    captions[0].textContent=`Canvas C · ${Math.round(pose*100)}%`;
    captions[1].textContent=`Three.js C · ${Math.round(pose*100)}% · experimental`;
  }
  load.addEventListener('click',async()=>{
    load.disabled=true;
    try{
      section.querySelector('[data-scenes]').hidden=false;
      const {mountThreeStudy}=await import('./score-three-study.js');
      const started=performance.now();
      study=await mountThreeStudy(section.querySelector('[data-three]'),{...options,width:canvas.clientWidth,height:canvas.clientWidth/1.8});
      draw(.13);section.dataset.ready='true';
      // A real pixel comparison complements the mathematical invariants of the caches.
      renderCanvas(canvas,.13,true,'C','auto',false,null,0);
      const original=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      renderCanvas(canvas,.13,true,'C');
      const optimized=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let changed=0,maxDelta=0;for(let i=0;i<original.length;i++){const delta=Math.abs(original[i]-optimized[i]);if(delta)changed++;maxDelta=Math.max(maxDelta,delta);}
      section.dataset.canvasParity=JSON.stringify({changedChannels:changed,maxDelta,channels:original.length});
      output.textContent=` Pronto. Inicialização e primeiro desenho: ${(performance.now()-started).toFixed(1)} ms.`;
      measure.disabled=false;
    }catch(error){output.textContent=` Não foi possível abrir: ${error.message}`;load.disabled=false;throw error;}
  });
  measure.addEventListener('click',async()=>{
    measure.disabled=true;
    const next=()=>new Promise(requestAnimationFrame),poses=Array.from({length:60},(_,i)=>i/59);
    const canvasSeries=[];
    try{
      for(const [name,sequence] of [['fixed',Array(30).fill(.13)],['moving',poses]]){
        for(let i=0;i<3;i++){renderCanvas(canvas,.13,true,'C');await next();}
        const samples=[];
        for(let i=0;i<sequence.length;i++){
          await next();const start=performance.now();renderCanvas(canvas,sequence[i],true,'C');const total=performance.now()-start;await next();
          samples.push({pose:sequence[i],total,untilRaf:performance.now()-start});output.textContent=` Canvas ${name}: ${i+1}/${sequence.length}`;
        }
        canvasSeries.push({name,count:samples.length,summary:summarizeSamples(samples),samples});
      }
      output.textContent=' Medindo Three.js…';
      const three=await study.benchmarkSequence({fixedPose:.13,fixedSamples:30,poses,warmup:3});
      const completion=study.measureSerializedCompletion(.13,'C');
      const report={environment:{viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,css:{width:canvas.clientWidth,height:canvas.clientWidth/1.8},backing:{width:canvas.width,height:canvas.height},optimization:canvas.dataset.optimization,visibility:document.visibilityState},canvasParity:JSON.parse(section.dataset.canvasParity),canvas:canvasSeries,three,completion,metrics:{renderer:study.metrics.renderer,hardwareAcceleration:study.metrics.hardwareAcceleration}};
      pre.textContent=JSON.stringify(report,null,2);section.dataset.complete='true';draw(.13);output.textContent=' Comparação medida. Nenhum backend substituído.';
    }finally{measure.disabled=false;}
  });
  section.querySelector('[data-front]').addEventListener('click',()=>draw(1));
  section.querySelector('[data-near]').addEventListener('click',()=>draw(.13));
  addEventListener('pagehide',()=>study?.dispose(),{once:true});
}
