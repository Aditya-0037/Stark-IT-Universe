import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { classroom } from '../lib/classroomState';
import { journey } from '../lib/journey';
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
  stage.vignette = room ? 0.18 : campus ? 0.3 : 0.5;
}

/**
 * Runs first every frame: turns scroll progress (journey) and the HTML
 * controls (classroom state) into the stage state that every 3D object and
 * the camera read. Under Reduce Motion everything is discrete (no flights),
 * and changes are crossfaded by the camera rig.
 */
export function Director({ reduced }: { reduced: boolean }) {
  const last = useRef(0);
  useFrame((_, dt) => {
    const j = journey;
    const step = Math.min(dt, 0.1);

    if (reduced) {
      stage.descent = j.descent;
      applyStill(stage.still);
    } else {
      // The descent follows the scroll with a little damping (on top of the
      // smooth scrolling), so the camera path never jumps.
      // Jumps (a link, a keyboard focus jump, a deep link) snap instead of
      // flying the whole way while another scene is on screen.
      const target = j.toClassroom > 0 ? 1 : j.descent;
      const jump = Math.abs(target - last.current) > 0.15 || j.toClassroom > 0.3 || (target === 0 && j.toRoute < 1);
      last.current = target;
      stage.descent = jump ? target : stage.descent + (target - stage.descent) * (1 - Math.exp(-step * 5));
      if (Math.abs(target - stage.descent) < 1e-4) stage.descent = target;
      const d = stage.descent;
      stage.room = d >= DESCENT_CUT;
      stage.campus = !stage.room && d > 0.16;
      stage.space = !stage.room && d < 0.32;
      stage.clouds = !stage.room && d > 0.05;
      stage.cloudOpacity = smooth(0.05, 0.16, d);
      stage.stars = 1 - smooth(0.04, 0.25, d);
      stage.stretch = smooth(0.01, 0.09, d) * (1 - smooth(0.15, 0.26, d));
      stage.sky = smooth(0.005, 0.26, d);
      // lighter vignette by day; the room's own value before the window cut
      stage.vignette = stage.room ? 0.18 : 0.5 - 0.2 * stage.sky - 0.12 * smooth(0.9, 0.96, d);
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
