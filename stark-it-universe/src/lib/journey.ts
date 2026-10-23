/**
 * Scroll progress of the journey, read every frame by the 3D layer (a
 * plain mutable object, so no React re-renders). Values are 0..1, written
 * from the scroll position by the master timeline (lib/timeline.ts).
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

/**
 * Story values are linear between the items' resting frames: item i rests
 * at value i / (count - 1). The float index (2.5 = halfway from item 2 to 3).
 */
export const floatIndex = (p: number, count: number) => Math.min(count - 1, Math.max(0, p * (count - 1)));

/** The item that is "current" at value p (the nearest resting frame). */
export const activeIndex = (p: number, count: number) => Math.round(floatIndex(p, count));

/** The value at which item i rests. */
export const progressFor = (i: number, count: number) => (count > 1 ? i / (count - 1) : 0);
