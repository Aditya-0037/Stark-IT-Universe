/**
 * Scroll progress of the journey, shared by the HTML scenes and the 3D
 * camera. It is a plain mutable object (read every frame by the 3D layer,
 * so no React re-renders). Values are 0..1.
 *
 *  toPlanets  #planets scrolling into view (hero -> first planet)
 *  planets    through the #planets sticky range (planet 1 -> 5)
 *  toRoute    #route scrolling into view (planet 5 -> route overview)
 *  route      through the #route sticky range (station 1 -> 5)
 *  descent      through the #descent sticky range (orbit -> clouds -> campus ->
 *               into the glowing classroom window)
 *  toClassroom  #classroom scrolling into view (campus -> in through a window)
 *  classroom    through the #classroom sticky range (device 1 -> 5)
 *  toSwitch     #switch-on scrolling into view (the room goes dark)
 *  toBuild      #build scrolling into view (lit room shows the configured setup)
 */
export const journey = {
  toPlanets: 0,
  planets: 0,
  toRoute: 0,
  route: 0,
  descent: 0,
  toClassroom: 0,
  classroom: 0,
  toSwitch: 0,
  toBuild: 0,
};

export type JourneyKey = keyof typeof journey;

export const PLANET_COUNT = 5;
export const STATION_COUNT = 5;
export const HOTSPOT_COUNT = 5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Turns sticky progress (0..1) into a float index that rests on each item
 * for most of its slot and moves quickly between items.
 */
export function dwell(p: number, count: number, move = 0.45) {
  const x = Math.min(Math.max(p * count - 0.5, 0), count - 1);
  const i = Math.floor(x);
  const a = (1 - move) / 2;
  return Math.min(i + smoothstep(a, 1 - a, x - i), count - 1);
}

/** The item that is "current" at sticky progress p. */
export const activeIndex = (p: number, count: number) =>
  Math.min(count - 1, Math.max(0, Math.round(p * count - 0.5)));

/** Sticky progress that centres item i. */
export const progressFor = (i: number, count: number) => (i + 0.5) / count;
