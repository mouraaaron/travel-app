import { describe, expect, it } from "vitest";
import { filterRequestsForQueue } from "./admin-requests";
import type { AdminQueueRequest } from "./requests-mapper";

function makeRequest(overrides: Partial<AdminQueueRequest> = {}): AdminQueueRequest {
  return {
    id: "req_1",
    organization_id: "org_1",
    employee_id: "emp_1",
    employeeName: "Carlos Medeiros",
    employeeSector: "engineering",
    created_at: "2026-07-06T09:14:00Z",
    status: "pending_admin",
    search_criteria: {
      slices: [{ origin: "CNF", destination: "GRU", departure_date: "2026-07-20" }],
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
          departure_datetime: "2026-07-20T08:00:00Z",
          arrival_datetime: "2026-07-20T09:30:00Z",
          duration: "PT1H30M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-07-15T00:00:00Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "client_meeting",
      cost_center: "engineering",
      business_justification: "Visita a cliente.",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [{ at: "2026-07-06T09:14:00Z", kind: "created" }],
    ...overrides,
  };
}

describe("filterRequestsForQueue", () => {
  it("keeps only pending_admin requests on the pending tab, oldest first", () => {
    const requests = [
      makeRequest({ id: "a", status: "approved", created_at: "2026-07-01T00:00:00Z" }),
      makeRequest({ id: "b", status: "pending_admin", created_at: "2026-07-07T11:02:00Z" }),
      makeRequest({ id: "c", status: "pending_admin", created_at: "2026-07-06T09:14:00Z" }),
    ];

    const result = filterRequestsForQueue(requests, { tab: "pending", query: "" });

    expect(result.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("on the all tab, filters by employee name case-insensitively", () => {
    const requests = [
      makeRequest({ id: "a", employeeName: "Fernanda Lima" }),
      makeRequest({ id: "b", employeeName: "Carlos Medeiros" }),
    ];

    const result = filterRequestsForQueue(requests, { tab: "all", query: "fernanda" });

    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("on the all tab, filters by origin or destination", () => {
    const base = makeRequest({ id: "a" });
    const other = makeRequest({
      id: "b",
      selected_offer_snapshot: {
        ...base.selected_offer_snapshot,
        slices: [
          {
            origin: "GRU",
            destination: "LIS",
            departure_datetime: "2026-07-25T10:00:00Z",
            arrival_datetime: "2026-07-25T22:00:00Z",
            duration: "PT10H",
            segments_count: 1,
          },
        ],
      },
    });

    const result = filterRequestsForQueue([base, other], { tab: "all", query: "lis" });

    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores the search query on the pending tab", () => {
    const requests = [makeRequest({ id: "a", employeeName: "Fernanda Lima" })];

    const result = filterRequestsForQueue(requests, { tab: "pending", query: "no-match" });

    expect(result.map((r) => r.id)).toEqual(["a"]);
  });
});
