"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { useRequests } from "@/lib/requests-store";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { requests } = useRequests();
  const request = requests.find((r) => r.id === id);

  if (!request) {
    return (
      <EmptyState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você ainda não recarregou esta lista."
      />
    );
  }

  const { offer, evaluation } = request;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {offer.mode === "flight"
            ? `${offer.airline} · ${offer.origin} → ${offer.destination}`
            : `${offer.hotelName} · ${offer.city}`}
        </CardTitle>
        <RequestStatusBadge status={request.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {offer.mode === "flight" ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Ida</dt>
            <dd>{formatDate(offer.departureAt)}</dd>
            {offer.returnAt ? (
              <>
                <dt className="text-muted-foreground">Volta</dt>
                <dd>{formatDate(offer.returnAt)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Classe</dt>
            <dd>{offer.cabinClass.replace("_", " ")}</dd>
            <dt className="text-muted-foreground">Paradas</dt>
            <dd>{offer.stops === 0 ? "Direto" : offer.stops}</dd>
          </dl>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Check-in</dt>
            <dd>{formatDate(offer.checkIn)}</dd>
            <dt className="text-muted-foreground">Check-out</dt>
            <dd>{formatDate(offer.checkOut)}</dd>
            <dt className="text-muted-foreground">Categoria</dt>
            <dd>{offer.starRating} estrelas</dd>
          </dl>
        )}
        <p className="text-lg font-semibold">
          {formatCurrency(offer.totalAmount, offer.currency)}
        </p>
        <Separator />
        <div>
          <p className="mb-2 text-sm font-medium">Avaliação de política</p>
          <PolicyBadges evaluation={evaluation} />
        </div>
        {request.justification ? (
          <div>
            <p className="mb-1 text-sm font-medium">Justificativa</p>
            <p className="text-sm text-muted-foreground">{request.justification}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
