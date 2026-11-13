import { useEffect, useRef, useState } from 'react';
import { sendAudioCommand } from './audio-contract';
import type { Locale } from '../../content/site';

type PlaybackState = 'off' | 'starting' | 'playing' | 'paused' | 'finished' | 'error' | 'unavailable';

interface Props { locale: Locale }

const eventName = 'about-audio-state';

export default function AudioPlayerToggle({ locale }: Props) {
  const [state, setState] = useState<PlaybackState>('off');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const english = locale === 'en';
  const playing = state === 'playing' || state === 'starting';
  const label = playing
    ? (english ? 'Pause Dissonância' : 'Pausar Dissonância')
    : state === 'paused'
      ? (english ? 'Continue Dissonância' : 'Continuar Dissonância')
      : (english ? 'Play Dissonância' : 'Reproduzir Dissonância');

  useEffect(() => {
    const button = buttonRef.current;
    if (button) button.dataset.audioPlayerReady = 'true';
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: PlaybackState }>).detail;
      if (detail?.state) setState(detail.state);
    };
    window.addEventListener(eventName, update);
    return () => {
      window.removeEventListener(eventName, update);
      if (button) delete button.dataset.audioPlayerReady;
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      className="about-sound-toggle"
      type="button"
      data-play-toggle
      data-playing={String(playing)}
      aria-label={label}
      title={label}
      aria-pressed={playing}
      onClick={() => sendAudioCommand({ type: 'toggle' })}
    >
      <svg data-sound-icon="muted" viewBox="0 0 24 24" aria-hidden="true" style={{ display: playing ? 'none' : undefined }}>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="m16 9 5 6m0-6-5 6" />
      </svg>
      <svg data-sound-icon="on" viewBox="0 0 24 24" aria-hidden="true" style={{ display: playing ? undefined : 'none' }}>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
