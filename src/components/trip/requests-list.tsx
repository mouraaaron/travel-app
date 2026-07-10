"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { TravelRequest, TravelRequestStatus } from "@/lib/types";

const STATUS_FILTERS: { value: TravelRequestStatus; label: string }[] = [
  { value: "pending_admin", label: "Aguardando aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "needs_review", label: "Requer revisão" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
];

export function RequestsList({ requests }: { requests: TravelRequest[] }) {
  const router = useRouter();
  const [activeStatuses, setActiveStatuses] = useState<Set<TravelRequestStatus>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filtered =
    activeStatuses.size === 0 ? requests : requests.filter((r) => activeStatuses.has(r.status));

  function toggleStatus(status: TravelRequestStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    await fetch(`/api/requests/${id}/cancel`, { method: "POST" });
    setCancellingId(null);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Minhas solicitações</h1>
        <Button className="bg-brand-gradient hover:bg-brand-gradient-hover" onClick={() => router.push("/")}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova viagem
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = activeStatuses.has(filter.value);
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => toggleStatus(filter.value)}
              className={
                active
                  ? "rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/30"
              }
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Você ainda não tem solicitações"
          description="Comece uma nova viagem."
          button={{ label: "Nova viagem", onClick: () => router.push("/") }}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {filtered.map((request) => {
            const snapshot = request.selected_offer_snapshot;
            const { origin, destination } = getRouteLabel(snapshot.slices);
            return (
              <div
                key={request.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {origin} → {destination}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {snapshot.slices.length > 1 ? "Ida e volta" : "Só ida"} ·{" "}
                    {formatDate(snapshot.slices[0]?.departure_datetime ?? request.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:contents">
                  <span className="text-sm text-muted-foreground">
                    {request.passengers.length} passageiro{request.passengers.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                  </span>
                  <RequestStatusBadge status={request.status} />
                  <span className="text-xs text-muted-foreground">
                    Criada em {formatDate(request.created_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {request.status === "pending_admin" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === request.id}
                      onClick={() => handleCancel(request.id)}
                    >
                      {cancellingId === request.id ? "Cancelando..." : "Cancelar"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <Link href={`/requests/${request.id}`}>Ver detalhes</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
