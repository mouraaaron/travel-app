import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectFlightsForMap } from "./flight-map-selection";
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

function makeSlice(overrides: Partial<AdminQueueRequest["selected_offer_snapshot"]["slices"][0]> = {}) {
  return {
    origin: "CNF",
    destination: "GRU",
    departure_datetime: "2026-07-16T12:00:00Z",
    arrival_datetime: "2026-07-16T16:00:00Z",
    duration: "PT1H30M",
    segments_count: 1,
    ...overrides,
  };
}

const NOW = new Date("2026-07-20T12:00:00Z");

describe("selectFlightsForMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty list when there are no in-course and no completed flights", () => {
    expect(selectFlightsForMap([], NOW)).toHaveLength(0);
  });

  it("fills remaining slots with completed flights when there are fewer than 5 in-course", () => {
    const inCourseRequest = makeRequest({
      id: "req_in_course",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GIG",
            destination: "SDU",
            departure_datetime: "2026-07-20T11:00:00Z",
            arrival_datetime: "2026-07-20T13:00:00Z",
          }),
        ],
      },
    });
    const completedRequest = makeRequest({
      id: "req_completed",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T12:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([inCourseRequest, completedRequest], NOW);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("in_course");
    expect(result[1].status).toBe("completed");
    expect(result[1].id).toBe("req_completed:0");
  });

  it("returns only in-course flights when there are already 5, ignoring completed candidates", () => {
    const inCourseRequests = Array.from({ length: 5 }, (_, i) =>
      makeRequest({
        id: `req_in_course_${i}`,
        selected_offer_snapshot: {
          ...makeRequest().selected_offer_snapshot,
          slices: [
            makeSlice({
              origin: "GIG",
              destination: "SDU",
              departure_datetime: "2026-07-20T11:00:00Z",
              arrival_datetime: "2026-07-20T13:00:00Z",
            }),
          ],
        },
      })
    );
    const completedRequest = makeRequest({
      id: "req_completed",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T12:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([...inCourseRequests, completedRequest], NOW);

    expect(result).toHaveLength(5);
    expect(result.every((flight) => flight.status === "in_course")).toBe(true);
  });

  it.each(["pending_admin", "needs_review", "rejected", "cancelled"] as const)(
    "excludes a completed candidate with status %s",
    (status) => {
      const request = makeRequest({ status });
      expect(selectFlightsForMap([request], NOW)).toHaveLength(0);
    }
  );

  it("includes a completed candidate with status confirmed", () => {
    const request = makeRequest({ status: "confirmed" });
    const result = selectFlightsForMap([request], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("completed");
  });

  it("excludes a candidate whose departure is still in the future", () => {
    const request = makeRequest({
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            departure_datetime: "2026-07-25T10:00:00Z",
            arrival_datetime: "2026-07-25T12:00:00Z",
          }),
        ],
      },
    });
    expect(selectFlightsForMap([request], NOW)).toHaveLength(0);
  });

  it("keeps only the most recent of two completed flights on the same undirected route", () => {
    const older = makeRequest({
      id: "req_older",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-10T10:00:00Z",
            arrival_datetime: "2026-07-10T12:00:00Z",
          }),
        ],
      },
    });
    const newer = makeRequest({
      id: "req_newer",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GRU", // mesma rota, direção invertida
            destination: "CNF",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T12:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([older, newer], NOW);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("req_newer:0");
  });

  it("excludes a completed candidate whose route duplicates an in-course flight's route", () => {
    const inCourseRequest = makeRequest({
      id: "req_in_course",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-20T11:00:00Z",
            arrival_datetime: "2026-07-20T13:00:00Z",
          }),
        ],
      },
    });
    const completedSameRoute = makeRequest({
      id: "req_completed_same_route",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GRU", // mesma rota do in-course, direção invertida
            destination: "CNF",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T12:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([inCourseRequest, completedSameRoute], NOW);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("in_course");
  });

  it("orders completed candidates by most recent arrival first when filling slots beyond 5 candidates", () => {
    const routes = [
      { origin: "CNF", destination: "GRU", arrival: "2026-07-15T12:00:00Z" },
      { origin: "GIG", destination: "SDU", arrival: "2026-07-16T12:00:00Z" },
      { origin: "BSB", destination: "SSA", arrival: "2026-07-17T12:00:00Z" },
      { origin: "CWB", destination: "POA", arrival: "2026-07-18T12:00:00Z" },
      { origin: "REC", destination: "FOR", arrival: "2026-07-19T12:00:00Z" },
      { origin: "MAO", destination: "PLU", arrival: "2026-07-19T18:00:00Z" },
    ];
    const requests = routes.map((route, i) =>
      makeRequest({
        id: `req_${i}`,
        selected_offer_snapshot: {
          ...makeRequest().selected_offer_snapshot,
          slices: [
            makeSlice({
              origin: route.origin,
              destination: route.destination,
              departure_datetime: new Date(new Date(route.arrival).getTime() - 2 * 3600 * 1000).toISOString(),
              arrival_datetime: route.arrival,
            }),
          ],
        },
      })
    );

    const result = selectFlightsForMap(requests, NOW);

    expect(result).toHaveLength(5);
    expect(result.map((f) => f.id)).toEqual(["req_5:0", "req_4:0", "req_3:0", "req_2:0", "req_1:0"]);
  });

  it("forces in the most recent international completed flight, evicting the least-recent domestic pick, when none of the naturally-chosen flights are international", () => {
    // 1 in-course flight leaves 4 remaining slots. 4 domestic completed
    // candidates (all more recent than the international one) naturally
    // fill all 4 slots, pushing the international candidate out of the
    // top-4-by-recency — this is what forces the eviction/swap logic to run.
    const inCourseRequest = makeRequest({
      id: "req_in_course",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GIG",
            destination: "SDU",
            departure_datetime: "2026-07-20T11:00:00Z",
            arrival_datetime: "2026-07-20T13:00:00Z",
          }),
        ],
      },
    });
    const domesticRoutes = [
      { id: "req_domestic_1", origin: "CNF", destination: "GRU", arrival: "2026-07-19T18:00:00Z" },
      { id: "req_domestic_2", origin: "BSB", destination: "SSA", arrival: "2026-07-19T12:00:00Z" },
      { id: "req_domestic_3", origin: "CWB", destination: "POA", arrival: "2026-07-18T12:00:00Z" },
      { id: "req_domestic_4", origin: "REC", destination: "FOR", arrival: "2026-07-17T12:00:00Z" },
    ];
    const domesticRequests = domesticRoutes.map((route) =>
      makeRequest({
        id: route.id,
        selected_offer_snapshot: {
          ...makeRequest().selected_offer_snapshot,
          slices: [
            makeSlice({
              origin: route.origin,
              destination: route.destination,
              departure_datetime: new Date(new Date(route.arrival).getTime() - 2 * 3600 * 1000).toISOString(),
              arrival_datetime: route.arrival,
            }),
          ],
        },
      })
    );
    const internationalOlder = makeRequest({
      id: "req_international_older",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GRU",
            destination: "JFK",
            departure_datetime: "2026-07-10T10:00:00Z",
            arrival_datetime: "2026-07-10T20:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap(
      [inCourseRequest, ...domesticRequests, internationalOlder],
      NOW
    );

    expect(result).toHaveLength(5);
    expect(result.map((f) => f.id)).toContain("req_international_older:0");
    // req_domestic_4 was the least-recent of the 4 naturally-chosen domestic
    // flights, so it's the one evicted to make room for the international pick.
    expect(result.map((f) => f.id)).not.toContain("req_domestic_4:0");
  });

  it("does not force a swap when a chosen flight is already international", () => {
    const international = makeRequest({
      id: "req_international",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GRU",
            destination: "JFK",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T20:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([international], NOW);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("req_international:0");
  });

  it("does not force a swap when all 5 slots are already filled by in-course flights", () => {
    const inCourseRequests = Array.from({ length: 5 }, (_, i) =>
      makeRequest({
        id: `req_in_course_${i}`,
        selected_offer_snapshot: {
          ...makeRequest().selected_offer_snapshot,
          slices: [
            makeSlice({
              origin: "GIG",
              destination: "SDU",
              departure_datetime: "2026-07-20T11:00:00Z",
              arrival_datetime: "2026-07-20T13:00:00Z",
            }),
          ],
        },
      })
    );
    const internationalCompleted = makeRequest({
      id: "req_international_completed",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "GRU",
            destination: "JFK",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T20:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([...inCourseRequests, internationalCompleted], NOW);

    expect(result).toHaveLength(5);
    expect(result.every((flight) => flight.status === "in_course")).toBe(true);
  });

  it("does not force a swap when no international completed candidate is available", () => {
    const domestic = makeRequest({
      id: "req_domestic",
      selected_offer_snapshot: {
        ...makeRequest().selected_offer_snapshot,
        slices: [
          makeSlice({
            origin: "CNF",
            destination: "GRU",
            departure_datetime: "2026-07-19T10:00:00Z",
            arrival_datetime: "2026-07-19T12:00:00Z",
          }),
        ],
      },
    });

    const result = selectFlightsForMap([domestic], NOW);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("req_domestic:0");
  });
});
