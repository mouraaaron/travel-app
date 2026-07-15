"use client";

import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function EmployeeRequestsTable({ requests }: { requests: AdminQueueRequest[] }) {
  const router = useRouter();
  const sorted = [...requests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todas as solicitações</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma solicitação registrada" size="tiny" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((request) => {
                const snapshot = request.selected_offer_snapshot;
                const { origin, destination } = getRouteLabel(snapshot.slices);
                return (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/requests/${request.id}`)}
                  >
                    <TableCell>
                      {origin} → {destination}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                    </TableCell>
                    <TableCell>
                      <RequestStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
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
