"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import type { DuffelPolicyEvaluation } from "@/lib/policy";

export function PolicyBadges({ evaluation }: { evaluation: DuffelPolicyEvaluation }) {
  const policyBadge = getDuffelPolicyBadge(evaluation);
  const flagBadges = getDuffelFlagBadges(evaluation);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {evaluation.compliant ? (
        <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={policyBadge.variant} className="cursor-help">
              {policyBadge.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {evaluation.violations.map((violation) => (
                <li key={violation.rule_id}>{violation.message}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
      {flagBadges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
