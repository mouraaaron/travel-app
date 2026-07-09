import { describe, expect, it } from "vitest";
import { COUNTRIES, findAirportByCode, isInternational, searchAirports } from "./airports";

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

describe("isInternational", () => {
  it("returns false for a Brazilian airport", () => {
    expect(isInternational("GRU")).toBe(false);
  });

  it("returns true for a non-Brazilian airport", () => {
    expect(isInternational("JFK")).toBe(true);
  });

  it("returns false for an unknown code (fail safe, treat as domestic)", () => {
    expect(isInternational("ZZZ")).toBe(false);
  });
});

describe("COUNTRIES", () => {
  it("includes Brazil with dial code 55", () => {
    const brazil = COUNTRIES.find((c) => c.iso2 === "BR");
    expect(brazil).toEqual({ name: "Brasil", iso2: "BR", dialCode: "55" });
  });

  it("has at least 10 countries for the passport/phone dropdowns", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("extended CITIES coverage", () => {
  it("resolves new airports added for the Duffel-shaped mock scenarios", () => {
    expect(findAirportByCode("NRT")?.sublabel).toContain("Narita");
    expect(findAirportByCode("CNF")?.sublabel).toContain("Confins");
    expect(findAirportByCode("ABV")).toBeDefined();
  });
});
