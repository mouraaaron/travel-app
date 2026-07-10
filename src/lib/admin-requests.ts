import { getRouteLabel } from "./offer-format";
import type { AdminQueueRequest } from "./requests-mapper";

export type AdminQueueTab = "pending" | "all";

export interface AdminQueueFilter {
  tab: AdminQueueTab;
  query: string;
}

function matchesQuery(request: AdminQueueRequest, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { origin, destination } = getRouteLabel(request.selected_offer_snapshot.slices);
  return (
    request.employeeName.toLowerCase().includes(needle) ||
    origin.toLowerCase().includes(needle) ||
    destination.toLowerCase().includes(needle)
  );
}

export function filterRequestsForQueue(
  requests: AdminQueueRequest[],
  filter: AdminQueueFilter
): AdminQueueRequest[] {
  const scoped =
    filter.tab === "pending" ? requests.filter((r) => r.status === "pending_admin") : requests;
  const searched = filter.tab === "all" ? scoped.filter((r) => matchesQuery(r, filter.query)) : scoped;
  return [...searched].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
