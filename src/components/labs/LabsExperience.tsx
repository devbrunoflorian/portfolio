import { useEffect, useRef, useState, type ReactNode } from 'react';
import { labs, type LabsCopy } from '../../content/labs';
import { loadLabsController, type LabsController, type LabsState } from '../../runtime/labs/controller';

interface Props { copy: LabsCopy; projectsHref: string; introduction?: ReactNode; folders?: ReactNode }

export default function LabsExperience({ copy, projectsHref, introduction, folders }: Props) {
  const root = useRef<HTMLElement>(null);
  const controller = useRef<LabsController | null>(null);
  const [state, setState] = useState<LabsState>({ index: 0, motionPaused: false, webgl: false });
  const [ready, setReady] = useState(false);
  const [hasSelectionChanged, setHasSelectionChanged] = useState(false);
  const latestState = useRef(state);
  latestState.current = state;
  function updateState(next: LabsState) {
    if (next.index !== latestState.current.index) setHasSelectionChanged(true);
    latestState.current = next;
    setState(next);
  }
  const selected = labs[state.index]!;
  const available = 'href' in selected;
  const number = String(state.index + 1).padStart(2, '0');

  useEffect(() => {
    let disposed = false;
    const host = root.current;
    if (!host) return;
    let revision = 0;
    const desktop = matchMedia('(min-width: 781px)');
    function start() {
      const attempt = ++revision;
      const paused = latestState.current.motionPaused;
      controller.current?.dispose();
      controller.current = null;
      setReady(false);
      void loadLabsController().then(module => {
        if (disposed || attempt !== revision) return;
        const handle = module.mountLabsController(host!, { onState: next => { if (!disposed && attempt === revision) updateState(next); } });
        controller.current = handle;
        return handle.ready.then(() => {
          if (!disposed && attempt === revision) { handle.setMotionPaused(paused); setReady(true); }
        });
      }).catch(error => {
        if (attempt !== revision || disposed) return;
        controller.current?.dispose();
        console.warn('The Labs controls could not start; static content remains available.', error);
      });
    }
    desktop.addEventListener('change', start);
    start();
    return () => { disposed = true; revision++; desktop.removeEventListener('change', start); controller.current?.dispose(); controller.current = null; };
  }, []);

  return <main id="main-content" className="labs-main" tabIndex={-1} ref={root} data-labs-ready={ready}>
    <section className="labs-runway" data-labs-runway aria-label={copy.runwayLabel}>
      <div className="labs-sticky">
        <div className="labs-atmosphere" aria-hidden="true"><span /><i /><b /></div>
        <div className="labs-copy">
          {introduction}
          <div className="lab-current" data-lab-current aria-live="polite" aria-atomic="true">
            <div className={`lab-current-entry${hasSelectionChanged ? ' is-entering' : ''}`} data-lab-current-entry key={state.index}>
              <p className="lab-current-index"><span data-lab-index>{number}</span><span aria-hidden="true"> / {String(labs.length).padStart(2, '0')}</span><i data-lab-state>{available ? copy.available : 'INCOMING'}</i></p>
              <h2 data-lab-title>{available ? 'Rate Limiting Lab' : copy.incoming}</h2>
              <p data-lab-description hidden={!available}>{available ? copy.labDescription : copy.reserved}</p>
              <ul className="lab-tags" data-lab-tags aria-label={copy.technologies} hidden={!available}>{labs[0].tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
              <a className="lab-detail-link" data-lab-link href={available ? selected.href : undefined} hidden={!available} target="_blank" rel="noopener noreferrer">{copy.explore} <span aria-hidden="true">↗</span></a>
              <p className="lab-incoming-note" data-lab-incoming hidden={available}>{copy.reserved}</p>
            </div>
          </div>
          <div className="lab-instructions"><span className="lab-mouse-icon" aria-hidden="true"><i /></span><span>{state.webgl ? copy.interactiveInstruction : copy.instruction}</span></div>
          <div className="lab-handoff"><span data-lab-handoff-label>{state.index === 0 ? copy.handoff : state.index === labs.length - 1 ? copy.handoffEnd : copy.handoffExplore}</span><a href={projectsHref}>{copy.projects} <span aria-hidden="true">→</span></a></div>
        </div>
        <section className="lab-scene" data-lab-scene tabIndex={0} role="region" aria-labelledby="labs-title" aria-label={state.webgl ? copy.interactiveScene : copy.sceneLabel}>
          {folders}
          <div className="lab-controls" data-lab-controls hidden={!ready}>
            <button type="button" data-lab-previous aria-label={copy.previous} onClick={() => controller.current?.scrollToIndex(state.index - 1)}>←</button>
            <span><b data-lab-count>{number}</b><i aria-hidden="true"> / </i>{String(labs.length).padStart(2, '0')}</span>
            <button type="button" data-lab-motion aria-label={state.motionPaused ? copy.resume : copy.pause} aria-pressed={state.motionPaused} onClick={() => controller.current?.setMotionPaused(!state.motionPaused)}><span aria-hidden="true">{state.motionPaused ? '▶' : 'Ⅱ'}</span></button>
            <button type="button" data-lab-next aria-label={copy.next} onClick={() => controller.current?.scrollToIndex(state.index + 1)}>→</button>
          </div>
        </section>
        <div className="lab-scroll-progress" aria-hidden="true"><span data-lab-progress /></div>
      </div>
    </section>
  </main>;
}
