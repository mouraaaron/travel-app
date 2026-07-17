import { describe, expect, it } from "vitest";
import {
  formatFormDate,
  formatTripDateLabel,
  isConfirmEnabled,
  parseFormDate,
} from "./trip-dates-popover-utils";

describe("parseFormDate", () => {
  it("parses a yyyy-MM-dd string into a local Date at midnight", () => {
    expect(parseFormDate("2026-07-17")).toEqual(new Date(2026, 6, 17));
  });

  it("returns undefined for an empty or missing value", () => {
    expect(parseFormDate("")).toBeUndefined();
    expect(parseFormDate(undefined)).toBeUndefined();
  });
});

describe("formatFormDate", () => {
  it("formats a local Date back into yyyy-MM-dd", () => {
    expect(formatFormDate(new Date(2026, 6, 17))).toBe("2026-07-17");
  });

  it("pads single-digit months and days", () => {
    expect(formatFormDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatTripDateLabel", () => {
  it("shows a placeholder when no departure date is set", () => {
    expect(formatTripDateLabel(undefined, "range")).toBe("Selecione a data");
  });

  it("shows only the departure date in single mode", () => {
    expect(formatTripDateLabel("2026-07-17", "single")).toBe("17 jul");
  });

  it("shows only the departure date in range mode with no return date (one-way)", () => {
    expect(formatTripDateLabel("2026-07-17", "range")).toBe("17 jul");
  });

  it("shows both dates in range mode with a return date", () => {
    expect(formatTripDateLabel("2026-07-17", "range", "2026-07-24")).toBe(
      "17 jul — 24 jul"
    );
  });
});

describe("isConfirmEnabled", () => {
  it("is true once a departure date exists, even without a return date", () => {
    expect(isConfirmEnabled("2026-07-17")).toBe(true);
  });

  it("is false with no departure date", () => {
    expect(isConfirmEnabled(undefined)).toBe(false);
  });
});
