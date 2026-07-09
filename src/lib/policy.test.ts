import { describe, expect, it } from "vitest";
import { evaluateDuffelOffer, evaluateOffer, HIGH_COST_THRESHOLD } from "./policy";
import type { FlightOffer, Policy, StayOffer } from "./types";

const domesticFlight: FlightOffer = {
  id: "flt-test-1",
  mode: "flight",
  origin: "GRU",
  destination: "GIG",
  destinationCountry: "BR",
  departureAt: "2026-08-01T10:00:00.000Z",
  cabinClass: "economy",
  airline: "Azul",
  stops: 0,
  refundable: false,
  totalAmount: 450,
  currency: "BRL",
};

const internationalBusinessFlight: FlightOffer = {
  ...domesticFlight,
  id: "flt-test-2",
  destination: "JFK",
  destinationCountry: "US",
  cabinClass: "business",
  totalAmount: HIGH_COST_THRESHOLD + 1000,
};

const domesticStay: StayOffer = {
  id: "sty-test-1",
  mode: "stay",
  city: "São Paulo",
  country: "BR",
  checkIn: "2026-08-01",
  checkOut: "2026-08-03",
  hotelName: "Ibis Budget",
  starRating: 2,
  refundable: true,
  totalAmount: 480,
  currency: "BRL",
};

const orgPolicy: Policy = {
  id: "policy-test-org",
  scope: "organization",
  name: "Política padrão",
  rules: [
    {
      id: "rule-cabin",
      field: "cabinClass",
      operator: "in",
      value: ["economy", "premium_economy"],
      appliesTo: "flight",
      description: "Classe econômica ou premium economy",
    },
    {
      id: "rule-flight-price",
      field: "totalAmount",
      operator: "lte",
      value: 3000,
      appliesTo: "flight",
      description: "Até R$ 3.000 por passagem",
    },
    {
      id: "rule-stay-stars",
      field: "starRating",
      operator: "lte",
      value: 4,
      appliesTo: "stay",
      description: "Até 4 estrelas",
    },
  ],
};

describe("evaluateOffer", () => {
  it("marks a domestic economy flight within price cap as compliant with no flags", () => {
    const result = evaluateOffer(domesticFlight, orgPolicy);

    expect(result.compliant).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.flags).toEqual([]);
  });

  it("flags an international business-class flight as out of policy with both signals", () => {
    const result = evaluateOffer(internationalBusinessFlight, orgPolicy);

    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.id).sort()).toEqual([
      "rule-cabin",
      "rule-flight-price",
    ]);
    expect(result.flags.sort()).toEqual(["cost_above_threshold", "international"]);
  });

  it("only applies stay rules to stay offers, ignoring flight-only rules", () => {
    const result = evaluateOffer(domesticStay, orgPolicy);

    expect(result.compliant).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("violates a stay star-rating cap", () => {
    const luxuryStay: StayOffer = { ...domesticStay, id: "sty-test-2", starRating: 5 };

    const result = evaluateOffer(luxuryStay, orgPolicy);

    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.id)).toEqual(["rule-stay-stars"]);
  });
});

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
