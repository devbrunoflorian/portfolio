export type AudioCommand =
  | { type: 'toggle' | 'restart' | 'restore-tracks' }
  | { type: 'track-volume'; trackId: number; value: number }
  | { type: 'master-volume'; value: number }
  | { type: 'repeat'; value: boolean };

export function sendAudioCommand(detail: AudioCommand) {
  window.dispatchEvent(new CustomEvent('about-audio-command', { detail }));
}
