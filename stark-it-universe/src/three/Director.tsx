import { useFrame } from '@react-three/fiber';
import { classroom } from '../lib/classroomState';
import { journey } from '../lib/journey';
import { DIVE, litAt } from './dive';
import { DESCENT_CUT, stage, smooth } from './stage';

/**
 * Reduce Motion: the regions for one still of the descent ('sky' with
 * clouds, 'campus' aerial, 'room'). Called by the camera rig at the moment
 * it cuts, so the stage and the camera change in the same frame.
 */
export function applyStill(still: typeof stage.still) {
  const room = journey.toClassroom >= 0.5 || still === 'room';
  const campus = !room && (still === 'sky' || still === 'campus');
  stage.room = room;
  stage.campus = campus;
  stage.space = !room && !campus;
  stage.clouds = campus;
  stage.cloudOpacity = campus ? 1 : 0;
  stage.stars = stage.space ? 1 : 0;
  stage.stretch = 0;
  stage.sky = campus ? 1 : 0;
  stage.portal = 0;
  stage.windowLit = campus || room ? 1 : 0;
  stage.vignette = room ? 0.18 : 0.2;
}

/**
 * Runs first every frame: turns scroll progress (journey) and the HTML
 * controls (classroom state) into the stage state that every 3D object and
 * the camera read. Under Reduce Motion everything is discrete (no flights),
 * and changes are crossfaded by the camera rig.
 */
export function Director({ reduced }: { reduced: boolean }) {
  useFrame((_, dt) => {
    const j = journey;
    const step = Math.min(dt, 0.1);

    if (reduced) {
      stage.descent = j.descent;
      applyStill(stage.still);
    } else {
      // The journey is already damped (the master timeline's playhead).
      stage.descent = j.toClassroom > 0 ? 1 : j.descent;
      const d = stage.descent;
      stage.room = d >= DESCENT_CUT;
      // space and the campus never show together: they swap inside the
      // cloud deck, while the frame is fully clouded (see dive.ts)
      stage.campus = !stage.room && d >= DIVE.swap;
      stage.space = !stage.room && d < DIVE.swap;
      stage.clouds = !stage.room && d > 0.03 && d < 0.62;
      stage.cloudOpacity = smooth(0.05, 0.12, d);
      stage.stars = 1 - smooth(0.05, 0.2, d);
      stage.stretch = 0;
      stage.sky = smooth(0.002, 0.06, d);
      stage.windowLit = stage.room ? 1 : litAt(d);
      // lighter vignette by day; the room's own value before the window cut
      // a light vignette only, so the space night stays the brand night to the edges
      stage.vignette = stage.room ? 0.18 : 0.2 - 0.02 * smooth(0.9, 0.96, d);
    }

    // In the Classroom scene the room is lit (board, projector, lights on);
    // in Switch on it follows the slider and the Day / Night toggle.
    // In Build the room is lit again (day) and shows the configured setup.
    const sw = reduced ? (j.toSwitch >= 0.5 ? 1 : 0) : smooth(0.15, 0.7, j.toSwitch);
    const back = reduced ? (j.toBuild >= 0.5 ? 1 : 0) : smooth(0.1, 0.6, j.toBuild);
    const inSwitch = sw * (1 - back);
    const targetPower = 3 + (classroom.power - 3) * inSwitch;
    const targetNight = (classroom.night ? 1 : 0) * inSwitch;
    stage.config = j.toBuild >= 0.5;
    const k = 1 - Math.exp(-step * 6);
    stage.power += (targetPower - stage.power) * k;
    stage.night += (targetNight - stage.night) * (1 - Math.exp(-step * 4));
  }, -5);

  return null;
}
