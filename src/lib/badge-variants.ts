import type { DuffelPolicyEvaluation } from "./policy";
import type { PolicyEvaluation, PolicyFlag, RequestStatus, TravelRequestEvent, TravelRequestStatus } from "./types";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "magic";

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

export function getDuffelPolicyBadge(evaluation: DuffelPolicyEvaluation): BadgeSpec {
  return evaluation.compliant
    ? { label: "Dentro da política", variant: "success" }
    : { label: "Fora da política", variant: "warning" };
}

export function getDuffelFlagBadges(evaluation: DuffelPolicyEvaluation): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  if (evaluation.flags.international_travel) {
    badges.push({ label: "Internacional", variant: "info" });
  }
  if (evaluation.flags.cost_above_threshold) {
    badges.push({ label: "Custo acima do teto", variant: "magic" });
  }
  return badges;
}

const TRAVEL_REQUEST_STATUS_BADGES: Record<TravelRequestStatus, BadgeSpec> = {
  pending_admin: { label: "Aguardando aprovação", variant: "outline" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  needs_review: { label: "Requer revisão", variant: "warning" },
  confirmed: { label: "Confirmada", variant: "info" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export function getTravelRequestStatusBadge(status: TravelRequestStatus): BadgeSpec {
  return TRAVEL_REQUEST_STATUS_BADGES[status];
}

const TIMELINE_LABELS: Record<TravelRequestEvent["kind"], string> = {
  created: "Criada por você",
  approved: "Aprovada por Travel Admin",
  rejected: "Rejeitada por Travel Admin",
  needs_review: "Marcada para revisão",
  confirmed: "Reserva confirmada",
  cancelled: "Cancelada",
};

export function getTravelRequestTimelineLabel(kind: TravelRequestEvent["kind"]): string {
  return TIMELINE_LABELS[kind];
}

export type EmployeeRole = "employee" | "admin";
export type EmployeeStatus = "active" | "inactive";

const ROLE_BADGES: Record<EmployeeRole, BadgeSpec> = {
  employee: { label: "Funcionário", variant: "secondary" },
  admin: { label: "Admin", variant: "default" },
};

export function getRoleBadge(role: EmployeeRole): BadgeSpec {
  return ROLE_BADGES[role];
}

const EMPLOYEE_STATUS_BADGES: Record<EmployeeStatus, BadgeSpec> = {
  active: { label: "Ativo", variant: "success" },
  inactive: { label: "Inativo", variant: "destructive" },
};

export function getEmployeeStatusBadge(status: EmployeeStatus): BadgeSpec {
  return EMPLOYEE_STATUS_BADGES[status];
}

export type Sector = "product" | "marketing" | "engineering" | "founders";

export const SECTORS: Sector[] = ["product", "marketing", "engineering", "founders"];

export const SECTOR_LABELS: Record<Sector, string> = {
  product: "Produto",
  marketing: "Marketing",
  engineering: "Engenharia",
  founders: "Founders",
};

const SECTOR_BADGES: Record<Sector, BadgeSpec> = {
  product: { label: "Produto", variant: "info" },
  marketing: { label: "Marketing", variant: "magic" },
  engineering: { label: "Engenharia", variant: "secondary" },
  founders: { label: "Founders", variant: "default" },
};

export function getSectorBadge(sector: Sector): BadgeSpec {
  return SECTOR_BADGES[sector];
}
