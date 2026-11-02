import { StillflowPlayer } from './player.js';

const portuguese = document.documentElement.lang.toLowerCase().startsWith('pt');
const locale = portuguese ? 'pt' : 'en';
const reviewing = document.body.hasAttribute('data-sf-review');
const copy = portuguese ? {
  idle: 'Cena estática pronta.', decoding: 'Preparando o próximo estado…', fading: 'Transição entre estados.',
  paused: 'Cena pausada.', reduced: 'Movimento reduzido: cena estática. Você pode escolher um estado.',
  error: 'Não foi possível preparar esse estado. A imagem atual foi preservada.',
  choose: 'Escolha um estado diferente para comparar.',
  fallback: 'Cena estática. Os controles de transição estão indisponíveis.',
  unavailable: 'A cena não está disponível. Os links de contato continuam acessíveis.',
} : {
  idle: 'Static scene ready.', decoding: 'Preparing the next state…', fading: 'Transition between states.',
  paused: 'Scene paused.', reduced: 'Reduced motion: static scene. You can select a still.',
  error: 'That still could not be prepared. The current image was preserved.',
  choose: 'Choose a different still to compare.',
  fallback: 'Static scene. Transition controls are unavailable.',
  unavailable: 'The scene is unavailable. Contact links remain accessible.',
};
const parameters = new URLSearchParams(location.search);
if (parameters.get('clean') === '1') document.body.classList.add('sf-clean');
const manifestPromise = fetch('/assets/contact/stillflow/states.json').then(response => {
  if (!response.ok) throw new Error('Manifest unavailable');
  return response.json();
});
let scene;
let controls;
let rainControls;
let epoch = 0;

async function mount() {
  const version = ++epoch;
  const requestedState = new URLSearchParams(location.search).get('state');
  const panel = document.querySelector('.sf-controls');
  const status = panel.querySelector('[data-sf-status]');
  try {
    const manifest = await manifestPromise;
    if (version !== epoch) return;
    if (!Element.prototype.animate || !HTMLImageElement.prototype.decode) { status.textContent = copy.fallback; return; }
    controls = new AbortController();
    const select = panel.querySelector('[data-sf-state]');
    const transition = panel.querySelector('[data-sf-transition]');
    const mix = panel.querySelector('[data-sf-mix]');
    const pause = panel.querySelector('[data-sf-pause]');
    const automatic = panel.querySelector('[data-sf-auto]');
    const scrub = panel.querySelector('[data-sf-scrub]');
    const metrics = panel.querySelector('[data-sf-metrics]');
    const stage = document.querySelector('.contact-stage');
    let announcement;
    scene = new StillflowPlayer({
      frames: [...stage.querySelectorAll('[data-sf-frame]')], manifest,
      onError: () => { status.textContent = copy.error; },
      onChange: state => {
        rainControls?.rain.sync();
        stage.dataset.sfPhase = state.phase;
        stage.dataset.sfState = state.stateId;
        stage.dataset.sfPaused = String(state.paused);
        if (state.phase === 'idle') {
          const address = new URL(location.href);
          if (state.stateId === manifest.initial) address.searchParams.delete('state');
          else address.searchParams.set('state', state.stateId);
          if (address.href !== location.href) history.replaceState(null, '', address);
          document.querySelectorAll('.locale-nav a').forEach(link => {
            const target = new URL(link.href);
            if (state.stateId === manifest.initial) target.searchParams.delete('state');
            else target.searchParams.set('state', state.stateId);
            link.href = target.href;
          });
        }
        const reduced = state.pauseReasons.includes('reduced-motion');
        pause.disabled = reduced;
        pause.setAttribute('aria-pressed', String(state.pauseReasons.includes('manual')));
        automatic.disabled = reduced || manifest.ambient.length < 2;
        automatic.hidden = manifest.ambient.length < 2;
        automatic.setAttribute('aria-pressed', String(state.automatic));
        transition.disabled = reduced || state.phase !== 'idle' || Object.keys(manifest.stills).length < 2;
        mix.disabled = transition.disabled;
        scrub.disabled = state.phase !== 'fading';
        scrub.value = Math.round(state.alpha * 100);
        const key = `${state.phase}:${state.stateId}:${state.paused}:${reduced}:${state.error}`;
        if (key !== announcement) {
          status.textContent = state.error ? copy.error : reduced ? copy.reduced : state.paused ? copy.paused : copy[state.phase] || copy.idle;
          announcement = key;
        }
        const sample = state.decodeSamples.at(-1);
        metrics.textContent = sample ? `${sample.id} · decode ${sample.milliseconds} ms` : '';
      },
    });
    await scene.ready();
    if (version !== epoch) return;
    if (requestedState && Object.hasOwn(manifest.stills, requestedState)) await scene.show(requestedState);
    if (version !== epoch) return;
    select.replaceChildren(...Object.entries(manifest.stills).map(([id, still]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = still.label[locale];
      return option;
    }));
    select.value = scene.stateId;
    select.disabled = false;
    panel.querySelectorAll('[data-sf-show], [data-sf-reset]').forEach(button => { button.disabled = false; });
    const listen = (selector, event, handler) => panel.querySelector(selector).addEventListener(event, handler, { signal: controls.signal });
    const compare = fraction => {
      if (select.value === scene.stateId) { status.textContent = copy.choose; return; }
      scene.stopAuto();
      scene.cancelTransition();
      scene.setPaused(fraction !== undefined);
      void scene.fadeTo(select.value, { duration: 4000, onPrepared: () => { if (fraction !== undefined) scene.seek(fraction); } });
    };
    listen('[data-sf-transition]', 'click', () => compare());
    listen('[data-sf-mix]', 'click', () => compare(.5));
    listen('[data-sf-show]', 'click', () => { void scene.show(select.value); });
    listen('[data-sf-reset]', 'click', () => { select.value = manifest.initial; void scene.show(manifest.initial); });
    listen('[data-sf-pause]', 'click', () => scene.setPaused(!scene.pauses.has('manual')));
    listen('[data-sf-scrub]', 'input', () => { scene.setPaused(true); scene.seek(Number(scrub.value) / 100); });
    listen('[data-sf-auto]', 'click', () => {
      if (scene.autoController) scene.stopAuto();
      else {
        scene.cancelTransition();
        scene.startAuto({ seed: Number(parameters.get('seed') || 42) });
      }
    });
    if (reviewing) window.contactStillflow = { player: scene, manifest };
    scene.emit();
    if (reviewing) {
      try {
        const { mountRainControls } = await import('./rain-controls.js');
        if (version !== epoch) return;
        const mountedControls = await mountRainControls({stage,player:scene,panel,parameters,valid:()=>version===epoch});
        if (version !== epoch) { mountedControls?.dispose(); return; }
        rainControls = mountedControls;
        window.contactStillflow.rain = rainControls.rain;
      } catch {
        // An optional rain proof failure must not disable photographic controls or links.
        panel.dataset.rainUnavailable = 'true';
      }
    }
    if (reviewing && parameters.get('autoplay') === '1') scene.startAuto({ seed: Number(parameters.get('seed') || 42) });
  } catch (error) {
    if (version === epoch && error.name !== 'AbortError') {
      const photo = document.querySelector('.sf-photo');
      if (!photo.complete || !photo.naturalWidth) {
        document.querySelector('.contact-stage').dataset.sfFailure = 'poster';
        status.textContent = copy.unavailable;
      } else status.textContent = copy.fallback;
    }
  }
}

window.addEventListener('pagehide', () => {
  epoch++;
  controls?.abort();
  rainControls?.dispose();
  rainControls = undefined;
  scene?.dispose();
});
window.addEventListener('pageshow', event => { if (event.persisted) void mount(); });
void mount();
