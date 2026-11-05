const SVG_NS = "http://www.w3.org/2000/svg";
const SPAN_BEATS = 16;
const LANE_Y = [125, 165, 205, 245, 312];
const STRENGTH = { opening: .45, code: .18, music: 1, art: .72, games: .48, closing: .22 };

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

// These lanes are a graphic reading of the opening motif, not a transcription
// of formal voices in the polyphonic guitar part.
export function motifLanes(score) {
  const lanes = Array.from({ length: 5 }, () => []);
  for (const note of score.notes) {
    if (note.beat >= SPAN_BEATS) break;
    if (note.voice !== "guitar" && note.voice !== "bass") continue;
    const lane = note.voice === "bass" ? 4 : note.midi < 48 ? 0 : note.midi < 54 ? 1 : note.midi < 60 ? 2 : 3;
    lanes[lane].push({ beat: note.beat, midi: note.midi, velocity: note.velocity });
  }
  return lanes.map(notes => notes.filter((_, index) => index % Math.max(1, Math.ceil(notes.length / 28)) === 0));
}

function pointsFor(notes, lane, chapter, progress, tension) {
  const base = LANE_Y[lane];
  const strength = STRENGTH[chapter];
  const points = notes.map(note => {
    const x = 35 + note.beat / SPAN_BEATS * 930;
    const pitchY = clamp(245 - (note.midi - 45) * 3.1, 55, 345);
    let y = base + (pitchY - base) * strength;
    if (chapter === "art") y += Math.sin(x / 115 + lane) * 12;
    if (chapter === "games") y = Math.round(y / 18) * 18;
    if (tension && (chapter === "music" || chapter === "art")) y += Math.sin(x / 42 + lane * 1.6 + progress * 2) * 6;
    return { x, y, velocity: note.velocity };
  });
  if (!points.length) return [{ x: 0, y: base }, { x: 1000, y: base }];
  return [{ x: 0, y: points[0].y }, ...points, { x: 1000, y: points.at(-1).y }];
}

function curve(points) {
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1], next = points[index];
    const reach = (next.x - before.x) * .42;
    d += ` C ${(before.x + reach).toFixed(1)} ${before.y.toFixed(1)} ${(next.x - reach).toFixed(1)} ${next.y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return d;
}

export function createScoreVisual(root, score) {
  const motif = motifLanes(score);
  const scenes = [...root.querySelectorAll("[data-score-scene]")].map(host => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 400");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const paths = motif.map((_, lane) => {
      const base = document.createElementNS(SVG_NS, "path");
      base.setAttribute("class", "score-thread score-thread-base");
      base.setAttribute("data-thread", String(lane));
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "score-thread");
      path.setAttribute("data-thread", String(lane));
      path.setAttribute("pathLength", "1");
      svg.append(base, path);
      return { base, path };
    });
    const attacks = motif.flatMap((notes, lane) => [notes[Math.floor(notes.length * .35)], notes[Math.floor(notes.length * .7)]]
      .filter(Boolean).map(note => {
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("class", "score-attack");
        circle.setAttribute("r", lane === 4 ? "2.5" : "2");
        svg.append(circle);
        return { circle, lane, note };
      }));
    host.replaceChildren(svg);
    return { host, chapter: host.dataset.scoreScene, paths, attacks };
  });

  function update({ chapter, progress, motionEnabled, playbackSnapshot = null }) {
    const tension = root.dataset.scoreStudy === "b";
    for (const scene of scenes) {
      if (scene.chapter !== chapter) continue;
      const local = motionEnabled ? clamp(progress, 0, 1) : .7;
      const lanes = motif.map((notes, lane) => pointsFor(notes, lane, chapter, local, tension));
      scene.paths.forEach(({ base, path }, lane) => {
        const shape = curve(lanes[lane]);
        base.setAttribute("d", shape);
        path.setAttribute("d", shape);
        path.style.strokeDashoffset = motionEnabled ? String(Math.max(0, .55 - local * .55)) : "0";
      });
      for (const { circle, lane, note } of scene.attacks) {
        const source = lanes[lane].find(point => Math.abs(point.x - (35 + note.beat / SPAN_BEATS * 930)) < .1);
        if (!source) continue;
        circle.setAttribute("cx", source.x.toFixed(1));
        circle.setAttribute("cy", source.y.toFixed(1));
        circle.style.opacity = !motionEnabled || source.x < local * 1000 + 80 ? String(clamp(note.velocity / 127 * .8, .2, .7)) : "0";
      }
      // The visual study has no playhead. A later slice will consume the audio snapshot.
      void playbackSnapshot;
    }
  }

  for (const scene of scenes) update({ chapter: scene.chapter, progress: .5, motionEnabled: false });
  return { update, dispose() { scenes.forEach(scene => scene.host.replaceChildren()); } };
}
