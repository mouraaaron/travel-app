import { describe, expect, it } from "vitest";
import { toOnsiteWeek, type OnsiteWeekRow } from "./onsite-weeks-mapper";

const ROW: OnsiteWeekRow = {
  id: "ow_1",
  organization_id: "org_1",
  sector: "engineering",
  week_start_date: "2026-08-10",
  week_end_date: "2026-08-14",
  status: "completed",
  employee_outcomes: [{ employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" }],
  created_by: "admin_1",
  created_at: "2026-07-15T10:00:00Z",
  cancelled_at: null,
};

describe("toOnsiteWeek", () => {
  it("maps a database row into the OnsiteWeek shape the UI expects", () => {
    const result = toOnsiteWeek(ROW);
    expect(result).toEqual(ROW);
  });
});
