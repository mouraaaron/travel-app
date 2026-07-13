import { describe, expect, it } from "vitest";
import { toAdminQueueRequest, toTravelRequest, type RequestRow } from "./requests-mapper";

const ROW: RequestRow = {
  id: "req_1",
  organization_id: "org_1",
  employee_id: "emp_1",
  status: "pending_admin",
  total_amount: 2850,
  total_currency: "BRL",
  created_at: "2026-07-10T14:00:00Z",
  search_criteria: {
    slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
  },
  selected_offer_snapshot: {
    offer_id: "off_1",
    total_amount: "2850.00",
    total_currency: "BRL",
    owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
    slices: [],
    conditions: {
      refund_before_departure: { allowed: false },
      change_before_departure: { allowed: false },
    },
    passenger_identity_documents_required: false,
    expires_at: "2026-08-01T00:00:00Z",
  },
  passengers: [],
  corporate: {
    trip_purpose: "client_meeting",
    cost_center: "engineering",
    business_justification: "Reunião com cliente estratégico.",
  },
  policy_evaluation: {
    compliant: true,
    violations: [],
    flags: { international_travel: true, cost_above_threshold: false },
  },
  events: [{ at: "2026-07-10T14:00:00Z", kind: "created" }],
};

describe("toTravelRequest", () => {
  it("maps a database row into the TravelRequest shape the UI expects", () => {
    const result = toTravelRequest(ROW);
    expect(result.id).toBe("req_1");
    expect(result.status).toBe("pending_admin");
    expect(result.corporate.cost_center).toBe("engineering");
    expect(result.events).toHaveLength(1);
    expect(result.selected_offer_snapshot.owner.name).toBe("LATAM");
  });
});

describe("toAdminQueueRequest", () => {
  it("adds the employee's name and sector from the joined profiles row", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: { full_name: "Fernanda Lima", cost_center: "product" } });
    expect(result.employeeName).toBe("Fernanda Lima");
    expect(result.employeeSector).toBe("product");
    expect(result.status).toBe("pending_admin");
  });

  it("falls back to a generic label and engineering when there is no joined profile", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: null });
    expect(result.employeeName).toBe("Funcionário");
    expect(result.employeeSector).toBe("engineering");
  });
});
