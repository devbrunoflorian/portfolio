import { WindowRain } from './window-rain.js';

export async function mountRainControls({ stage, player, panel, parameters, valid }) {
  const pt=document.documentElement.lang.toLowerCase().startsWith('pt');
  const rain=await WindowRain.create({stage,player,seed:Number(parameters.get('rainSeed')||42),enabled:parameters.get('rain')==='1'});
  if(!valid()) { rain.dispose(); return; }
  const controls=new AbortController();
  const field=document.createElement('fieldset');
  field.className='sf-rain-controls';
  field.innerHTML=pt ? `
    <legend>SF02 · chuva no vidro</legend>
    <p>Prova técnica: as fotos ainda contêm gotas fixas, inclusive no sol. Desligar esta camada não remove essa água.</p>
    <label><input type="checkbox" data-rain-enabled /> Chuva procedural</label>
    <label>Intensidade <input type="range" min="0" max="150" value="100" step="5" data-rain-intensity /></label>
    <label><input type="checkbox" data-rain-mask /> Conferir máscara</label>
    <div class="sf-control-actions"><button type="button" data-rain-dry>Chuva → pós-chuva</button><button type="button" data-rain-inspect>Inspecionar gotas</button></div>
    <output data-rain-stats></output>` : `
    <legend>SF02 · window rain</legend>
    <p>Technical proof: the photos still contain fixed droplets, including sunshine. Disabling this layer does not remove that water.</p>
    <label><input type="checkbox" data-rain-enabled /> Procedural rain</label>
    <label>Intensity <input type="range" min="0" max="150" value="100" step="5" data-rain-intensity /></label>
    <label><input type="checkbox" data-rain-mask /> Check mask alignment</label>
    <div class="sf-control-actions"><button type="button" data-rain-dry>Rain → post-rain</button><button type="button" data-rain-inspect>Inspect droplets</button></div>
    <output data-rain-stats></output>`;
  panel.querySelector('.sf-control-panel').append(field);
  const enabled=field.querySelector('[data-rain-enabled]');
  const mask=field.querySelector('[data-rain-mask]');
  enabled.checked=rain.enabled;
  const inspect=()=>{
    const s=rain.snapshot();
    field.querySelector('[data-rain-stats]').textContent=`${s.drops} ${pt?'gotas':'drops'} · ${s.sliding} ${pt?'escorrendo':'sliding'} · ${s.trails} ${pt?'rastros':'trails'} · ${s.canvas.join(' × ')} px · draw p95 ${s.renderP95ms.toFixed(2)} ms`;
  };
  const listen=(selector,event,callback)=>field.querySelector(selector).addEventListener(event,callback,{signal:controls.signal});
  listen('[data-rain-enabled]','change',()=>{rain.setEnabled(enabled.checked);inspect();});
  listen('[data-rain-intensity]','input',event=>{rain.setIntensity(Number(event.target.value)/100);inspect();});
  listen('[data-rain-mask]','change',()=>{
    if(mask.checked) {enabled.checked=true;rain.setEnabled(true);}
    rain.setDebug(mask.checked);inspect();
  });
  listen('[data-rain-inspect]','click',inspect);
  listen('[data-rain-dry]','click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try {
      enabled.checked=true;rain.setEnabled(true);rain.setDebug(false);mask.checked=false;
      player.stopAuto();player.cancelTransition();player.setPaused(false);
      if(player.stateId!=='rainy' && !await player.show('rainy'))return;
      if(!valid())return;
      panel.querySelector('select[data-sf-state]').value='overcast';
      await player.fadeTo('overcast',{duration:6500});
      if(valid())inspect();
    } finally {
      if(valid())button.disabled=false;
    }
  });
  inspect();
  return { rain, dispose() {controls.abort();rain.dispose();field.remove();} };
}
