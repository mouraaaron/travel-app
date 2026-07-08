import { Badge } from "@/components/ui/badge";
import { getFlagBadges, getPolicyBadge } from "@/lib/badge-variants";
import type { PolicyEvaluation } from "@/lib/types";

export function PolicyBadges({ evaluation }: { evaluation: PolicyEvaluation }) {
  const policyBadge = getPolicyBadge(evaluation);
  const flagBadges = getFlagBadges(evaluation);

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
      {flagBadges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
