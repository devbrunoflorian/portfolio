import { activeNotesAt, beatToSeconds, createScoreTransport, secondsToBeat } from "./transport.js";
import { createSynth } from "./synth.js";

export function createJourneyAudio(score, onState, { Context = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  let context, synth, transport, timer;
  let enabled = false;
  let disposed = false;
  let revision = 0;
  let state = "off";
  let volume = .35;
  let repeat = true;
  let highlight = null;
  let desiredMovement = "opening";
  let resumeBeat = 0;
  let origin = 0;
  let lastReport = "";
  const trackIds = new Set(score.tracks.map(track => track.id));
  const span = score.bars * score.beatsPerBar;

  function currentBeat() { return context ? secondsToBeat(score, Math.max(0, context.currentTime - origin)) : resumeBeat; }
  function sectionAt(beat) {
    const local = !repeat && beat >= span ? span - 1e-6 : beat % span;
    return score.sections?.findLast(item => item.beat <= local)?.name ?? "Intro";
  }
  function playbackSnapshot() {
    let beat = resumeBeat;
    if (state === "playing" && context) {
      let outputTime = context.currentTime;
      const stamp = context.getOutputTimestamp?.();
      if (stamp && Number.isFinite(stamp.contextTime) && stamp.contextTime > 0 && Number.isFinite(stamp.performanceTime)) {
        outputTime = Math.min(context.currentTime, stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000);
      }
      beat = secondsToBeat(score, Math.max(0, outputTime - origin));
    }
    beat = !repeat && beat >= span ? span : beat % span;
    return { state, beat, seconds: beatToSeconds(score, beat), section: sectionAt(beat) };
  }
  function resumeHeldNotes() {
    const localBeat = resumeBeat % span;
    const localSeconds = beatToSeconds(score, localBeat);
    for (const note of activeNotesAt(score, resumeBeat)) {
      const elapsed = localSeconds - note.time;
      let bend = note.bend;
      for (const event of note.bendEvents) if (event.offset <= elapsed) bend = event.value;
      const futureBends = note.bendEvents.filter(event => event.offset > elapsed)
        .map(event => ({ offset: event.offset - elapsed, value: event.value }));
      const loopTail = repeat && note.beat + note.duration >= span - 1e-6;
      synth.note(note.midi, context.currentTime + .06, note.durationSeconds - elapsed, desiredMovement,
        note.velocity, note.voice, bend, note.bendRange, futureBends, note.track, loopTail);
    }
  }
  function report(error = null) {
    const beat = state === "playing" ? currentBeat() : resumeBeat;
    const payload = { state, volume, repeat, highlight, section: sectionAt(beat), movement: transport?.movementAt(beat) ?? desiredMovement, pending: state === "playing" ? transport?.pendingAt(beat)?.movement : null, error };
    const signature = JSON.stringify(payload);
    if (signature !== lastReport) { lastReport = signature; onState(payload); }
  }
  function schedule() {
    if (state !== "playing" || !context) return;
    const now = currentBeat();
    for (const event of transport.readUntil(secondsToBeat(score, context.currentTime - origin + .12))) {
      const start = origin + event.time;
      // A stalled foreground frame must not replay a burst of overdue notes.
      if (start < context.currentTime - .06) continue;
      const loopTail = repeat && event.beat + event.duration >= (Math.floor(event.beat / span) + 1) * span - 1e-6;
      synth.note(event.midi, start, event.durationSeconds, event.movement, event.velocity, event.voice,
        event.bend, event.bendRange, event.bendEvents, event.track, loopTail);
    }
    if (!repeat && now >= score.bars * score.beatsPerBar + 2) { pause("finished"); return; }
    report();
  }
  function pause(reason = "paused") {
    enabled = false;
    revision += 1;
    if (state === "playing") resumeBeat = currentBeat();
    state = reason;
    clearInterval(timer);
    synth?.silence();
    if (context && context.state !== "closed") context.suspend().catch(() => {});
    report();
  }

  return {
    get supported() { return Boolean(Context); },
    get playing() { return state === "playing"; },
    get enabled() { return enabled; },
    snapshot: playbackSnapshot,
    async start() {
      if (disposed || enabled) return;
      if (state === "finished") resumeBeat = 0;
      if (!Context) { state = "unavailable"; report(); return; }
      const attempt = ++revision;
      enabled = true;
      state = "starting";
      report();
      try {
        if (!context) {
          context = new Context();
          synth = createSynth(context, volume, [...trackIds]);
          synth.setHighlightTrack(highlight);
          context.onstatechange = () => {
            if (state === "playing" && context.state !== "running") pause();
          };
        }
        // This call is reached only from an explicit sound-button activation.
        await context.resume();
        if (disposed || attempt !== revision || !enabled) {
          if (!enabled && context.state !== "closed") await context.suspend();
          return;
        }
        if (context.state !== "running") throw new Error("Audio context did not start");
        origin = context.currentTime + .06 - beatToSeconds(score, resumeBeat);
        transport = createScoreTransport(score, desiredMovement, resumeBeat, repeat);
        state = "playing";
        resumeHeldNotes();
        schedule();
        timer = setInterval(schedule, 25);
        report();
      } catch (error) {
        if (disposed || attempt !== revision) return;
        pause("error");
        report(error.message);
      }
    },
    pause,
    restart() {
      if (disposed) return;
      resumeBeat = 0;
      if (state !== "playing") { this.start(); return; }
      synth.silence();
      origin = context.currentTime + .06;
      transport = createScoreTransport(score, desiredMovement, 0, repeat);
      schedule();
      report();
    },
    setRepeat(value) {
      repeat = Boolean(value);
      transport?.setRepeat(repeat);
      report();
    },
    setMovement(movement) {
      desiredMovement = movement;
      if (state === "playing") transport.requestMovement(movement, currentBeat());
      report();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
      synth?.setVolume(volume);
      report();
    },
    highlightTrack(trackIdOrNull) {
      if (trackIdOrNull !== null && !trackIds.has(trackIdOrNull)) return false;
      highlight = trackIdOrNull;
      synth?.setHighlightTrack(highlight);
      report();
      return true;
    },
    playNotes(notes) {
      if (state !== "playing" || context.state !== "running") return false;
      notes.forEach((midi, index) => synth.note(midi, context.currentTime + index * .012, .75, "music", 90, "guitar"));
      return true;
    },
    dispose() {
      disposed = true;
      pause();
      synth?.dispose();
      if (context) { context.onstatechange = null; context.close().catch(() => {}); }
    },
  };
}
