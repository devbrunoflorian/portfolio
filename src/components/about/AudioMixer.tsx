import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { sendAudioCommand } from './audio-contract';
import type { Locale } from '../../content/site';

interface Track { id: number; name: string; initialVolume: number }
interface Props { locale: Locale; tracks: Track[] }


export default function AudioMixer({ locale, tracks }: Props) {
  const mixerRef = useRef<HTMLDetailsElement>(null);
  const english = locale === 'en';
  const copy = english ? {
    title: 'Track mixer',
    description: 'Both vocal lines lead the mix. Guitar and strings sit behind them.',
    tracks: 'Individual track volume controls',
    volume: 'Volume',
    masterVolume: 'Overall volume',
    repeat: 'Repeat the piece',
    restore: 'Restore mix',
    restored: 'Mix restored.',
    restart: 'Restart Dissonância',
  } : {
    title: 'Mixer da peça',
    description: 'As duas vozes ficam à frente. Violão e cordas entram ao fundo.',
    tracks: 'Controles de volume por pista',
    volume: 'Volume',
    masterVolume: 'Volume geral',
    repeat: 'Repetir a peça',
    restore: 'Restaurar mix',
    restored: 'Mix restaurada.',
    restart: 'Reiniciar Dissonância',
  };
  const [trackVolumes, setTrackVolumes] = useState<Record<number, number>>(() =>
    Object.fromEntries(tracks.map(track => [track.id, track.initialVolume])),
  );
  const [masterVolume, setMasterVolume] = useState(.35);
  const [repeat, setRepeat] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const mixer = mixerRef.current;
    if (mixer) mixer.dataset.audioMixerReady = 'true';
    return () => { if (mixer) delete mixer.dataset.audioMixerReady; };
  }, []);

  function updateTrack(trackId: number, event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.currentTarget.value);
    setTrackVolumes(current => ({ ...current, [trackId]: value }));
    setFeedback('');
    sendAudioCommand({ type: 'track-volume', trackId, value });
  }

  function updateMaster(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.currentTarget.value);
    setMasterVolume(value);
    sendAudioCommand({ type: 'master-volume', value });
  }

  function updateRepeat(event: ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.checked;
    setRepeat(value);
    sendAudioCommand({ type: 'repeat', value });
  }

  function restoreMix() {
    setTrackVolumes(Object.fromEntries(tracks.map(track => [track.id, track.initialVolume])));
    setFeedback(copy.restored);
    sendAudioCommand({ type: 'restore-tracks' });
  }

  return (
    <details className="about-mixer" id="music-mixer" ref={mixerRef}>
      <summary>{copy.title} <span aria-hidden="true">＋</span></summary>
      <div className="mixer-content">
        <p>{copy.description}</p>
        <div data-track-mixer role="group" aria-label={copy.tracks}>
          {tracks.map(track => {
            const value = trackVolumes[track.id] ?? track.initialVolume;
            return (
              <label className="about-mixer-row" key={track.id}>
                <span>{track.name}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={value}
                  aria-label={`${track.name} volume`}
                  onChange={event => updateTrack(track.id, event)}
                />
                <output>{Math.round(value * 100)}%</output>
              </label>
            );
          })}
        </div>
        <div className="mixer-adjustments">
          <label className="mixer-master">
            {copy.volume}
            <input
              type="range"
              min="0"
              max="1"
              step=".01"
              value={masterVolume}
              data-main-volume
              aria-label={copy.masterVolume}
              onChange={updateMaster}
            />
          </label>
          <label className="mixer-repeat">
            <input type="checkbox" data-repeat checked={repeat} onChange={updateRepeat} /> {copy.repeat}
          </label>
          <div className="mixer-actions">
            <button type="button" data-mix-reset onClick={restoreMix}>{copy.restore}</button>
            <button type="button" data-audio-restart onClick={() => sendAudioCommand({ type: 'restart' })}>{copy.restart}</button>
          </div>
          <span className="mixer-feedback" data-mixer-feedback role="status">{feedback}</span>
        </div>
      </div>
    </details>
  );
}
