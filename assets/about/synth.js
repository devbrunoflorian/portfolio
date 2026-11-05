const textures = {
  opening: { type: "triangle", attack: .012, release: .45, cutoff: 2100, sustain: .2 },
  code: { type: "sine", attack: .01, release: .28, cutoff: 1300, sustain: .12 },
  music: { type: "triangle", attack: .008, release: .7, cutoff: 3600, sustain: .3 },
  art: { type: "sawtooth", attack: .23, release: .75, cutoff: 950, sustain: .5 },
  games: { type: "square", attack: .006, release: .05, cutoff: 3200, sustain: .17 },
};

export function createSynth(context, volume = .35, trackIds = [], trackVolumes = new Map()) {
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 20;
  compressor.ratio.value = 5;
  master.gain.value = volume;
  master.connect(compressor).connect(context.destination);
  const trackBuses = new Map(trackIds.map(id => {
    const bus = context.createGain();
    bus.gain.value = trackVolumes.get(id) ?? 1;
    bus.connect(master);
    return [id, bus];
  }));
  const voices = new Set();
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .25), context.sampleRate);
  const samples = noise.getChannelData(0);
  let seed = 2471;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[index] = seed / 2147483648 - 1;
  }

  function note(midi, time, duration, movement, velocity = 95, voiceType = "guitar", bend = 0, bendRange = 2, bendEvents = [], trackId = null, loopTail = false) {
    if (!Number.isFinite(midi) || midi < 21 || midi > 108) return;
    const isBass = voiceType === "bass";
    const isDrum = voiceType === "percussion";
    const texture = textures[movement] ?? textures.music;
    const start = Math.max(time, context.currentTime);
    const length = isDrum ? Math.min(duration, .16) : Math.max(.01, duration);
    const attack = isDrum ? .002 : Math.min(texture.attack, length * .65);
    const release = loopTail ? .05 : isDrum ? .06 : texture.release;
    const peak = (isDrum ? .075 : isBass ? .11 : .06) * velocity / 127;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const sources = [];
    if (isDrum) {
      const source = context.createBufferSource();
      source.buffer = noise;
      filter.type = midi < 42 ? "lowpass" : "highpass";
      filter.frequency.value = midi < 42 ? 230 : 1800;
      sources.push(source);
      source.connect(filter);
    } else {
      const oscillator = context.createOscillator();
      const overtone = context.createOscillator();
      const overtoneGain = context.createGain();
      oscillator.type = isBass || voiceType === "vocal" ? "sine" : voiceType === "strings" ? "sawtooth" : texture.type;
      const bentFrequency = value => frequency * 2 ** (value / 8192 * bendRange / 12);
      oscillator.frequency.setValueAtTime(bentFrequency(bend), start);
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(bentFrequency(bend) * (movement === "code" ? 2.002 : 2), start);
      for (const event of bendEvents) {
        oscillator.frequency.setValueAtTime(bentFrequency(event.value), start + event.offset);
        overtone.frequency.setValueAtTime(bentFrequency(event.value) * (movement === "code" ? 2.002 : 2), start + event.offset);
      }
      overtoneGain.gain.value = movement === "music" ? .18 : .06;
      filter.type = "lowpass";
      filter.frequency.value = isBass ? 500 : voiceType === "strings" ? 1300 : texture.cutoff;
      oscillator.connect(filter);
      overtone.connect(overtoneGain).connect(filter);
      sources.push(oscillator, overtone);
    }
    filter.Q.value = .6;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * (isDrum ? .1 : texture.sustain)), start + Math.max(attack + .001, length));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length + release);
    filter.connect(envelope).connect(trackBuses.get(trackId) ?? master);
    let stopped = false;
    const voice = {
      stop() {
        if (stopped) return;
        stopped = true;
        for (const source of sources) {
          try { source.stop(); } catch { /* Already ended. */ }
          source.disconnect();
        }
        filter.disconnect(); envelope.disconnect(); voices.delete(voice);
      },
    };
    voices.add(voice);
    sources[0].onended = () => voice.stop();
    for (const source of sources) {
      source.start(start);
      source.stop(start + length + release + .02);
    }
  }

  return {
    note,
    setTrackVolume(trackId, value) {
      const bus = trackBuses.get(trackId);
      if (!bus) return false;
      trackVolumes.set(trackId, Math.max(0, Math.min(1, value)));
      bus.gain.setTargetAtTime(trackVolumes.get(trackId), context.currentTime, .035);
      return true;
    },
    setVolume(value) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), context.currentTime, .025);
    },
    silence() { for (const voice of [...voices]) voice.stop(); },
    dispose() {
      for (const voice of [...voices]) voice.stop();
      for (const bus of trackBuses.values()) bus.disconnect();
      master.disconnect(); compressor.disconnect();
    },
  };
}
