import DottedMap from "dotted-map";
import { describe, expect, it } from "vitest";
import {
  bezierPointAt,
  curvedPath,
  curveControlPoint,
  FLIGHT_MAP_PROJECTION,
  FLIGHT_MAP_REGION,
  flightProgress,
  flightTimingSeconds,
  projectPoint,
} from "./flight-map-geometry";

describe("FLIGHT_MAP_PROJECTION / FLIGHT_MAP_REGION", () => {
  it("produces a DottedMap with an exact 2:1 aspect ratio, matching the 800x400 overlay viewBox", () => {
    const map = new DottedMap({
      height: 100,
      grid: "diagonal",
      projection: FLIGHT_MAP_PROJECTION,
      region: FLIGHT_MAP_REGION,
    });
    expect(map.width).toBe(map.height * 2);
  });
});

describe("projectPoint", () => {
  it("projects the equator/prime-meridian origin to the center of the 800x400 viewBox", () => {
    expect(projectPoint(0, 0)).toEqual({ x: 400, y: 200 });
  });

  it("projects the top-left corner (lat 90, lng -180) to (0, 0)", () => {
    expect(projectPoint(90, -180)).toEqual({ x: 0, y: 0 });
  });

  it("projects the bottom-right corner (lat -90, lng 180) to (800, 400)", () => {
    expect(projectPoint(-90, 180)).toEqual({ x: 800, y: 400 });
  });
});

describe("curveControlPoint / curvedPath", () => {
  it("places the control point 50 units above the higher of the two endpoints (lower y)", () => {
    const start = { x: 100, y: 200 };
    const end = { x: 300, y: 100 };
    expect(curveControlPoint(start, end)).toEqual({ x: 200, y: 50 });
  });

  it("builds a quadratic Bezier path string through start, control, and end", () => {
    const start = { x: 100, y: 200 };
    const end = { x: 300, y: 100 };
    expect(curvedPath(start, end)).toBe("M 100 200 Q 200 50 300 100");
  });
});

describe("bezierPointAt", () => {
  const start = { x: 0, y: 0 };
  const control = { x: 50, y: -50 };
  const end = { x: 100, y: 0 };

  it("returns the start point at t=0", () => {
    expect(bezierPointAt(0, start, control, end)).toEqual({ x: 0, y: 0 });
  });

  it("returns the end point at t=1", () => {
    expect(bezierPointAt(1, start, control, end)).toEqual({ x: 100, y: 0 });
  });

  it("returns the curve's midpoint (not the straight-line midpoint) at t=0.5", () => {
    expect(bezierPointAt(0.5, start, control, end)).toEqual({ x: 50, y: -25 });
  });
});

describe("flightProgress", () => {
  it("returns 0 before departure", () => {
    const now = new Date("2026-07-16T10:00:00Z");
    expect(flightProgress("2026-07-16T12:00:00Z", "2026-07-16T16:00:00Z", now)).toBe(0);
  });

  it("returns 1 after arrival", () => {
    const now = new Date("2026-07-16T18:00:00Z");
    expect(flightProgress("2026-07-16T12:00:00Z", "2026-07-16T16:00:00Z", now)).toBe(1);
  });

  it("returns the fraction of elapsed flight time while in the air", () => {
    const now = new Date("2026-07-16T13:00:00Z");
    expect(flightProgress("2026-07-16T12:00:00Z", "2026-07-16T16:00:00Z", now)).toBe(0.25);
  });

  it("returns 1 for a zero-duration slice instead of dividing by zero", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    expect(flightProgress("2026-07-16T12:00:00Z", "2026-07-16T12:00:00Z", now)).toBe(1);
  });
});

describe("flightTimingSeconds", () => {
  it("computes duration in seconds and a negative begin offset equal to elapsed time", () => {
    const now = new Date("2026-07-16T13:00:00Z"); // 1h into a 4h flight
    const result = flightTimingSeconds("2026-07-16T12:00:00Z", "2026-07-16T16:00:00Z", now);
    expect(result.durationSeconds).toBe(4 * 60 * 60);
    expect(result.beginOffsetSeconds).toBe(-(60 * 60));
  });

  it("never returns a zero/negative duration, to keep the SMIL animation valid", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    const result = flightTimingSeconds("2026-07-16T12:00:00Z", "2026-07-16T12:00:00Z", now);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });
});
