import { canAnimateTheme, startChessWave } from './chess-wave.js';

/** @typedef {'dark' | 'light'} Theme */
/** @typedef {{ applyTheme: (theme: Theme, context: { signal: AbortSignal }) => void | Promise<void>, onError?: (error: unknown) => void }} ThemeParticipant */
const root = globalThis.document?.documentElement;
const participants = new Set();
let theme = root?.dataset.theme === 'light' ? 'light' : 'dark';
let activeWave = null;
let revision = 0;

export const getTheme = () => theme;

function updateControls() {
  const english = root.lang.startsWith('en');
  const label = english ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` : `Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`;
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', label);
    button.title = label;
    button.hidden = false;
  }
}

function refreshTextInk() {
  const colors = new Map();
  for (const word of document.querySelectorAll('.scroll-fill-word, .scroll-fill-syllable')) {
    const source = word.closest('em, strong') ?? word.closest('h1, h2, h3, .scroll-fill') ?? word.parentElement;
    if (!source) continue;
    if (!colors.has(source)) colors.set(source, getComputedStyle(source).color);
    word.style.setProperty('--word-ink', colors.get(source));
  }
}

function applyParticipant(record, nextTheme) {
  record.controller?.abort();
  const controller = new AbortController();
  record.controller = controller;
  return Promise.resolve().then(() => {
    if (!controller.signal.aborted) return record.participant.applyTheme(nextTheme, { signal: controller.signal });
  }).then(() => true, error => {
    if (!controller.signal.aborted) {
      try { record.participant.onError?.(error); }
      catch (fallbackError) { console.error('Theme scene fallback failed.', fallbackError); }
      console.error('Theme scene update failed.', error);
    }
    return false;
  });
}

/** @param {ThemeParticipant} participant */
export function registerThemeParticipant(participant) {
  const record = { participant, controller: null };
  participants.add(record);
  void applyParticipant(record, theme);
  return () => { record.controller?.abort(); participants.delete(record); };
}

/** @param {Theme} nextTheme */
export async function setTheme(nextTheme, { animate = true } = {}) {
  if (nextTheme !== 'dark' && nextTheme !== 'light') throw new TypeError('Unknown theme.');
  const wasBusy = Boolean(activeWave);
  activeWave?.finish();
  activeWave = null;
  if (nextTheme === theme) return;
  const request = ++revision;
  theme = nextTheme;
  try { localStorage.setItem('portfolio-theme', theme); } catch {}
  const apply = async () => {
    if (request !== revision) return false;
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', nextTheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'light' ? '#F3EFEA' : '#070809');
    updateControls();
    refreshTextInk();
    const results = Promise.all([...participants].map(record => applyParticipant(record, nextTheme)));
    let timer;
    const prepared = await Promise.race([
      results.then(values => values.every(Boolean)),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 250); }),
    ]);
    clearTimeout(timer);
    return Boolean(prepared) && request === revision;
  };
  if (animate && !wasBusy && canAnimateTheme()) {
    const wave = startChessWave(apply);
    activeWave = wave;
    await wave.finished.catch(() => {});
    if (activeWave === wave) activeWave = null;
  } else await apply();
}

function mountControls() {
  updateControls();
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.addEventListener('click', () => { void setTheme(theme === 'dark' ? 'light' : 'dark'); });
  }
  const menu = document.querySelector('.mobile-menu');
  const audio = document.querySelector('[data-floating-audio]');
  if (menu && audio) {
    const syncAudioAvailability = () => { audio.inert = menu.open && getComputedStyle(menu).display !== 'none'; };
    menu.addEventListener('toggle', syncAudioAvailability);
    window.addEventListener('resize', syncAudioAvailability, { passive: true });
  }
}
if (root) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountControls, { once: true });
  else mountControls();
  window.addEventListener('pagehide', () => activeWave?.finish());
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      try {
        const saved = localStorage.getItem('portfolio-theme') === 'light' ? 'light' : 'dark';
        if (saved !== theme) { void setTheme(saved, { animate: false }); return; }
      } catch {}
    }
    updateControls();
  });
}
