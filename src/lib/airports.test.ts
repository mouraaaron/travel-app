import { describe, expect, it } from "vitest";
import { findAirportByCode, searchAirports } from "./airports";

describe("searchAirports", () => {
  it("returns both airports for a city with more than one", () => {
    const result = searchAirports("São Paulo");
    expect(result.map((o) => o.code).sort()).toEqual(["CGH", "GRU"]);
  });

  it("matches without diacritics (accent-insensitive)", () => {
    const result = searchAirports("brasilia");
    expect(result.map((o) => o.code)).toEqual(["BSB"]);
  });

  it("matches by airport code directly", () => {
    const result = searchAirports("jfk");
    expect(result.map((o) => o.code)).toEqual(["JFK"]);
  });

  it("returns an empty array for an empty query", () => {
    expect(searchAirports("")).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchAirports("xyzxyz")).toEqual([]);
  });
});

describe("findAirportByCode", () => {
  it("finds an airport by its code, case-insensitively", () => {
    const result = findAirportByCode("gru");
    expect(result?.label).toBe("São Paulo (GRU)");
  });

  it("returns undefined for an unknown code", () => {
    expect(findAirportByCode("ZZZ")).toBeUndefined();
  });
});
