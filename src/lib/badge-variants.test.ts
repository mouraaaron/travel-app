import { describe, expect, it } from "vitest";
import { getFlagBadges, getPolicyBadge, getStatusBadge } from "./badge-variants";
import type { PolicyEvaluation } from "./types";

describe("getPolicyBadge", () => {
  it("labels a compliant evaluation as within policy", () => {
    const evaluation: PolicyEvaluation = { compliant: true, violations: [], flags: [] };

    expect(getPolicyBadge(evaluation)).toEqual({
      label: "Dentro da política",
      variant: "secondary",
    });
  });

  it("labels a non-compliant evaluation as out of policy", () => {
    const evaluation: PolicyEvaluation = { compliant: false, violations: [], flags: [] };

    expect(getPolicyBadge(evaluation)).toEqual({
      label: "Fora da política",
      variant: "destructive",
    });
  });
});

describe("getFlagBadges", () => {
  it("maps each flag to a labeled badge, in order", () => {
    const evaluation: PolicyEvaluation = {
      compliant: false,
      violations: [],
      flags: ["international", "cost_above_threshold"],
    };

    expect(getFlagBadges(evaluation)).toEqual([
      { label: "Viagem internacional", variant: "outline" },
      { label: "Custo elevado", variant: "outline" },
    ]);
  });

  it("returns an empty array when there are no flags", () => {
    const evaluation: PolicyEvaluation = { compliant: true, violations: [], flags: [] };

    expect(getFlagBadges(evaluation)).toEqual([]);
  });
});

describe("getStatusBadge", () => {
  it.each([
    ["pending_review", "Aguardando aprovação", "outline"],
    ["approved", "Aprovado", "secondary"],
    ["rejected", "Rejeitado", "destructive"],
    ["needs_review", "Precisa de revisão", "destructive"],
    ["confirmed", "Confirmado", "default"],
  ] as const)("maps %s to { %s, %s }", (status, label, variant) => {
    expect(getStatusBadge(status)).toEqual({ label, variant });
  });
});
