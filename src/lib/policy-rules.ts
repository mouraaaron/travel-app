import type { SupabaseClient } from "@supabase/supabase-js";
import { DUFFEL_POLICY_DEFAULTS, type DuffelPolicyDefaults } from "./policy";
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

export async function getPolicyDefaults(
  supabase: SupabaseClient,
  organizationId: string,
  sector: string
): Promise<DuffelPolicyDefaults> {
  const { data: ruleRow } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("sector", sector)
    .single();
  return ruleRow ? toDuffelPolicyDefaults(ruleRow as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;
}
