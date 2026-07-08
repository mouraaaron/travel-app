import type { PolicyEvaluation, PolicyFlag, RequestStatus } from "./types";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

export function getPolicyBadge(evaluation: PolicyEvaluation): BadgeSpec {
  return evaluation.compliant
    ? { label: "Dentro da política", variant: "secondary" }
    : { label: "Fora da política", variant: "destructive" };
}

const FLAG_BADGES: Record<PolicyFlag, BadgeSpec> = {
  international: { label: "Viagem internacional", variant: "outline" },
  cost_above_threshold: { label: "Custo elevado", variant: "outline" },
};

export function getFlagBadges(evaluation: PolicyEvaluation): BadgeSpec[] {
  return evaluation.flags.map((flag) => FLAG_BADGES[flag]);
}

const STATUS_BADGES: Record<RequestStatus, BadgeSpec> = {
  pending_review: { label: "Aguardando aprovação", variant: "outline" },
  approved: { label: "Aprovado", variant: "secondary" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  needs_review: { label: "Precisa de revisão", variant: "destructive" },
  confirmed: { label: "Confirmado", variant: "default" },
};

export function getStatusBadge(status: RequestStatus): BadgeSpec {
  return STATUS_BADGES[status];
}
