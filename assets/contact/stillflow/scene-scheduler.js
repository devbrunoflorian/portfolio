import { PausableDelay, seededRandom } from './timeline.js';

const pedestrianChance = 0.42;

export function chooseNextClimate(current, states, random) {
  const candidates = states.filter(id => id !== current);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

export function planCycle({ stateId, states, random, minHold, maxHold, eventStates = [], pedestrianProbability = pedestrianChance }) {
  const hold = minHold + Math.floor(random() * (maxHold - minHold + 1));
  const pedestrian = eventStates.includes(stateId) && random() < pedestrianProbability;
  return { hold, pedestrian, nextState: chooseNextClimate(stateId, states, random) };
}

export class SceneScheduler {
  constructor({ stage, panel, player, rain, pedestrian = null, eventStates = [], states, seed = 42, fast = false, onState = () => {} }) {
    this.stage = stage;
    this.panel = panel;
    this.player = player;
    this.rain = rain;
    this.pedestrian = pedestrian;
    this.eventStates = eventStates;
    this.states = states;
    this.random = seededRandom(seed);
    this.seed = Number(seed) >>> 0 || 1;
    this.minHold = fast ? 900 : 30000;
    this.maxHold = fast ? 1400 : 70000;
    this.fadeDuration = fast ? 1800 : 5000;
    this.onState = onState;
    this.life = new AbortController();
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.pauseReasons = new Set();
    this.running = false;
    this.disposed = false;
    this.cycle = 0;
    this.lastEvent = 'none';

    document.addEventListener('visibilitychange', () => this.setPause('hidden', document.hidden), { signal: this.life.signal });
    this.motion.addEventListener('change', event => {
      if (event.matches) this.stop(this.copy.reduced);
      this.emit();
    }, { signal: this.life.signal });
    this.intersection = new IntersectionObserver(([entry]) => this.setPause('offscreen', !entry.isIntersecting));
    this.intersection.observe(stage);
    this.setPause('hidden', document.hidden);
  }

  get copy() {
    return document.documentElement.lang.toLowerCase().startsWith('pt') ? {
      ready: 'Scheduler pronto. Nenhum evento começa sem você iniciar a revisão.',
      running: 'Scheduler ativo; eventos e transições seguem o seed selecionado.',
      paused: 'Scheduler pausado.',
      stopped: 'Scheduler parado. O estado fotográfico atual foi preservado.',
      reduced: 'Movimento reduzido está ativo. Scheduler parado; estados estáticos continuam disponíveis.',
      error: 'O scheduler encontrou uma falha; a cena fotográfica atual foi preservada.',
    } : {
      ready: 'Scheduler ready. No event starts until you begin the review.',
      running: 'Scheduler active; events and transitions follow the selected seed.',
      paused: 'Scheduler paused.',
      stopped: 'Scheduler stopped. The current photographic state was preserved.',
      reduced: 'Reduced motion is active. Scheduler stopped; static states remain available.',
      error: 'The scheduler encountered a failure; the current photographic scene was preserved.',
    };
  }

  snapshot(message) {
    return {
      running: this.running,
      paused: this.pauseReasons.size > 0,
      pauseReasons: [...this.pauseReasons],
      stateId: this.player.stateId,
      phase: this.player.snapshot().phase,
      eventActive: Boolean(this.pedestrian?.active),
      event: this.lastEvent,
      cycle: this.cycle,
      seed: this.seed,
      reducedMotion: this.motion.matches,
      rainAvailable: Boolean(this.rain),
      message,
    };
  }

  emit(message) { this.onState(this.snapshot(message)); }

  setPause(reason, value) {
    if (this.disposed || !this.running) return;
    const wasPaused = this.pauseReasons.size > 0;
    if (value) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    const isPaused = this.pauseReasons.size > 0;
    this.player.setPause(`scheduler:${reason}`, Boolean(value));
    if (isPaused) {
      this.waiter?.pause();
      this.pedestrian?.setPause('scheduler', true);
    } else {
      this.waiter?.resume();
      this.pedestrian?.setPause('scheduler', false);
    }
    if (wasPaused !== isPaused) this.emit(isPaused ? this.copy.paused : this.copy.running);
  }

  async wait(duration, signal) {
    const waiter = new PausableDelay(duration, { paused: this.pauseReasons.size > 0, signal });
    this.waiter = waiter;
    try { await waiter.promise; }
    finally { if (this.waiter === waiter) this.waiter = null; }
  }

  async run(signal) {
    try {
      while (!signal.aborted) {
        const plan = planCycle({
          stateId: this.player.stateId,
          states: this.states,
          random: this.random,
          minHold: this.minHold,
          maxHold: this.maxHold,
          eventStates: this.eventStates,
        });
        this.cycle++;
        this.emit();
        await this.wait(plan.hold, signal);
        if (signal.aborted) break;

        if (plan.pedestrian && this.pedestrian && this.player.snapshot().phase === 'idle') {
          this.lastEvent = 'pedestrian';
          this.emit(this.copy.running);
          if (await this.pedestrian.start()) await this.pedestrian.waitForCompletion(signal);
        } else {
          this.lastEvent = 'none';
        }

        if (signal.aborted || !plan.nextState) break;
        if (this.player.snapshot().phase !== 'idle') continue;
        this.emit(this.copy.running);
        const changed = await this.player.fadeTo(plan.nextState, { duration: this.fadeDuration, signal });
        if (!changed && signal.aborted) break;
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !signal.aborted) {
        this.stop(this.copy.error);
        return;
      }
    }
  }

  start() {
    if (this.disposed || this.running || this.motion.matches || this.player.paused || !this.rain || this.states.length < 2) return false;
    const controller = new AbortController();
    this.controller = controller;
    this.running = true;
    this.rain.setEnabled(true);
    this.lockControls(true);
    if (document.hidden) this.pauseReasons.add('hidden');
    this.emit(this.copy.running);
    void this.run(controller.signal).finally(() => {
      if (this.controller !== controller) return;
      this.controller = null;
      this.running = false;
      this.pedestrian?.cancel(this.copy.stopped);
      this.unlockPlayerPauses();
      this.lockControls(false);
      this.emit(this.copy.stopped);
    });
    return true;
  }

  togglePause() {
    if (!this.running || this.motion.matches) return;
    this.setPause('manual', !this.pauseReasons.has('manual'));
  }

  lockControls(locked) {
    if (locked) {
      this.locked = [];
      const ownControls = this.panel.querySelector('.sf-scheduler-controls');
      for (const element of this.panel.querySelectorAll('.sf-control-panel button, .sf-control-panel select, .sf-control-panel input')) {
        if (ownControls?.contains(element) || element.matches('[data-sf-pause]')) continue;
        this.locked.push([element, element.disabled]);
        element.disabled = true;
      }
    } else {
      for (const [element, wasDisabled] of this.locked || []) element.disabled = wasDisabled;
      this.locked = [];
    }
  }

  unlockPlayerPauses() {
    for (const reason of this.pauseReasons) this.player.setPause(`scheduler:${reason}`, false);
    this.pauseReasons.clear();
    this.pedestrian?.setPause('scheduler', false);
  }

  stop(message = this.copy.stopped) {
    if (!this.running) return;
    const controller = this.controller;
    this.controller = null;
    controller?.abort();
    this.pedestrian?.cancel(message);
    this.player.cancelTransition();
    this.running = false;
    this.unlockPlayerPauses();
    this.lockControls(false);
    this.emit(message);
  }

  dispose() {
    if (this.disposed) return;
    this.stop(this.copy.stopped);
    this.disposed = true;
    this.life.abort();
    this.intersection.disconnect();
    this.pedestrian?.dispose();
  }
}

export async function mountSceneScheduler({ stage, panel, player, rain, manifest, parameters, valid = () => true }) {
  const pt = document.documentElement.lang.toLowerCase().startsWith('pt');
  const field = document.createElement('fieldset');
  field.className = 'sf-scheduler-controls';
  field.innerHTML = pt ? `
    <legend>SF06 · scheduler de revisão</legend>
    <p>Preview opt-in: estados fotográficos e chuva contínua. Eventos discretos aguardam clean plates e uma plataforma sem passageiros baked-in.</p>
    <div class="sf-control-actions">
      <button type="button" data-scheduler-start>Iniciar scheduler</button>
      <button type="button" data-scheduler-pause disabled>Pausar scheduler</button>
      <button type="button" data-scheduler-stop disabled>Parar scheduler</button>
    </div>
    <output data-scheduler-status role="status" aria-live="polite">Preparando recursos…</output>` : `
    <legend>SF06 · review scheduler</legend>
    <p>Opt-in preview: photographic states and continuous rain. Discrete events wait for clean plates and a platform without baked-in commuters.</p>
    <div class="sf-control-actions">
      <button type="button" data-scheduler-start>Start scheduler</button>
      <button type="button" data-scheduler-pause disabled>Pause scheduler</button>
      <button type="button" data-scheduler-stop disabled>Stop scheduler</button>
    </div>
    <output data-scheduler-status role="status" aria-live="polite">Preparing resources…</output>`;
  panel.querySelector('.sf-control-panel').append(field);

  const status = field.querySelector('[data-scheduler-status]');
  const start = field.querySelector('[data-scheduler-start]');
  const pause = field.querySelector('[data-scheduler-pause]');
  const stop = field.querySelector('[data-scheduler-stop]');
  const controls = new AbortController();
  let scheduler;
  const update = state => {
    if (state.message) status.textContent = `${state.message} · ${state.stateId}${state.eventActive ? ' · pedestrian' : ''} · #${state.seed}`;
    start.disabled = state.running || state.reducedMotion || !state.rainAvailable;
    pause.disabled = !state.running || state.reducedMotion;
    stop.disabled = !state.running;
    pause.textContent = state.paused
      ? (pt ? 'Retomar scheduler' : 'Resume scheduler')
      : (pt ? 'Pausar scheduler' : 'Pause scheduler');
    pause.setAttribute('aria-pressed', String(state.paused));
  };

  try {
    if (!valid()) { field.remove(); return null; }
    scheduler = new SceneScheduler({
      stage, panel, player, rain, states: Object.keys(manifest.stills),
      seed: Number(parameters.get('seed') || 42), fast: parameters.get('fast') === '1', onState: update,
    });
    update(scheduler.snapshot(scheduler.motion.matches
      ? scheduler.copy.reduced
      : (pt ? 'Pronto; sem animação automática.' : 'Ready; playback is user-started.')));
    start.addEventListener('click', () => scheduler.start(), { signal: controls.signal });
    pause.addEventListener('click', () => scheduler.togglePause(), { signal: controls.signal });
    stop.addEventListener('click', () => scheduler.stop(), { signal: controls.signal });
    return { scheduler, dispose() { controls.abort(); scheduler.dispose(); field.remove(); } };
  } catch {
    status.textContent = pt
      ? 'Os recursos do evento não foram carregados; a cena estática continua disponível.'
      : 'Event resources could not be loaded; the photographic scene remains available.';
    start.disabled = pause.disabled = stop.disabled = true;
    return { dispose() { controls.abort(); field.remove(); } };
  }
}
