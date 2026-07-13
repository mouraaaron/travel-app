import type { Sector } from "./badge-variants";
import type { TravelRequest } from "./types";

export interface RequestRow {
  id: string;
  organization_id: string;
  employee_id: string;
  status: TravelRequest["status"];
  total_amount: number;
  total_currency: string;
  created_at: string;
  search_criteria: TravelRequest["search_criteria"];
  selected_offer_snapshot: TravelRequest["selected_offer_snapshot"];
  passengers: TravelRequest["passengers"];
  corporate: TravelRequest["corporate"];
  policy_evaluation: TravelRequest["policy_evaluation"];
  events: TravelRequest["events"];
}

export function toTravelRequest(row: RequestRow): TravelRequest {
  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    created_at: row.created_at,
    status: row.status,
    search_criteria: row.search_criteria,
    selected_offer_snapshot: row.selected_offer_snapshot,
    passengers: row.passengers,
    corporate: row.corporate,
    policy_evaluation: row.policy_evaluation,
    events: row.events,
  };
}

export interface RequestRowWithEmployee extends RequestRow {
  profiles: { full_name: string; cost_center: Sector } | null;
}

export interface AdminQueueRequest extends TravelRequest {
  employeeName: string;
  employeeSector: Sector;
}

export function toAdminQueueRequest(row: RequestRowWithEmployee): AdminQueueRequest {
  return {
    ...toTravelRequest(row),
    employeeName: row.profiles?.full_name ?? "Funcionário",
    employeeSector: row.profiles?.cost_center ?? "engineering",
  };
}
