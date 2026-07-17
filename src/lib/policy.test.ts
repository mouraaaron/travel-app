import { describe, expect, it } from "vitest";
import { evaluateDuffelOffer } from "./policy";
import type { FlightOffer } from "./types";

describe("evaluateDuffelOffer", () => {
  const baseFlight: FlightOffer = {
    id: "flt-duffel-1",
    mode: "flight",
    origin: "GRU",
    destination: "GIG",
    destinationCountry: "BR",
    departureAt: "2026-08-01T10:00:00.000Z",
    cabinClass: "economy",
    airline: "Azul",
    stops: 0,
    refundable: false,
    totalAmount: 1200,
    currency: "BRL",
  };

  it("is compliant for a cheap domestic economy flight with no flags", () => {
    const result = evaluateDuffelOffer(baseFlight);
    expect(result.compliant).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.flags).toEqual({ international_travel: false, cost_above_threshold: false });
  });

  it("violates the domestic cost cap above R$3500", () => {
    const result = evaluateDuffelOffer({ ...baseFlight, totalAmount: 4000 });
    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.rule_id)).toEqual(["cost-cap"]);
  });

  it("applies the international cost cap of R$12000 instead of the domestic one", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      destination: "JFK",
      destinationCountry: "US",
      totalAmount: 10000,
    });
    expect(result.compliant).toBe(true);
    expect(result.flags.international_travel).toBe(true);
  });

  it("flags cost_above_threshold above R$8000 even when compliant", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      destination: "JFK",
      destinationCountry: "US",
      totalAmount: 9000,
    });
    expect(result.compliant).toBe(true);
    expect(result.flags.cost_above_threshold).toBe(true);
  });

  it("violates business cabin on a short-haul segment", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      cabinClass: "business",
      longestSegmentHours: 2,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.rule_id)).toEqual(["cabin-long-haul"]);
  });

  it("allows business cabin on a long-haul segment of 8h or more", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      cabinClass: "business",
      longestSegmentHours: 9,
      totalAmount: 3000,
    });
    expect(result.compliant).toBe(true);
  });

  it("accepts custom defaults", () => {
    const result = evaluateDuffelOffer(
      { ...baseFlight, totalAmount: 1000 },
      { domesticCapBRL: 500, internationalCapBRL: 12000, longHaulCabinHours: 8, costFlagBRL: 8000 }
    );
    expect(result.compliant).toBe(false);
  });
});
