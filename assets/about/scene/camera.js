import {
  SCORE_CAMERA_POSE_STOPS,
  createScoreCurve,
  createScoreJourneyCurve,
} from "../../about-legacy/score-camera-journey.js";
import { measureJourneyFrames } from "../../about-legacy/score-gpu-frame.js";

const MOBILE_ZOOM = [1.08, .79, 2.4, 1.14, .68, .68];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
};

// Blend overlapping reading zones instead of switching to the nearest chapter.
// A nearest-chapter switch reverses the offset abruptly at the midpoint.
export function readingOffset(centers, readingLine, height) {
  let offset = 0, total = 0;
  for (const center of centers) {
    const distance = center - readingLine;
    const weight = 1 - smooth((Math.abs(distance) / height - .12) / .36);
    offset += clamp(distance, -height * .12, height * .12) * weight;
    total += weight;
  }
  return offset / Math.max(1, total);
}

function cameraAnchors(root) {
  const chapters = [...root.querySelectorAll("[data-chapter]")];
  if (chapters.length !== SCORE_CAMERA_POSE_STOPS.desktop.length) {
    throw new Error("The About camera needs one anchor for each of its six chapters.");
  }
  const anchors = chapters.map(chapter => chapter.querySelector("[data-score-anchor]") ?? chapter);
  return { chapters, anchors };
}

export function createAboutCamera(root) {
  let layout = null;

  function measure() {
    const { chapters, anchors } = cameraAnchors(root);
    const centers = anchors.map(anchor => {
      const bounds = anchor.getBoundingClientRect();
      return bounds.top + window.scrollY + bounds.height / 2;
    });
    const mobile = window.innerWidth <= 700;
    const poses = mobile ? SCORE_CAMERA_POSE_STOPS.mobile : SCORE_CAMERA_POSE_STOPS.desktop;
    const zooms = mobile
      ? MOBILE_ZOOM
      : [1.06, .82, Math.min(.96, 1630 / (window.innerWidth * .94)), 1.12, .69, .66];
    const frames = measureJourneyFrames(anchors, poses, zooms, mobile);
    // The decorative mobile anchor overflows the viewport; frame the visible stage.
    if (mobile) frames[0] = { x: window.innerWidth * .10, y: -window.innerHeight * .36 };
    const curve = values => createScoreCurve(centers, values, .65);

    layout = {
      chapters,
      mobile,
      centers,
      poses,
      zooms,
      journey: createScoreJourneyCurve(centers, .65),
      pose: curve(poses),
      zoom: curve(zooms),
      offsetX: curve(frames.map(frame => frame.x)),
      offsetY: curve(frames.map(frame => frame.y)),
    };
    return layout;
  }

  function sample(chapterName) {
    const current = layout ?? measure();
    const readingLine = window.scrollY + window.innerHeight * .52;
    const journey = current.journey(readingLine);
    const chapterIndex = Math.max(0, current.chapters.findIndex(chapter => chapter.dataset.chapter === chapterName));
    const pose = current.pose(readingLine).value;
    const zoom = current.zoom(readingLine).value;
    const offsetX = current.offsetX(readingLine).value;
    const offsetY = current.offsetY(readingLine).value;
    const readingShift = readingOffset(current.centers, readingLine, window.innerHeight);
    const artProgress = clamp((readingLine - current.centers[2])
      / (current.centers[3] - current.centers[2]), 0, 1);
    const passage = Math.sin(Math.PI * artProgress) ** 2;


    return {
      chapter: chapterName,
      journey: journey.normalizedProgress * (current.chapters.length - 1),
      pose,
      zoom: current.mobile ? zoom : zoom * (1 + passage * .55),
      materialClose: passage,
      frameOffset: { x: offsetX, y: offsetY + readingShift + passage * window.innerHeight * .16 },
      settledPose: current.poses[chapterIndex],
      settledZoom: current.zooms[chapterIndex],
      settledFrameOffset: {
        x: current.offsetX(current.centers[chapterIndex]).value,
        y: current.offsetY(current.centers[chapterIndex]).value,
      },
    };
  }

  return {
    sample,
    invalidate() { measure(); },
  };
}
