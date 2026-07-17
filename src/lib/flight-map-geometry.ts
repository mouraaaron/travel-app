import type { Projection, Region } from "dotted-map";

export interface Point {
  x: number;
  y: number;
}

/** dotted-map config for the flight-path-map background: forces the same
 * linear equirectangular projection and full lat/lng range that
 * `projectPoint` below assumes. dotted-map defaults to a Mercator
 * projection cropped to lat [-56, 71] — mismatched against this file's
 * linear math, which is what originally made flight routes land in the
 * ocean. Any code constructing that DottedMap MUST spread these two
 * constants into the constructor instead of writing its own literals, or
 * the two coordinate systems can drift apart again. */
export const FLIGHT_MAP_PROJECTION: Projection = { name: "equirectangular" };
export const FLIGHT_MAP_REGION: Region = {
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
};

/** Same linear (equirectangular) projection as the Aceternity/21st.dev
 * `world-map` component, so lines drawn here land exactly on that map's
 * dots. viewBox is fixed at 800x400. */
export function projectPoint(lat: number, lng: number): Point {
  return {
    x: (lng + 180) * (800 / 360),
    y: (90 - lat) * (400 / 180),
  };
}

/** Control point for the quadratic Bezier arc between two projected points —
 * pulled 50 units above whichever endpoint is higher on the map (lower y),
 * matching the reference component's fixed "arch upward" look. */
export function curveControlPoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: Math.min(start.y, end.y) - 50,
  };
}

export function curvedPath(start: Point, end: Point): string {
  const control = curveControlPoint(start, end);
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}

/** Point at parameter t (0-1) along the same quadratic Bezier curve drawn by
 * curvedPath — used for the reduced-motion static plane position. */
export function bezierPointAt(t: number, start: Point, control: Point, end: Point): Point {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  };
}

/** Fraction of the flight already elapsed, clamped to [0, 1]. */
export function flightProgress(departureAt: string, arrivalAt: string, now: Date): number {
  const departure = new Date(departureAt).getTime();
  const arrival = new Date(arrivalAt).getTime();
  if (arrival <= departure) return 1;
  const raw = (now.getTime() - departure) / (arrival - departure);
  return Math.min(1, Math.max(0, raw));
}

/** Duration (seconds) and negative begin-offset (seconds) for an
 * <animateMotion dur="{durationSeconds}s" begin="{beginOffsetSeconds}s">
 * that is already mid-flight: a negative `begin` makes SMIL evaluate the
 * timeline as if it had started that many seconds in the past, so the
 * plane renders already-in-progress instead of jumping from the origin. */
export function flightTimingSeconds(
  departureAt: string,
  arrivalAt: string,
  now: Date
): { durationSeconds: number; beginOffsetSeconds: number } {
  const departure = new Date(departureAt).getTime();
  const arrival = new Date(arrivalAt).getTime();
  const durationSeconds = Math.max(1, (arrival - departure) / 1000);
  const elapsedSeconds = (now.getTime() - departure) / 1000;
  return { durationSeconds, beginOffsetSeconds: -elapsedSeconds };
}
