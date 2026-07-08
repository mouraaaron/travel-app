import { describe, expect, it } from "vitest";
import { searchOffers } from "./search-offers";
import { MOCK_FLIGHT_OFFERS, MOCK_STAY_OFFERS } from "./mock-data";

describe("searchOffers", () => {
  it("filters flights by origin and destination (case-insensitive)", () => {
    const result = searchOffers(
      { mode: "flight", origin: "gru", destination: "jfk" },
      MOCK_FLIGHT_OFFERS
    );

    expect(result.map((o) => o.id)).toEqual(["flt-1"]);
  });

  it("falls back to all offers of the mode when nothing matches", () => {
    const result = searchOffers(
      { mode: "flight", origin: "xxx", destination: "yyy" },
      MOCK_FLIGHT_OFFERS
    );

    expect(result).toHaveLength(MOCK_FLIGHT_OFFERS.length);
  });

  it("filters stays by city substring (case-insensitive)", () => {
    const result = searchOffers({ mode: "stay", city: "rio" }, MOCK_STAY_OFFERS);

    expect(result.map((o) => o.id)).toEqual(["sty-3"]);
  });

  it("never returns offers from the other mode", () => {
    const result = searchOffers(
      { mode: "flight", origin: "gru", destination: "jfk" },
      [...MOCK_FLIGHT_OFFERS, ...MOCK_STAY_OFFERS]
    );

    expect(result.every((o) => o.mode === "flight")).toBe(true);
  });
});
