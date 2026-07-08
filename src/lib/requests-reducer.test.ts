import { describe, expect, it } from "vitest";
import { requestsReducer } from "./requests-reducer";
import type { TripRequest } from "./types";

function buildRequest(overrides: Partial<TripRequest> = {}): TripRequest {
  return {
    id: "req-1",
    createdAt: "2026-07-08T10:00:00.000Z",
    offer: {
      id: "flt-1",
      mode: "flight",
      origin: "GRU",
      destination: "JFK",
      destinationCountry: "US",
      departureAt: "2026-08-10T22:30:00.000Z",
      cabinClass: "economy",
      airline: "LATAM",
      stops: 1,
      refundable: false,
      totalAmount: 2850,
      currency: "BRL",
    },
    evaluation: { compliant: true, violations: [], flags: ["international"] },
    status: "pending_review",
    ...overrides,
  };
}

describe("requestsReducer", () => {
  it("adds a request to an empty list", () => {
    const next = requestsReducer([], { type: "ADD_REQUEST", payload: buildRequest() });

    expect(next).toEqual([buildRequest()]);
  });

  it("prepends new requests, newest first", () => {
    const existing = buildRequest({ id: "req-old" });
    const incoming = buildRequest({ id: "req-new" });

    const next = requestsReducer([existing], {
      type: "ADD_REQUEST",
      payload: incoming,
    });

    expect(next.map((r) => r.id)).toEqual(["req-new", "req-old"]);
  });

  it("replaces state wholesale on HYDRATE", () => {
    const existing = buildRequest({ id: "req-old" });
    const hydrated = [buildRequest({ id: "req-a" }), buildRequest({ id: "req-b" })];

    const next = requestsReducer([existing], { type: "HYDRATE", payload: hydrated });

    expect(next).toEqual(hydrated);
  });
});
