const MOVEMENTS = new Set(["opening", "code", "music", "art", "games"]);

export function beatToSeconds(score, beat) {
  const span = score.bars * score.beatsPerBar;
  const loops = Math.floor(Math.max(0, beat) / span);
  const local = Math.max(0, beat) - loops * span;
  const point = score.tempoMap?.findLast(change => change.beat <= local) ?? { beat: 0, seconds: 0, tempo: 60000000 / score.bpm };
  return loops * score.durationSeconds + point.seconds + (local - point.beat) * point.tempo / 1000000;
}

export function secondsToBeat(score, seconds) {
  const loops = Math.floor(Math.max(0, seconds) / score.durationSeconds);
  const local = Math.max(0, seconds) - loops * score.durationSeconds;
  const point = score.tempoMap?.findLast(change => change.seconds <= local) ?? { beat: 0, seconds: 0, tempo: 60000000 / score.bpm };
  return loops * score.bars * score.beatsPerBar + point.beat + (local - point.seconds) * 1000000 / point.tempo;
}

export function createScoreTransport(score, initialMovement = "opening", startBeat = 0, repeat = true) {
  const loopBeats = score.bars * score.beatsPerBar;
  let loop = Math.floor(startBeat / loopBeats);
  let index = score.notes.findIndex(note => note.beat + loop * loopBeats >= startBeat - 1e-6);
  if (index === -1) { loop += 1; index = 0; }
  let scheduledThrough = startBeat;
  let changes = [{ beat: startBeat, movement: initialMovement }];

  function movementAt(beat) {
    return changes.findLast(change => change.beat <= beat + 1e-6)?.movement ?? initialMovement;
  }

  return {
    movementAt,
    setRepeat(value) { repeat = Boolean(value); },
    requestMovement(movement, currentBeat) {
      if (!MOVEMENTS.has(movement)) return;
      // A decision already sent to the audio graph cannot be replaced. New requests
      // replace only unscheduled changes, so rapid scrolling cannot build a queue.
      changes = changes.filter(change => change.beat <= scheduledThrough);
      if (changes.at(-1).movement === movement) return;
      const beat = (Math.floor(Math.max(currentBeat, scheduledThrough) / score.beatsPerBar) + 1) * score.beatsPerBar;
      changes.push({ beat, movement });
    },
    readUntil(endBeat) {
      const events = [];
      while (score.notes.length && index < score.notes.length) {
        const note = score.notes[index];
        const beat = note.beat + loop * loopBeats;
        if (beat > endBeat + 1e-6) break;
        events.push({ ...note, beat, time: note.time + loop * score.durationSeconds, movement: movementAt(beat) });
        index += 1;
        if (index === score.notes.length && repeat) { index = 0; loop += 1; }
      }
      scheduledThrough = Math.max(scheduledThrough, endBeat);
      return events;
    },
    pendingAt(beat) { return changes.find(change => change.beat > beat + 1e-6) ?? null; },
  };
}

export const harmonyNotes = {
  em: [52, 55, 59, 66],
  c: [48, 52, 55, 59],
  am: [45, 48, 52, 55, 59],
};
