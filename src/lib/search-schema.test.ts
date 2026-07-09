import { describe, expect, it } from "vitest";
import { tripSearchSchema, tripSearchToCriteria, flightSearchSchema, staySearchSchema } from "./search-schema";

describe("flightSearchSchema", () => {
  const valid = {
    mode: "flight" as const,
    origin: "GRU",
    destination: "JFK",
    departureAt: "2026-08-10",
    returnAt: "2026-08-17",
    passengerCount: 1,
    cabinClass: "economy" as const,
    latestArrivalEnabled: false,
    latestArrivalTime: "",
    earliestReturnDepartureEnabled: false,
    earliestReturnDepartureTime: "",
  };

  it("accepts a valid round-trip search", () => {
    expect(flightSearchSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects origin and destination being the same", () => {
    const result = flightSearchSchema.safeParse({ ...valid, destination: "gru" });
    expect(result.success).toBe(false);
  });

  it("rejects a return date before the departure date", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      departureAt: "2026-08-17",
      returnAt: "2026-08-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an origin that isn't a 3-letter IATA code", () => {
    const result = flightSearchSchema.safeParse({ ...valid, origin: "SAOPAULO" });
    expect(result.success).toBe(false);
  });

  it("rejects zero passengers", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects more than 9 passengers", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: 10 });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric string passenger count", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: "2" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.passengerCount).toBe(2);
  });

  it("requires a time when latest arrival is enabled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      latestArrivalEnabled: true,
      latestArrivalTime: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts latest arrival time when enabled and filled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      latestArrivalEnabled: true,
      latestArrivalTime: "18:00",
    });
    expect(result.success).toBe(true);
  });

  it("requires a return date before enabling earliest return departure time", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      returnAt: "",
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("requires a time when earliest return departure is enabled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts earliest return departure time when enabled, filled, and a return date is set", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "09:00",
    });
    expect(result.success).toBe(true);
  });
});

describe("staySearchSchema", () => {
  const valid = {
    mode: "stay" as const,
    city: "Rio de Janeiro",
    checkIn: "2026-08-10",
    checkOut: "2026-08-13",
  };

  it("accepts a valid stay search", () => {
    expect(staySearchSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects check-out on or before check-in", () => {
    const result = staySearchSchema.safeParse({ ...valid, checkOut: "2026-08-10" });
    expect(result.success).toBe(false);
  });
});

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
