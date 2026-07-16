import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inCourseFlights } from "./in-course-flights";
import type { AdminQueueRequest } from "./requests-mapper";

function makeRequest(overrides: Partial<AdminQueueRequest> = {}): AdminQueueRequest {
  return {
    id: "req_1",
    organization_id: "org_1",
    employee_id: "emp_1",
    onsite_week_id: null,
    employeeName: "Carlos Medeiros",
    employeeSector: "engineering",
    created_at: "2026-07-10T09:00:00Z",
    status: "approved",
    search_criteria: {
      slices: [{ origin: "CNF", destination: "GRU", departure_date: "2026-07-16" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: "off_1",
      total_amount: "890.00",
      total_currency: "BRL",
      owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
      slices: [
        {
          origin: "CNF",
          destination: "GRU",
          departure_datetime: "2026-07-16T12:00:00Z",
          arrival_datetime: "2026-07-16T16:00:00Z",
          duration: "PT1H30M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-07-16T00:00:00Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "client_meeting",
      cost_center: "engineering",
      business_justification: "",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [],
    ...overrides,
  };
}

describe("inCourseFlights", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes a slice when now is between its departure and arrival", () => {
    vi.setSystemTime(new Date("2026-07-16T13:00:00Z"));
    const result = inCourseFlights([makeRequest()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "req_1:0",
      employeeName: "Carlos Medeiros",
      departureAt: "2026-07-16T12:00:00Z",
      arrivalAt: "2026-07-16T16:00:00Z",
    });
    expect(result[0].origin.code).toBe("CNF");
    expect(result[0].destination.code).toBe("GRU");
    expect(typeof result[0].origin.lat).toBe("number");
    expect(typeof result[0].destination.lat).toBe("number");
  });

  it("excludes a slice before its departure", () => {
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    expect(inCourseFlights([makeRequest()])).toHaveLength(0);
  });

  it("excludes a slice after its arrival", () => {
    vi.setSystemTime(new Date("2026-07-16T18:00:00Z"));
    expect(inCourseFlights([makeRequest()])).toHaveLength(0);
  });

  it("includes a slice at the exact departure or arrival instant (inclusive bounds)", () => {
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    expect(inCourseFlights([makeRequest()])).toHaveLength(1);
    vi.setSystemTime(new Date("2026-07-16T16:00:00Z"));
    expect(inCourseFlights([makeRequest()])).toHaveLength(1);
  });

  it.each(["pending_admin", "needs_review", "rejected", "cancelled", "confirmed"] as const)(
    "excludes a request with status %s even while its slice's time window is current",
    (status) => {
      vi.setSystemTime(new Date("2026-07-16T13:00:00Z"));
      expect(inCourseFlights([makeRequest({ status })])).toHaveLength(0);
    }
  );

  it("evaluates each slice of a round trip independently, only surfacing the one in progress", () => {
    vi.setSystemTime(new Date("2026-07-20T13:00:00Z"));
    const roundTrip = makeRequest({
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          {
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-16T12:00:00Z",
            arrival_datetime: "2026-07-16T16:00:00Z",
            duration: "PT1H30M",
            segments_count: 1,
          },
          {
            origin: "GRU",
            destination: "CNF",
            departure_datetime: "2026-07-20T12:00:00Z",
            arrival_datetime: "2026-07-20T16:00:00Z",
            duration: "PT1H30M",
            segments_count: 1,
          },
        ],
      },
    });
    const result = inCourseFlights([roundTrip]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("req_1:1");
    expect(result[0].origin.code).toBe("GRU");
    expect(result[0].destination.code).toBe("CNF");
  });

  it("surfaces multiple in-course flights from different requests, each with its own id", () => {
    vi.setSystemTime(new Date("2026-07-16T13:00:00Z"));
    const result = inCourseFlights([
      makeRequest({ id: "req_1", employeeName: "Carlos Medeiros" }),
      makeRequest({ id: "req_2", employeeName: "Ana Ferreira" }),
    ]);
    expect(result.map((f) => f.id).sort()).toEqual(["req_1:0", "req_2:0"]);
  });

  it("excludes a slice whose origin or destination airport code is not in the catalog", () => {
    vi.setSystemTime(new Date("2026-07-16T13:00:00Z"));
    const request = makeRequest({
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          {
            origin: "ZZZ",
            destination: "GRU",
            departure_datetime: "2026-07-16T12:00:00Z",
            arrival_datetime: "2026-07-16T16:00:00Z",
            duration: "PT1H30M",
            segments_count: 1,
          },
        ],
      },
    });
    expect(inCourseFlights([request])).toHaveLength(0);
  });

  it("excludes a slice with an unparseable departure or arrival datetime", () => {
    vi.setSystemTime(new Date("2026-07-16T13:00:00Z"));
    const request = makeRequest({
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          {
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "not-a-date",
            arrival_datetime: "2026-07-16T16:00:00Z",
            duration: "PT1H30M",
            segments_count: 1,
          },
        ],
      },
    });
    expect(inCourseFlights([request])).toHaveLength(0);
  });
});
