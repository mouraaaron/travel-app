import { describe, expect, it } from "vitest";
import { flightSearchSchema, staySearchSchema } from "./search-schema";

describe("flightSearchSchema", () => {
  const valid = {
    mode: "flight" as const,
    origin: "GRU",
    destination: "JFK",
    departureAt: "2026-08-10",
    returnAt: "2026-08-17",
    cabinClass: "economy" as const,
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
