import { describe, expect, it } from "vitest";
import { COUNTRIES, findAirportByCode, isInternational, isInternationalRoute, searchAirports } from "./airports";

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

describe("isInternationalRoute", () => {
  it("returns false when both origin and destination are domestic", () => {
    expect(isInternationalRoute("GRU", "CNF")).toBe(false);
  });

  it("returns true when only the destination is international", () => {
    expect(isInternationalRoute("GRU", "JFK")).toBe(true);
  });

  it("returns true when only the origin is international (return leg)", () => {
    expect(isInternationalRoute("JFK", "GRU")).toBe(true);
  });

  it("returns true when both origin and destination are international", () => {
    expect(isInternationalRoute("JFK", "LHR")).toBe(true);
  });

  it("returns false when both codes are unknown (fail safe, treat as domestic)", () => {
    expect(isInternationalRoute("ZZZ", "YYY")).toBe(false);
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

describe("airport coordinates", () => {
  it("returns numeric lat/lng for every airport in the catalog", () => {
    for (const code of ["GRU", "CGH", "JFK", "LHR", "NRT", "ABV", "DXB"]) {
      const airport = findAirportByCode(code);
      expect(airport).toBeDefined();
      expect(typeof airport?.lat).toBe("number");
      expect(typeof airport?.lng).toBe("number");
    }
  });

  it("places GRU (São Paulo/Guarulhos) in the southern hemisphere, west of the prime meridian", () => {
    const gru = findAirportByCode("GRU");
    expect(gru?.lat).toBeLessThan(0);
    expect(gru?.lng).toBeLessThan(0);
  });

  it("places LHR (London Heathrow) in the northern hemisphere, west of the prime meridian", () => {
    const lhr = findAirportByCode("LHR");
    expect(lhr?.lat).toBeGreaterThan(0);
    expect(lhr?.lng).toBeLessThan(0);
  });

  it("places NRT (Tokyo Narita) in the northern hemisphere, east of the prime meridian", () => {
    const nrt = findAirportByCode("NRT");
    expect(nrt?.lat).toBeGreaterThan(0);
    expect(nrt?.lng).toBeGreaterThan(0);
  });

  it("returns lat/lng for every airport returned by a broad search", () => {
    for (const option of searchAirports("a")) {
      expect(typeof option.lat).toBe("number");
      expect(typeof option.lng).toBe("number");
    }
  });
});
