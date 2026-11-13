export function initialTrackVolumes(score) {
  const channelVolumes = new Map();
  for (const event of score.controls ?? []) {
    if (event.control === 7) channelVolumes.set(event.channel, event.value / 127);
  }

  const channelsByTrack = new Map(score.tracks.map(track => [track.id, new Set()]));
  for (const note of score.notes) channelsByTrack.get(note.track)?.add(note.channel);

  return new Map(score.tracks.map(track => {
    if (track.voice === 'percussion') return [track.id, 0];
    if (track.voice === 'vocal') return [track.id, 1];
    if (track.voice === 'strings') return [track.id, .18];
    const channels = [...(channelsByTrack.get(track.id) ?? [])];
    const levels = channels.map(channel => channelVolumes.get(channel) ?? 1);
    return [track.id, levels.length ? levels.reduce((total, level) => total + level, 0) / levels.length : 1];
  }));
}
