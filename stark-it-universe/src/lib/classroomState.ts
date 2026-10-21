/**
 * Classroom state shared by the HTML scenes (Classroom, Switch on, and the
 * configurator) and the 3D classroom. Plain mutable object, read every
 * frame by the 3D layer.
 *
 *  accent   scene accent colour (one of the five planet colours)
 *  power    Switch on progress, 0..4 (float while dragging):
 *           0 dark, 1 smart board, 2 projector, 3 lights, 4 lesson slide
 *  night    Day / Night toggle in the Switch on scene
 *  setup    the configurator's choices (Build your classroom scene)
 */
export interface ClassroomSetup {
  rooms: number;
  display: 'ifp' | 'projector' | 'both';
  laptops: number;
  desktops: number;
  networking: boolean;
  amc: boolean;
}

export const DEFAULT_SETUP: ClassroomSetup = {
  rooms: 1,
  display: 'ifp',
  laptops: 0,
  desktops: 0,
  networking: false,
  amc: false,
};

export const classroom = {
  accent: '#8B5CF6',
  power: 0,
  night: true,
  setup: { ...DEFAULT_SETUP } as ClassroomSetup,
};
