import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monthlySpend, spendVsPreviousMonth } from "./admin-analytics";
import { complianceRate, outOfPolicyByEmployee, spendBySector, spendByEmployee } from "./admin-analytics";
import { requestsByStatus, tripPurposeBreakdown, requestVolumeBySector, headcountBySector } from "./admin-analytics";
import { avgApprovalTimeHours } from "./admin-analytics";
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

describe("monthlySpend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("buckets realized spend into the last 6 months, oldest first, zero-filling empty months", () => {
    const requests = [
      makeRequest({ id: "a", created_at: "2026-06-10T10:00:00Z", status: "approved", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", created_at: "2026-07-05T10:00:00Z", status: "confirmed", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", created_at: "2026-07-06T10:00:00Z", status: "rejected", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "2000.00" } }),
      makeRequest({ id: "d", created_at: "2026-01-01T10:00:00Z", status: "confirmed", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "9999.00" } }),
    ];

    const result = monthlySpend(requests);

    expect(result).toEqual([
      { month: "Fev/26", total: 0 },
      { month: "Mar/26", total: 0 },
      { month: "Abr/26", total: 0 },
      { month: "Mai/26", total: 0 },
      { month: "Jun/26", total: 1000 },
      { month: "Jul/26", total: 500 },
    ]);
  });

  it("returns 6 zero buckets when there are no requests", () => {
    expect(monthlySpend([])).toHaveLength(6);
    expect(monthlySpend([]).every((bucket) => bucket.total === 0)).toBe(true);
  });

  it("excludes pending_admin and needs_review requests from realized spend", () => {
    const requests = [
      makeRequest({ id: "a", created_at: "2026-07-05T10:00:00Z", status: "approved", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "b", created_at: "2026-07-06T10:00:00Z", status: "pending_admin", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "2000.00" } }),
      makeRequest({ id: "c", created_at: "2026-07-07T10:00:00Z", status: "needs_review", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "3000.00" } }),
    ];

    const result = monthlySpend(requests);

    expect(result.at(-1)).toEqual({ month: "Jul/26", total: 500 });
  });
});

describe("spendVsPreviousMonth", () => {
  it("computes the percentage delta between the last two buckets", () => {
    const monthly = [
      { month: "Mai/26", total: 1000 },
      { month: "Jun/26", total: 1000 },
      { month: "Jul/26", total: 1500 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 1500, deltaPct: 50 });
  });

  it("treats a zero previous month with positive current spend as a 100% increase", () => {
    const monthly = [
      { month: "Jun/26", total: 0 },
      { month: "Jul/26", total: 500 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 500, deltaPct: 100 });
  });

  it("returns a zero delta when both months are zero", () => {
    const monthly = [
      { month: "Jun/26", total: 0 },
      { month: "Jul/26", total: 0 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 0, deltaPct: 0 });
  });
});

describe("complianceRate", () => {
  it("counts compliant vs non-compliant requests regardless of status", () => {
    const requests = [
      makeRequest({ id: "a", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "b", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "c", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "d", status: "rejected", policy_evaluation: { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } } }),
    ];
    expect(complianceRate(requests)).toEqual({ compliantCount: 3, nonCompliantCount: 1, ratePct: 75 });
  });

  it("returns a zero rate for an empty list", () => {
    expect(complianceRate([])).toEqual({ compliantCount: 0, nonCompliantCount: 0, ratePct: 0 });
  });
});

describe("spendByEmployee", () => {
  it("sums realized spend per employee, sorted descending", () => {
    const snapshot = makeRequest().selected_offer_snapshot;
    const requests = [
      makeRequest({ id: "a", employee_id: "A", employeeName: "Alice", status: "approved", selected_offer_snapshot: { ...snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", employee_id: "A", employeeName: "Alice", status: "confirmed", selected_offer_snapshot: { ...snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", employee_id: "B", employeeName: "Bob", status: "rejected", selected_offer_snapshot: { ...snapshot, total_amount: "2000.00" } }),
      makeRequest({ id: "d", employee_id: "B", employeeName: "Bob", status: "approved", selected_offer_snapshot: { ...snapshot, total_amount: "300.00" } }),
    ];
    expect(spendByEmployee(requests)).toEqual([
      { employeeId: "A", name: "Alice", total: 1500 },
      { employeeId: "B", name: "Bob", total: 300 },
    ]);
  });
});

describe("outOfPolicyByEmployee", () => {
  it("counts non-compliant requests per employee, sorted descending", () => {
    const compliant = makeRequest().policy_evaluation;
    const nonCompliant = { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } };
    const requests = [
      makeRequest({ id: "a", employee_id: "A", employeeName: "Alice", policy_evaluation: nonCompliant }),
      makeRequest({ id: "b", employee_id: "A", employeeName: "Alice", policy_evaluation: nonCompliant }),
      makeRequest({ id: "c", employee_id: "A", employeeName: "Alice", policy_evaluation: compliant }),
      makeRequest({ id: "d", employee_id: "B", employeeName: "Bob", policy_evaluation: nonCompliant }),
    ];
    expect(outOfPolicyByEmployee(requests)).toEqual([
      { employeeId: "A", name: "Alice", count: 2 },
      { employeeId: "B", name: "Bob", count: 1 },
    ]);
  });
});

describe("spendBySector", () => {
  it("sums realized spend per sector, sorted descending", () => {
    const snapshot = makeRequest().selected_offer_snapshot;
    const requests = [
      makeRequest({ id: "a", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "marketing" }, selected_offer_snapshot: { ...snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", status: "confirmed", corporate: { ...makeRequest().corporate, cost_center: "marketing" }, selected_offer_snapshot: { ...snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "engineering" }, selected_offer_snapshot: { ...snapshot, total_amount: "800.00" } }),
    ];
    expect(spendBySector(requests)).toEqual([
      { sector: "marketing", total: 1500 },
      { sector: "engineering", total: 800 },
      { sector: "product", total: 0 },
      { sector: "founders", total: 0 },
    ]);
  });
});

describe("requestVolumeBySector", () => {
  it("returns all 4 sectors in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", corporate: { ...makeRequest().corporate, cost_center: "product" } }),
      makeRequest({ id: "b", corporate: { ...makeRequest().corporate, cost_center: "product" } }),
      makeRequest({ id: "c", corporate: { ...makeRequest().corporate, cost_center: "founders" } }),
    ];
    expect(requestVolumeBySector(requests)).toEqual([
      { sector: "product", count: 2 },
      { sector: "marketing", count: 0 },
      { sector: "engineering", count: 0 },
      { sector: "founders", count: 1 },
    ]);
  });
});

describe("headcountBySector", () => {
  it("counts employees per sector, in enum order, zero-filling sectors with no one in them", () => {
    const employees = [
      { id: "1", full_name: "A", email: "a@x.com", role: "employee" as const, status: "active" as const, cost_center: "engineering" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "2", full_name: "B", email: "b@x.com", role: "employee" as const, status: "active" as const, cost_center: "engineering" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "3", full_name: "C", email: "c@x.com", role: "admin" as const, status: "active" as const, cost_center: "founders" as const, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(headcountBySector(employees)).toEqual([
      { sector: "product", count: 0 },
      { sector: "marketing", count: 0 },
      { sector: "engineering", count: 2 },
      { sector: "founders", count: 1 },
    ]);
  });
});

describe("requestsByStatus", () => {
  it("returns all 6 statuses in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", status: "confirmed" }),
      makeRequest({ id: "b", status: "confirmed" }),
      makeRequest({ id: "c", status: "pending_admin" }),
    ];
    expect(requestsByStatus(requests)).toEqual([
      { status: "pending_admin", count: 1 },
      { status: "approved", count: 0 },
      { status: "rejected", count: 0 },
      { status: "needs_review", count: 0 },
      { status: "confirmed", count: 2 },
      { status: "cancelled", count: 0 },
    ]);
  });
});

describe("tripPurposeBreakdown", () => {
  it("returns all 5 purposes in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", corporate: { ...makeRequest().corporate, trip_purpose: "conference" } }),
      makeRequest({ id: "b", corporate: { ...makeRequest().corporate, trip_purpose: "conference" } }),
      makeRequest({ id: "c", corporate: { ...makeRequest().corporate, trip_purpose: "client_meeting" } }),
    ];
    expect(tripPurposeBreakdown(requests)).toEqual([
      { purpose: "client_meeting", count: 1 },
      { purpose: "conference", count: 2 },
      { purpose: "internal_meeting", count: 0 },
      { purpose: "training", count: 0 },
      { purpose: "other", count: 0 },
    ]);
  });
});

describe("avgApprovalTimeHours", () => {
  it("averages hours between the created event and the earliest approved/rejected event", () => {
    const requests = [
      makeRequest({
        id: "a",
        events: [
          { at: "2026-07-01T00:00:00Z", kind: "created" },
          { at: "2026-07-02T00:00:00Z", kind: "approved" },
        ],
      }),
      makeRequest({
        id: "b",
        events: [
          { at: "2026-07-01T00:00:00Z", kind: "created" },
          { at: "2026-07-01T12:00:00Z", kind: "rejected" },
        ],
      }),
      makeRequest({
        id: "c",
        events: [{ at: "2026-07-01T00:00:00Z", kind: "created" }],
      }),
    ];
    expect(avgApprovalTimeHours(requests)).toBe(18);
  });

  it("returns 0 when no request has both a created and a resolution event", () => {
    const requests = [makeRequest({ events: [{ at: "2026-07-01T00:00:00Z", kind: "created" }] })];
    expect(avgApprovalTimeHours(requests)).toBe(0);
  });
});
