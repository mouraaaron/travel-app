import type { DuffelPolicyDefaults } from "./policy";
import type { Sector } from "./badge-variants";

export interface PolicyRuleRow {
  id: string;
  organization_id: string;
  sector: Sector;
  domestic_cap_brl: number;
  international_cap_brl: number;
  long_haul_cabin_hours: number;
  cost_flag_brl: number;
  updated_at: string;
}

export function toDuffelPolicyDefaults(row: PolicyRuleRow): DuffelPolicyDefaults {
  return {
    domesticCapBRL: row.domestic_cap_brl,
    internationalCapBRL: row.international_cap_brl,
    longHaulCabinHours: row.long_haul_cabin_hours,
    costFlagBRL: row.cost_flag_brl,
  };
}
