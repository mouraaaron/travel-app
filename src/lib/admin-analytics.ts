import type { Employee } from "./employees-mapper";
import { SECTORS, type Sector } from "./badge-variants";
import type { AdminQueueRequest } from "./requests-mapper";
import type { TravelRequestStatus, TripPurpose } from "./types";

const REALIZED_SPEND_STATUSES: TravelRequestStatus[] = ["approved", "confirmed"];

function requestSpend(request: AdminQueueRequest): number {
  return Number(request.selected_offer_snapshot.total_amount);
}

function isRealizedSpend(request: AdminQueueRequest): boolean {
  return REALIZED_SPEND_STATUSES.includes(request.status);
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(-2)}`;
}

export function monthlySpend(
  requests: AdminQueueRequest[],
  months = 6
): { month: string; total: number }[] {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return { label: monthLabel(date), year: date.getUTCFullYear(), month: date.getUTCMonth(), total: 0 };
  });

  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const created = new Date(request.created_at);
    const bucket = buckets.find(
      (b) => b.year === created.getUTCFullYear() && b.month === created.getUTCMonth()
    );
    if (bucket) bucket.total += requestSpend(request);
  }

  return buckets.map((b) => ({ month: b.label, total: b.total }));
}

export function spendVsPreviousMonth(
  monthly: { month: string; total: number }[]
): { current: number; deltaPct: number } {
  const current = monthly.at(-1)?.total ?? 0;
  const previous = monthly.length >= 2 ? monthly[monthly.length - 2].total : 0;
  if (previous === 0) {
    return { current, deltaPct: current === 0 ? 0 : 100 };
  }
  return { current, deltaPct: ((current - previous) / previous) * 100 };
}

export function complianceRate(requests: AdminQueueRequest[]): {
  compliantCount: number;
  nonCompliantCount: number;
  ratePct: number;
} {
  const compliantCount = requests.filter((r) => r.policy_evaluation.compliant).length;
  const nonCompliantCount = requests.length - compliantCount;
  const ratePct = requests.length === 0 ? 0 : (compliantCount / requests.length) * 100;
  return { compliantCount, nonCompliantCount, ratePct };
}

export function spendByEmployee(
  requests: AdminQueueRequest[]
): { employeeId: string; name: string; total: number }[] {
  const totals = new Map<string, { name: string; total: number }>();
  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const entry = totals.get(request.employee_id) ?? { name: request.employeeName, total: 0 };
    entry.total += requestSpend(request);
    totals.set(request.employee_id, entry);
  }
  return Array.from(totals.entries())
    .map(([employeeId, { name, total }]) => ({ employeeId, name, total }))
    .sort((a, b) => b.total - a.total);
}

export function outOfPolicyByEmployee(
  requests: AdminQueueRequest[]
): { employeeId: string; name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const request of requests) {
    if (request.policy_evaluation.compliant) continue;
    const entry = counts.get(request.employee_id) ?? { name: request.employeeName, count: 0 };
    entry.count += 1;
    counts.set(request.employee_id, entry);
  }
  return Array.from(counts.entries())
    .map(([employeeId, { name, count }]) => ({ employeeId, name, count }))
    .sort((a, b) => b.count - a.count);
}

export function spendBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; total: number }[] {
  const totals = new Map<Sector, number>(SECTORS.map((sector) => [sector, 0]));
  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const key = request.corporate.cost_center as Sector;
    totals.set(key, (totals.get(key) ?? 0) + requestSpend(request));
  }
  return Array.from(totals.entries())
    .map(([sector, total]) => ({ sector, total }))
    .sort((a, b) => b.total - a.total);
}

export function requestVolumeBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; count: number }[] {
  return SECTORS.map((sector) => ({
    sector,
    count: requests.filter((r) => r.corporate.cost_center === sector).length,
  }));
}

export function avgOnsiteWeekCostBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; average: number }[] {
  const totals = new Map<Sector, { sum: number; count: number }>(
    SECTORS.map((sector) => [sector, { sum: 0, count: 0 }])
  );
  for (const request of requests) {
    if (!request.onsite_week_id) continue;
    if (!isRealizedSpend(request)) continue;
    const key = request.corporate.cost_center as Sector;
    const entry = totals.get(key);
    if (!entry) continue;
    entry.sum += requestSpend(request);
    entry.count += 1;
  }
  return SECTORS.map((sector) => {
    const entry = totals.get(sector)!;
    return { sector, average: entry.count === 0 ? 0 : entry.sum / entry.count };
  });
}

export function headcountBySector(employees: Employee[]): { sector: Sector; count: number }[] {
  return SECTORS.map((sector) => ({
    sector,
    count: employees.filter((e) => e.cost_center === sector).length,
  }));
}

const ALL_STATUSES: TravelRequestStatus[] = [
  "pending_admin",
  "approved",
  "rejected",
  "needs_review",
  "confirmed",
  "cancelled",
];

export function requestsByStatus(
  requests: AdminQueueRequest[]
): { status: TravelRequestStatus; count: number }[] {
  return ALL_STATUSES.map((status) => ({
    status,
    count: requests.filter((r) => r.status === status).length,
  }));
}

const ALL_TRIP_PURPOSES: TripPurpose[] = [
  "client_meeting",
  "conference",
  "internal_meeting",
  "training",
  "other",
];

export function tripPurposeBreakdown(
  requests: AdminQueueRequest[]
): { purpose: TripPurpose; count: number }[] {
  return ALL_TRIP_PURPOSES.map((purpose) => ({
    purpose,
    count: requests.filter((r) => r.corporate.trip_purpose === purpose).length,
  }));
}

export function avgApprovalTimeHours(requests: AdminQueueRequest[]): number {
  const durationsHours: number[] = [];

  for (const request of requests) {
    const created = request.events.find((e) => e.kind === "created");
    const resolutions = request.events.filter((e) => e.kind === "approved" || e.kind === "rejected");
    if (!created || resolutions.length === 0) continue;

    const earliest = resolutions.reduce((min, event) =>
      new Date(event.at).getTime() < new Date(min.at).getTime() ? event : min
    );
    const hours = (new Date(earliest.at).getTime() - new Date(created.at).getTime()) / (1000 * 60 * 60);
    durationsHours.push(hours);
  }

  if (durationsHours.length === 0) return 0;
  return durationsHours.reduce((sum, h) => sum + h, 0) / durationsHours.length;
}
