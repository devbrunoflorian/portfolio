import { beatToSeconds, createScoreTransport, secondsToBeat } from "./transport.js";
import { createSynth } from "./synth.js";

export function createJourneyAudio(score, onState, { Context = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  let context, synth, transport, timer;
  let enabled = false;
  let disposed = false;
  let revision = 0;
  let state = "off";
  let volume = .35;
  let repeat = true;
  let desiredMovement = "opening";
  let resumeBeat = 0;
  let origin = 0;
  let lastReport = "";

  function currentBeat() { return context ? secondsToBeat(score, Math.max(0, context.currentTime - origin)) : resumeBeat; }
  function report(error = null) {
    const beat = state === "playing" ? currentBeat() : resumeBeat;
    const section = score.sections?.findLast(item => item.beat <= beat % (score.bars * score.beatsPerBar))?.name ?? "Intro";
    const payload = { state, volume, repeat, section, movement: transport?.movementAt(beat) ?? desiredMovement, pending: state === "playing" ? transport?.pendingAt(beat)?.movement : null, error };
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
      synth.note(event.midi, start, event.durationSeconds, event.movement, event.velocity, event.voice, event.bend, event.bendRange, event.bendEvents);
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
          synth = createSynth(context, volume);
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
