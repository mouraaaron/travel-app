import { Badge } from "@/components/ui/badge";
import { getStatusBadge } from "@/lib/badge-variants";
import type { RequestStatus } from "@/lib/types";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const spec = getStatusBadge(status);
  return <Badge variant={spec.variant}>{spec.label}</Badge>;
}
