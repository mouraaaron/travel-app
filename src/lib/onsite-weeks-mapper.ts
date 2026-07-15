import type { OnsiteWeekStatus, Sector } from "./badge-variants";
import type { OnsiteWeekEmployeeOutcome } from "./onsite-weeks";

export interface OnsiteWeekRow {
  id: string;
  organization_id: string;
  sector: Sector;
  week_start_date: string;
  week_end_date: string;
  status: OnsiteWeekStatus;
  employee_outcomes: OnsiteWeekEmployeeOutcome[];
  created_by: string;
  created_at: string;
  cancelled_at: string | null;
}

export type OnsiteWeek = OnsiteWeekRow;

export function toOnsiteWeek(row: OnsiteWeekRow): OnsiteWeek {
  return { ...row };
}
