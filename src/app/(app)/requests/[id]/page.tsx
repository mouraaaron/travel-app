"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getTravelRequestTimelineLabel } from "@/lib/badge-variants";
import { formatCurrency, formatDate, formatDateTime, getRouteLabel } from "@/lib/offer-format";
import { maskEmail, maskGivenName, maskPhone } from "@/lib/passenger-masking";
import { useTravelRequests } from "@/lib/requests-store";

const TRIP_PURPOSE_LABELS: Record<string, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { travelRequests, cancelTravelRequest } = useTravelRequests();
  const request = travelRequests.find((r) => r.id === id);
  const [showSensitive, setShowSensitive] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!request) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Solicitação não encontrada"
          description="Ela pode ter sido removida, ou você ainda não recarregou esta lista."
          button={{ label: "Minhas solicitações", onClick: () => router.push("/requests") }}
        />
      </div>
    );
  }

  const snapshot = request.selected_offer_snapshot;
  const rejectionEvent = [...request.events].reverse().find((event) => event.kind === "rejected");
  const { origin: routeOrigin, destination: routeDestination } = getRouteLabel(snapshot.slices);

  function handleCancelConfirm() {
    if (!request) return;
    cancelTravelRequest(request.id, new Date().toISOString());
    setCancelOpen(false);
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/requests")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        ← Minhas solicitações
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {routeOrigin} → {routeDestination}
          {snapshot.slices.length > 1 ? " (ida e volta)" : ""}
        </h1>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Criada em {formatDateTime(request.created_at)}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Viagem</h2>
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{snapshot.owner.name}</p>
              {snapshot.slices.map((slice, index) => (
                <div key={`${slice.origin}-${slice.destination}-${index}`} className="text-sm">
                  {index === 0 ? "Ida" : "Volta"} {formatDate(slice.departure_datetime)} · {slice.origin} →{" "}
                  {slice.destination} · {slice.fare_brand_name}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Passageiros</h2>
                <button
                  type="button"
                  onClick={() => setShowSensitive((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSensitive ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"}
                </button>
              </div>
              {request.passengers.map((passenger) => (
                <div key={passenger.id} className="text-sm">
                  <p className="font-medium text-foreground">
                    {showSensitive
                      ? `${passenger.given_name} ${passenger.family_name}`
                      : maskGivenName(passenger.given_name, passenger.family_name)}
                    {" · "}
                    {passenger.type === "adult" ? "Adulto" : passenger.type === "child" ? "Criança" : "Bebê"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {showSensitive ? passenger.email : maskEmail(passenger.email)} ·{" "}
                    {showSensitive ? passenger.phone_number : maskPhone(passenger.phone_number)}
                    {passenger.identity_documents?.length ? " · Passaporte ******" : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-6 text-sm">
              <h2 className="text-base font-semibold text-foreground">Contexto corporativo</h2>
              <p>Motivo: {TRIP_PURPOSE_LABELS[request.corporate.trip_purpose]}</p>
              <p>Centro de custo: {request.corporate.cost_center}</p>
              {request.corporate.project_code ? <p>Projeto: {request.corporate.project_code}</p> : null}
              <p className="text-muted-foreground">{request.corporate.business_justification}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Avaliação de política</h2>
              <PolicyBadges evaluation={request.policy_evaluation} />
              {!request.policy_evaluation.compliant ? (
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {request.policy_evaluation.violations.map((violation) => (
                    <li key={violation.rule_id}>{violation.message}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
              <RequestStatusBadge status={request.status} />
              {request.status === "rejected" && rejectionEvent?.note ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Motivo:</p>
                  <p>{rejectionEvent.note}</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
                {request.events.map((event, index) => (
                  <div key={index} className="text-xs">
                    <p className="font-medium text-foreground">{getTravelRequestTimelineLabel(event.kind)}</p>
                    <p className="text-muted-foreground">{formatDateTime(event.at)}</p>
                    {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                  </div>
                ))}
              </div>
              {request.status === "pending_admin" ? (
                <Button variant="secondary" className="text-destructive" onClick={() => setCancelOpen(true)}>
                  Cancelar solicitação
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar solicitação</DialogTitle>
            <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Manter
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Cancelar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
