import { describe, expect, it } from "vitest";
import { generateOffers } from "./mock-data";
import type { SearchCriteria } from "./types";

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
    max_connections: 1,
    ...overrides,
  };
}

describe("generateOffers", () => {
  it("returns a non-empty deterministic list for a domestic route", () => {
    const first = generateOffers(criteria());
    const second = generateOffers(criteria());
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((o) => o.id)).toEqual(second.map((o) => o.id));
  });

  it("returns an empty list when the destination is ABV", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "ABV", departure_date: "2026-08-10" }] })
    );
    expect(offers).toEqual([]);
  });

  it("marks every domestic offer as not requiring identity documents", () => {
    const offers = generateOffers(criteria());
    expect(offers.every((o) => o.passengerIdentityDocumentsRequired === false)).toBe(true);
  });

  it("marks every international offer as requiring identity documents", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }] })
    );
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.passengerIdentityDocumentsRequired === true)).toBe(true);
  });

  it("includes full slice/segment detail on every offer", () => {
    const [offer] = generateOffers(criteria());
    expect(offer.slices?.[0]?.segments.length).toBeGreaterThan(0);
    expect(offer.owner?.iata_code).toBeTruthy();
    expect(offer.expiresAt).toBeTruthy();
  });

  it("produces a two-slice offer for round-trip criteria", () => {
    const offers = generateOffers(
      criteria({
        slices: [
          { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
          { origin: "GIG", destination: "GRU", departure_date: "2026-08-17" },
        ],
      })
    );
    expect(offers[0].slices).toHaveLength(2);
  });

  it("includes at least one offer expiring within 10 minutes for the near-expiry test route", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "CWB", departure_date: "2026-08-10" }] })
    );
    const now = Date.now();
    expect(
      offers.some((o) => new Date(o.expiresAt!).getTime() - now < 10 * 60 * 1000)
    ).toBe(true);
  });
});
