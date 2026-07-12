"use client";

import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function OutOfPolicyPanel({ requests }: { requests: AdminQueueRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fora de política</CardTitle>
        <CardDescription>Solicitações não compliant mais recentes</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="Nenhuma solicitação fora de política" size="tiny" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const snapshot = request.selected_offer_snapshot;
                const { origin, destination } = getRouteLabel(snapshot.slices);
                const policyBadge = getDuffelPolicyBadge(request.policy_evaluation);
                const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
                return (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium text-foreground">{request.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {origin} → {destination}
                    </TableCell>
                    <TableCell>{formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
                        {flagBadges.map((badge) => (
                          <Badge key={badge.label} variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {request.corporate.out_of_policy_justification ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(request.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
