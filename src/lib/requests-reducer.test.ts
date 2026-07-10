import { describe, expect, it } from "vitest";
import { requestsReducer, travelRequestsReducer } from "./requests-reducer";
import type { TravelRequest, TripRequest } from "./types";

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

function buildTravelRequest(overrides: Partial<TravelRequest> = {}): TravelRequest {
  return {
    id: "treq-1",
    organization_id: "org-1",
    employee_id: "emp-1",
    created_at: "2026-07-08T10:00:00.000Z",
    status: "pending_admin",
    search_criteria: {
      slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: "off-1",
      total_amount: "500.00",
      total_currency: "BRL",
      owner: { iata_code: "AD", name: "Azul", logo_symbol_url: "" },
      slices: [],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-08-10T09:00:00.000Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "conference",
      cost_center: "Engenharia",
      business_justification: "Conferência anual do setor.",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [{ at: "2026-07-08T10:00:00.000Z", kind: "created" }],
    ...overrides,
  };
}

describe("travelRequestsReducer", () => {
  it("adds a travel request to an empty list", () => {
    const next = travelRequestsReducer([], { type: "ADD_TRAVEL_REQUEST", payload: buildTravelRequest() });
    expect(next).toEqual([buildTravelRequest()]);
  });

  it("prepends new travel requests, newest first", () => {
    const existing = buildTravelRequest({ id: "treq-old" });
    const incoming = buildTravelRequest({ id: "treq-new" });
    const next = travelRequestsReducer([existing], { type: "ADD_TRAVEL_REQUEST", payload: incoming });
    expect(next.map((r) => r.id)).toEqual(["treq-new", "treq-old"]);
  });

  it("cancels a request by id, setting status and appending a cancelled event", () => {
    const existing = buildTravelRequest();
    const next = travelRequestsReducer([existing], {
      type: "CANCEL_TRAVEL_REQUEST",
      payload: { id: "treq-1", at: "2026-07-09T10:00:00.000Z" },
    });
    expect(next[0].status).toBe("cancelled");
    expect(next[0].events).toHaveLength(2);
    expect(next[0].events[1]).toEqual({ at: "2026-07-09T10:00:00.000Z", kind: "cancelled" });
  });

  it("leaves other requests untouched when cancelling one", () => {
    const a = buildTravelRequest({ id: "treq-a" });
    const b = buildTravelRequest({ id: "treq-b" });
    const next = travelRequestsReducer([a, b], {
      type: "CANCEL_TRAVEL_REQUEST",
      payload: { id: "treq-a", at: "2026-07-09T10:00:00.000Z" },
    });
    expect(next[1]).toEqual(b);
  });

  it("replaces state wholesale on HYDRATE_TRAVEL", () => {
    const existing = buildTravelRequest({ id: "treq-old" });
    const hydrated = [buildTravelRequest({ id: "treq-a" })];
    const next = travelRequestsReducer([existing], { type: "HYDRATE_TRAVEL", payload: hydrated });
    expect(next).toEqual(hydrated);
  });
});
