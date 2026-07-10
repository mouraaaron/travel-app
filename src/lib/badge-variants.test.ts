import { describe, expect, it } from "vitest";
import {
  getDuffelFlagBadges,
  getDuffelPolicyBadge,
  getFlagBadges,
  getPolicyBadge,
  getStatusBadge,
  getTravelRequestStatusBadge,
  getTravelRequestTimelineLabel,
} from "./badge-variants";
import type { DuffelPolicyEvaluation } from "./policy";
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

describe("getDuffelPolicyBadge", () => {
  it("labels a compliant Duffel evaluation as within policy (success)", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelPolicyBadge(evaluation)).toEqual({ label: "Dentro da política", variant: "success" });
  });

  it("labels a non-compliant Duffel evaluation as out of policy (warning)", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: false,
      violations: [
        { rule_id: "cost-cap", message: "excede o teto", field: "totalAmount", expected: "<=3500", actual: "4000" },
      ],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelPolicyBadge(evaluation)).toEqual({ label: "Fora da política", variant: "warning" });
  });
});

describe("getDuffelFlagBadges", () => {
  it("returns an info badge for international travel and a magic badge for cost above threshold", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: true, cost_above_threshold: true },
    };
    expect(getDuffelFlagBadges(evaluation)).toEqual([
      { label: "Internacional", variant: "info" },
      { label: "Custo acima do teto", variant: "magic" },
    ]);
  });

  it("returns an empty array when no flags are set", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelFlagBadges(evaluation)).toEqual([]);
  });
});

describe("getTravelRequestStatusBadge", () => {
  it.each([
    ["pending_admin", "Aguardando aprovação", "outline"],
    ["approved", "Aprovada", "success"],
    ["rejected", "Rejeitada", "destructive"],
    ["needs_review", "Requer revisão", "warning"],
    ["confirmed", "Confirmada", "info"],
    ["cancelled", "Cancelada", "secondary"],
  ] as const)("maps %s to { %s, %s }", (status, label, variant) => {
    expect(getTravelRequestStatusBadge(status)).toEqual({ label, variant });
  });
});

describe("getTravelRequestTimelineLabel", () => {
  it.each([
    ["created", "Criada por você"],
    ["approved", "Aprovada por Travel Admin"],
    ["rejected", "Rejeitada por Travel Admin"],
    ["needs_review", "Marcada para revisão"],
    ["confirmed", "Reserva confirmada"],
    ["cancelled", "Cancelada"],
  ] as const)("maps %s to %s", (kind, label) => {
    expect(getTravelRequestTimelineLabel(kind)).toBe(label);
  });
});
