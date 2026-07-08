import { describe, expect, it } from "vitest";
import { flightSearchSchema, staySearchSchema } from "./search-schema";

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
