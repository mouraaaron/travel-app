"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { offerTitle, formatDate } from "@/lib/offer-format";
import { useRequests } from "@/lib/requests-store";

export default function DashboardPage() {
  const { requests } = useRequests();

  if (requests.length === 0) {
    return (
      <EmptyState
        title="Você ainda não tem solicitações"
        description="Busque uma viagem para enviar sua primeira solicitação de aprovação."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Minhas Solicitações</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {requests.map((request) => (
          <Link key={request.id} href={`/requests/${request.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{offerTitle(request.offer)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                </div>
                <RequestStatusBadge status={request.status} />
              </CardHeader>
              <CardContent>
                <PolicyBadges evaluation={request.evaluation} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
