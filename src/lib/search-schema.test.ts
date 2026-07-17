import { describe, expect, it } from "vitest";
import { tripSearchSchema, tripSearchToCriteria } from "./search-schema";

describe("tripSearchSchema", () => {
  const validOneWay = {
    tripType: "one_way" as const,
    slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: "economy" as const,
    maxConnections: 1 as const,
    arriveByOutboundEnabled: false,
    departAfterReturnEnabled: false,
  };

  it("accepts a valid one-way search", () => {
    expect(tripSearchSchema.safeParse(validOneWay).success).toBe(true);
  });

  it("requires a return date for round trips", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, tripType: "round_trip" });
    expect(result.success).toBe(false);
  });

  it("accepts a round trip with a valid return date", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "round_trip",
      returnDate: "2026-08-17",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a return date before the first slice's departure", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "round_trip",
      returnDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("allows up to 4 slices for multi-city", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "multi_city",
      slices: [
        { origin: "GRU", destination: "GIG", departureDate: "2026-08-10" },
        { origin: "GIG", destination: "SSA", departureDate: "2026-08-12" },
        { origin: "SSA", destination: "CWB", departureDate: "2026-08-14" },
        { origin: "CWB", destination: "GRU", departureDate: "2026-08-16" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 4 slices", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "multi_city",
      slices: Array.from({ length: 5 }, (_, i) => ({
        origin: "GRU",
        destination: "GIG",
        departureDate: `2026-08-${10 + i}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects origin equal to destination within a slice", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      slices: [{ origin: "GRU", destination: "GRU", departureDate: "2026-08-10" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 9 total passengers", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, adults: 9, children: 1 });
    expect(result.success).toBe(false);
  });

  it("requires at least 1 adult", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, adults: 0, infants: 1 });
    expect(result.success).toBe(false);
  });

  it("requires a time when arrive-by-outbound is enabled", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, arriveByOutboundEnabled: true });
    expect(result.success).toBe(false);
  });
});

describe("tripSearchToCriteria", () => {
  it("converts round-trip form values into a two-slice SearchCriteria payload", () => {
    const criteria = tripSearchToCriteria({
      tripType: "round_trip",
      slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
      returnDate: "2026-08-17",
      adults: 2,
      children: 1,
      infants: 1,
      cabinClass: "business",
      maxConnections: 0,
      arriveByOutboundEnabled: true,
      arriveByOutboundTime: "18:00",
      departAfterReturnEnabled: false,
    });

    expect(criteria).toEqual({
      slices: [
        { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
        { origin: "GIG", destination: "GRU", departure_date: "2026-08-17" },
      ],
      passengers: [
        { type: "adult" },
        { type: "adult" },
        { type: "child" },
        { type: "infant_without_seat" },
      ],
      cabin_class: "business",
      max_connections: 0,
      preferences: { arrive_by_outbound: "18:00" },
    });
  });

  it("keeps one-way as a single slice with no synthesized return leg", () => {
    const criteria = tripSearchToCriteria({
      tripType: "one_way",
      slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      maxConnections: 1,
      arriveByOutboundEnabled: false,
      departAfterReturnEnabled: false,
    });

    expect(criteria.slices).toEqual([{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }]);
  });

  it("passes multi-city slices through unchanged", () => {
    const criteria = tripSearchToCriteria({
      tripType: "multi_city",
      slices: [
        { origin: "GRU", destination: "GIG", departureDate: "2026-08-10" },
        { origin: "GIG", destination: "SSA", departureDate: "2026-08-12" },
      ],
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      maxConnections: 2,
      arriveByOutboundEnabled: false,
      departAfterReturnEnabled: false,
    });

    expect(criteria.slices).toEqual([
      { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
      { origin: "GIG", destination: "SSA", departure_date: "2026-08-12" },
    ]);
  });
});
