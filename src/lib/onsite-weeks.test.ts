import { describe, expect, it } from "vitest";
import {
  buildOnsiteWeekCorporateContext,
  buildOnsiteWeekOfferSnapshot,
  buildOnsiteWeekPassenger,
  buildOnsiteWeekPreviewEmployee,
  buildOnsiteWeekSearchCriteria,
  computeEmployeeEligibility,
  deriveOnsiteWeekStatus,
  isBasedInCuritiba,
  mergeOnsiteWeekOutcomes,
  pickCheapestOffer,
  type OnsiteWeekEmployeeOutcome,
  type TravelProfileFields,
} from "./onsite-weeks";
import type { FlightOffer } from "./types";

const COMPLETE_PROFILE: TravelProfileFields = {
  origin_airport_code: "GRU",
  given_name: "Maria",
  family_name: "Silva",
  born_on: "1990-05-10",
  gender: "f",
  title: "ms",
  phone_number: "+5511999990000",
  email: "maria@demo-paggo.com",
};

const OFFER: FlightOffer = {
  id: "off_1",
  mode: "flight",
  origin: "GRU",
  destination: "CWB",
  destinationCountry: "BR",
  departureAt: "2026-08-10T10:00:00Z",
  returnAt: "2026-08-14T18:00:00Z",
  cabinClass: "economy",
  airline: "LATAM",
  stops: 0,
  refundable: false,
  totalAmount: 1200,
  currency: "BRL",
  rateToBRL: 1,
  expiresAt: "2026-08-01T00:00:00Z",
  owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "", brand_color: "" },
  slices: [
    {
      id: "sl_1",
      origin: "GRU",
      destination: "CWB",
      duration: "PT1H20M",
      fare_brand_name: "Light",
      segments: [
        {
          id: "seg_1",
          origin: { iata_code: "GRU", name: "Guarulhos" },
          destination: { iata_code: "CWB", name: "Afonso Pena" },
          departing_at: "2026-08-10T10:00:00Z",
          arriving_at: "2026-08-10T11:20:00Z",
          duration: "PT1H20M",
          marketing_carrier: { iata_code: "LA", name: "LATAM" },
          operating_carrier: { iata_code: "LA", name: "LATAM" },
          marketing_carrier_flight_number: "3200",
          aircraft: { name: "A320" },
          origin_terminal: null,
          destination_terminal: null,
          baggages: [],
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: { allowed: false },
    change_before_departure: { allowed: false },
  },
  passengerIdentityDocumentsRequired: false,
};

describe("isBasedInCuritiba", () => {
  it("returns true for CWB", () => {
    expect(isBasedInCuritiba("CWB")).toBe(true);
  });
  it("returns false for other airports", () => {
    expect(isBasedInCuritiba("GRU")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isBasedInCuritiba(null)).toBe(false);
  });
});

describe("computeEmployeeEligibility", () => {
  it("returns ok when every travel-profile field is filled in", () => {
    expect(computeEmployeeEligibility(COMPLETE_PROFILE)).toEqual({ status: "ok" });
  });

  it("lists every missing field by label", () => {
    const incomplete: TravelProfileFields = {
      ...COMPLETE_PROFILE,
      origin_airport_code: null,
      born_on: null,
    };
    expect(computeEmployeeEligibility(incomplete)).toEqual({
      status: "missing_profile_data",
      missingFields: ["Cidade de origem", "Data de nascimento"],
    });
  });
});

describe("buildOnsiteWeekPreviewEmployee", () => {
  it("defaults to checked when eligible and not already based in Curitiba", () => {
    const result = buildOnsiteWeekPreviewEmployee({ id: "emp_1", full_name: "Maria Silva", ...COMPLETE_PROFILE });
    expect(result.eligibility).toEqual({ status: "ok" });
    expect(result.default_checked).toBe(true);
  });

  it("defaults to unchecked when already based in Curitiba", () => {
    const result = buildOnsiteWeekPreviewEmployee({
      id: "emp_1",
      full_name: "Maria Silva",
      ...COMPLETE_PROFILE,
      origin_airport_code: "CWB",
    });
    expect(result.default_checked).toBe(false);
  });

  it("defaults to unchecked when profile data is missing", () => {
    const result = buildOnsiteWeekPreviewEmployee({
      id: "emp_1",
      full_name: "Maria Silva",
      ...COMPLETE_PROFILE,
      phone_number: null,
    });
    expect(result.default_checked).toBe(false);
  });
});

describe("buildOnsiteWeekSearchCriteria", () => {
  it("builds a round trip with economy cabin and one adult", () => {
    const result = buildOnsiteWeekSearchCriteria("GRU", "2026-08-10", "2026-08-14");
    expect(result).toEqual({
      slices: [
        { origin: "GRU", destination: "CWB", departure_date: "2026-08-10" },
        { origin: "CWB", destination: "GRU", departure_date: "2026-08-14" },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    });
  });
});

describe("pickCheapestOffer", () => {
  it("returns null for an empty list", () => {
    expect(pickCheapestOffer([])).toBeNull();
  });

  it("picks the offer with the lowest totalAmount", () => {
    const expensive: FlightOffer = { ...OFFER, id: "off_2", totalAmount: 3000 };
    expect(pickCheapestOffer([expensive, OFFER])).toBe(OFFER);
  });
});

describe("buildOnsiteWeekPassenger", () => {
  it("maps the profile's travel fields into a DuffelPassenger", () => {
    const result = buildOnsiteWeekPassenger(COMPLETE_PROFILE);
    expect(result).toEqual({
      id: "pas-1",
      type: "adult",
      title: "ms",
      given_name: "Maria",
      family_name: "Silva",
      born_on: "1990-05-10",
      gender: "f",
      email: "maria@demo-paggo.com",
      phone_number: "+5511999990000",
    });
  });
});

describe("buildOnsiteWeekCorporateContext", () => {
  it("uses internal_meeting as the trip purpose and mentions the dates", () => {
    const result = buildOnsiteWeekCorporateContext("engineering", "2026-08-10", "2026-08-14");
    expect(result.trip_purpose).toBe("internal_meeting");
    expect(result.cost_center).toBe("engineering");
    expect(result.business_justification).toContain("2026-08-10");
    expect(result.business_justification).toContain("2026-08-14");
  });
});

describe("buildOnsiteWeekOfferSnapshot", () => {
  it("maps a FlightOffer into a SelectedOfferSnapshot", () => {
    const result = buildOnsiteWeekOfferSnapshot(OFFER);
    expect(result.offer_id).toBe("off_1");
    expect(result.total_amount).toBe("1200");
    expect(result.total_currency).toBe("BRL");
    expect(result.owner).toEqual({ iata_code: "LA", name: "LATAM", logo_symbol_url: "" });
    expect(result.slices).toEqual([
      {
        origin: "GRU",
        destination: "CWB",
        departure_datetime: "2026-08-10T10:00:00Z",
        arrival_datetime: "2026-08-10T11:20:00Z",
        duration: "PT1H20M",
        segments_count: 1,
        fare_brand_name: "Light",
      },
    ]);
    expect(result.expires_at).toBe("2026-08-01T00:00:00Z");
  });
});

describe("deriveOnsiteWeekStatus", () => {
  it("returns completed when there are no failures", () => {
    expect(deriveOnsiteWeekStatus(5, 0)).toBe("completed");
  });
  it("returns partial when there is at least one failure", () => {
    expect(deriveOnsiteWeekStatus(3, 2)).toBe("partial");
  });
});

describe("mergeOnsiteWeekOutcomes", () => {
  const base: OnsiteWeekEmployeeOutcome[] = [
    { employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" },
    { employee_id: "e2", employee_name: "Bruno", status: "failed", error_message: "sem oferta" },
  ];

  it("replaces outcomes for employee ids present in the update", () => {
    const updated: OnsiteWeekEmployeeOutcome[] = [
      { employee_id: "e2", employee_name: "Bruno", status: "created", request_id: "req_2" },
    ];
    expect(mergeOnsiteWeekOutcomes(base, updated)).toEqual([
      { employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" },
      { employee_id: "e2", employee_name: "Bruno", status: "created", request_id: "req_2" },
    ]);
  });

  it("appends outcomes for employee ids not previously present", () => {
    const updated: OnsiteWeekEmployeeOutcome[] = [
      { employee_id: "e3", employee_name: "Carla", status: "created", request_id: "req_3" },
    ];
    expect(mergeOnsiteWeekOutcomes(base, updated)).toEqual([...base, updated[0]]);
  });
});
