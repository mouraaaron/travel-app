import { describe, expect, it } from "vitest";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelRawOffer } from "./types";
import type { SearchCriteria } from "../types";

const CRITERIA: SearchCriteria = {
  slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }],
  passengers: [{ type: "adult" }],
  cabin_class: "economy",
};

const RAW_OFFER: DuffelRawOffer = {
  id: "off_00009hj8QQBiixQQOfvL",
  total_amount: "2850.00",
  total_currency: "BRL",
  expires_at: "2026-08-01T12:00:00Z",
  owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "https://example.com/latam.svg" },
  slices: [
    {
      id: "sli_1",
      origin: { iata_code: "GRU", name: "São Paulo Guarulhos", iata_country_code: "BR" },
      destination: { iata_code: "JFK", name: "New York JFK", iata_country_code: "US" },
      duration: "PT10H30M",
      fare_brand_name: "Economy Basic",
      segments: [
        {
          id: "seg_1",
          origin: { iata_code: "GRU", name: "São Paulo Guarulhos" },
          destination: { iata_code: "JFK", name: "New York JFK" },
          departing_at: "2026-08-10T22:30:00Z",
          arriving_at: "2026-08-11T09:00:00Z",
          duration: "PT10H30M",
          marketing_carrier: { iata_code: "LA", name: "LATAM" },
          operating_carrier: { iata_code: "LA", name: "LATAM" },
          marketing_carrier_flight_number: "8084",
          aircraft: { name: "Boeing 787-9" },
          origin_terminal: "3",
          destination_terminal: "4",
          passengers: [
            {
              passenger_id: "pas_1",
              cabin_class: "economy",
              baggages: [
                { type: "carry_on", quantity: 1 },
                { type: "checked", quantity: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
    change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
  },
  passenger_identity_documents_required: true,
  total_emissions_kg: "180",
};

describe("mapDuffelOfferToFlightOffer", () => {
  it("maps the flat legacy fields from the raw Duffel offer", () => {
    const offer = mapDuffelOfferToFlightOffer(RAW_OFFER, CRITERIA, 1);

    expect(offer.id).toBe("off_00009hj8QQBiixQQOfvL");
    expect(offer.origin).toBe("GRU");
    expect(offer.destination).toBe("JFK");
    expect(offer.destinationCountry).toBe("US");
    expect(offer.airline).toBe("LATAM");
    expect(offer.stops).toBe(0);
    expect(offer.refundable).toBe(false);
    expect(offer.totalAmount).toBe(2850);
    expect(offer.currency).toBe("BRL");
    expect(offer.cabinClass).toBe("economy");
  });

  it("maps the Duffel-shaped fields (slices, owner, conditions)", () => {
    const offer = mapDuffelOfferToFlightOffer(RAW_OFFER, CRITERIA, 1);

    expect(offer.slices).toHaveLength(1);
    expect(offer.slices?.[0].segments[0].baggages).toEqual([
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: 1 },
    ]);
    expect(offer.owner?.iata_code).toBe("LA");
    expect(offer.conditions?.change_before_departure.allowed).toBe(true);
    expect(offer.passengerIdentityDocumentsRequired).toBe(true);
    expect(offer.totalEmissionsKg).toBe(180);
    expect(offer.longestSegmentHours).toBeCloseTo(10.5);
  });

  it("computes a round-trip destination as the outbound slice's destination", () => {
    const roundTripCriteria: SearchCriteria = {
      slices: [
        { origin: "GRU", destination: "JFK", departure_date: "2026-08-10" },
        { origin: "JFK", destination: "GRU", departure_date: "2026-08-17" },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    };
    const roundTripOffer: DuffelRawOffer = {
      ...RAW_OFFER,
      slices: [
        RAW_OFFER.slices[0],
        {
          ...RAW_OFFER.slices[0],
          id: "sli_2",
          origin: { iata_code: "JFK", name: "New York JFK", iata_country_code: "US" },
          destination: { iata_code: "GRU", name: "São Paulo Guarulhos", iata_country_code: "BR" },
        },
      ],
    };

    const offer = mapDuffelOfferToFlightOffer(roundTripOffer, roundTripCriteria, 1);
    expect(offer.origin).toBe("GRU");
    expect(offer.destination).toBe("JFK");
  });
});

describe("mapDuffelOfferToFlightOffer currency conversion", () => {
  it("converts totalAmount and penalty_amount using the given exchange rate", () => {
    const usdOffer: DuffelRawOffer = {
      ...RAW_OFFER,
      total_amount: "500.00",
      total_currency: "USD",
      conditions: {
        refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "USD" },
      },
    };

    const offer = mapDuffelOfferToFlightOffer(usdOffer, CRITERIA, 5.5);

    expect(offer.totalAmount).toBe(2750);
    expect(offer.currency).toBe("BRL");
    expect(offer.rateToBRL).toBe(5.5);
    expect(offer.conditions?.change_before_departure.penalty_amount).toBe("825.00");
    expect(offer.conditions?.change_before_departure.penalty_currency).toBe("BRL");
    expect(offer.conditions?.refund_before_departure.penalty_amount).toBeUndefined();
  });
});
