export const PROFILE_STAGES=['geometry','pathAssembly','glyphs','pathDraw','maskRaster','maskReadback','maskVisibility','pixelFadeComposite','focusLayers','blurSubmit','composition','setup'];

/** Exclusive CPU wall times. Browser/GPU completion is measured separately. */
export function createDrawProfile(){
  const values=Object.fromEntries(PROFILE_STAGES.map(name=>[name,0]));
  const stack=[];let projectionCalls=0;
  function start(name){
    const entry={name,started:performance.now(),children:0};stack.push(entry);
    return ()=>{
      const elapsed=performance.now()-entry.started;stack.pop();
      values[name]=(values[name]??0)+elapsed-entry.children;
      if(stack.length)stack.at(-1).children+=elapsed;
    };
  }
  function measure(name,operation){const end=start(name);try{return operation();}finally{end();}}
  return {values,start,measure,get projectionCalls(){return projectionCalls;},
    projector(project){const wrapped=(...args)=>{projectionCalls++;return measure('geometry',()=>project(...args));};return Object.assign(wrapped,project);}};
}

export function summarizeSamples(samples){
  const summarize=values=>{
    const sorted=values.toSorted((a,b)=>a-b),n=sorted.length;
    return {median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,p95:sorted[Math.ceil(n*.95)-1],min:sorted[0],max:sorted.at(-1)};
  };
  const keys=[...new Set(samples.flatMap(sample=>Object.keys(sample)))];
  return Object.fromEntries(keys.filter(key=>samples.every(sample=>Number.isFinite(sample[key]))).map(key=>[key,summarize(samples.map(sample=>sample[key]))]));
}

export function mountDrawProfile(page,canvas,render){
  const section=document.createElement('section');section.dataset.drawProfile='true';
  section.innerHTML='<h2>Perfil de desenho · sem alterar a aparência</h2><p>30 desenhos B + 30 C em 13%; 60 poses C consecutivas (0–100%). Três aquecimentos por série. Tempos CPU exclusivos; não equivalem a tempo GPU.</p><button type="button">Executar perfil de 120 desenhos</button><output aria-live="polite"></output><pre style="white-space:pre-wrap;font:13px/1.4 monospace"></pre>';
  page.querySelector('.notation-alternatives').append(section);
  const button=section.querySelector('button'),output=section.querySelector('output'),pre=section.querySelector('pre');
  const quick=document.createElement('button');quick.type='button';quick.textContent='Medir ajuste · 30 desenhos C';section.append(quick);
  quick.addEventListener('click',async()=>{
    quick.disabled=button.disabled=true;
    const samples=[];const next=()=>new Promise(requestAnimationFrame);
    try{
      render(canvas,.13,true,'C','auto',false,null,0);
      const baseline=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      render(canvas,.13,true,'C');
      const adjusted=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let changedChannels=0,maxDelta=0;
      for(let i=0;i<baseline.length;i++){const delta=Math.abs(baseline[i]-adjusted[i]);if(delta)changedChannels++;maxDelta=Math.max(maxDelta,delta);}
      for(let i=0;i<3;i++){render(canvas,.13,true,'C');await next();}
      for(let i=0;i<30;i++){
        await next();const start=performance.now();render(canvas,.13,true,'C');const total=performance.now()-start;await next();
        samples.push({total,untilRaf:performance.now()-start});output.textContent=` Ajuste: ${i+1}/30`;
      }
      pre.textContent=JSON.stringify({optimization:canvas.dataset.optimization,pixelParity:{changedChannels,maxDelta,channels:baseline.length},environment:{viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,css:{width:canvas.clientWidth,height:canvas.clientHeight},backing:{width:canvas.width,height:canvas.height},visibility:document.visibilityState},count:30,summary:summarizeSamples(samples),samples},null,2);
      render(canvas,.13,true,'B');section.dataset.complete='true';output.textContent=' Ajuste medido.';
    }finally{quick.disabled=button.disabled=false;}
  });
  button.addEventListener('click',async()=>{
    button.disabled=quick.disabled=true;
    const context=canvas.getContext('2d');
    const report={environment:{userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,css:{width:canvas.clientWidth,height:canvas.clientWidth/1.8},contextAttributes:context.getContextAttributes?.()??null,visibility:document.visibilityState,hardwareConcurrency:navigator.hardwareConcurrency,gpuAcceleration:'Not established by context attributes; see browser GPU diagnostics.'},series:[]};
    const nextFrame=()=>new Promise(requestAnimationFrame);
    try{
      for(const [name,variant,count,vary] of [['B-13','B',30,false],['C-13','C',30,false],['C-travel','C',60,true]]){
        for(let i=0;i<3;i++){render(canvas,.13,true,variant);await nextFrame();}
        const samples=[];const wallStart=performance.now();
        for(let i=0;i<count;i++){
          await nextFrame();const pose=vary?i/(count-1):.13;
          const profile=createDrawProfile(),start=performance.now();render(canvas,pose,true,variant,'auto',false,profile);
          const cpu=performance.now()-start;await nextFrame();const untilRaf=performance.now()-start;
          samples.push({...profile.values,total:cpu,untilRaf,projectionCalls:profile.projectionCalls,pose});
          output.textContent=` ${name}: ${i+1}/${count}`;
        }
        report.series.push({name,variant,count,summary:summarizeSamples(samples),wallMs:performance.now()-wallStart,samples});
        pre.textContent=JSON.stringify(report,null,2);
      }
      const overhead=[];
      for(let i=0;i<5;i++){
        await nextFrame();const start=performance.now();render(canvas,.13,true,'C');overhead.push({total:performance.now()-start});
      }
      report.uninstrumentedControl={count:5,summary:summarizeSamples(overhead)};
      report.environment.backing={width:canvas.width,height:canvas.height};
      report.environment.finalVisibility=document.visibilityState;
      render(canvas,.13,true,'B');
      pre.textContent=JSON.stringify(report,null,2);output.textContent=' Perfil concluído.';section.dataset.complete='true';
    }catch(error){output.textContent=` Falhou: ${error.message}`;throw error;}
    finally{button.disabled=quick.disabled=false;}
  });
}
