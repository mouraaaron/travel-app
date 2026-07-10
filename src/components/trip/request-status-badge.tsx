import { Badge } from "@/components/ui/badge";
import { getTravelRequestStatusBadge } from "@/lib/badge-variants";
import type { TravelRequestStatus } from "@/lib/types";

export function RequestStatusBadge({ status }: { status: TravelRequestStatus }) {
  const badge = getTravelRequestStatusBadge(status);
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
