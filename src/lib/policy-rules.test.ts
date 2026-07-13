// travel-app/src/lib/policy-rules.test.ts
import { describe, expect, it } from "vitest";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "./policy-rules";

describe("toDuffelPolicyDefaults", () => {
  it("maps a policy_rules database row into the DuffelPolicyDefaults shape", () => {
    const row: PolicyRuleRow = {
      id: "rule_1",
      organization_id: "org_1",
      sector: "engineering",
      domestic_cap_brl: 3500,
      international_cap_brl: 12000,
      long_haul_cabin_hours: 8,
      cost_flag_brl: 8000,
      updated_at: "2026-07-13T00:00:00Z",
    };

    expect(toDuffelPolicyDefaults(row)).toEqual({
      domesticCapBRL: 3500,
      internationalCapBRL: 12000,
      longHaulCabinHours: 8,
      costFlagBRL: 8000,
    });
  });
});
