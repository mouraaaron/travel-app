"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getTravelRequestTimelineLabel } from "@/lib/badge-variants";
import { mutateWithToast } from "@/lib/client-mutation";
import { formatCurrency, formatDate, formatDateTime, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

const ACTIONABLE_STATUSES = ["pending_admin", "needs_review"] as const;

export function AdminRequestDetailView({ request }: { request: AdminQueueRequest }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const snapshot = request.selected_offer_snapshot;
  const { origin, destination } = getRouteLabel(snapshot.slices);
  const isRoundTrip = snapshot.slices.length > 1;
  const datesLabel = isRoundTrip
    ? `${formatDate(snapshot.slices[0].departure_datetime)} – ${formatDate(
        snapshot.slices[snapshot.slices.length - 1].departure_datetime
      )}`
    : formatDate(snapshot.slices[0].departure_datetime);
  const canAct = ACTIONABLE_STATUSES.includes(request.status as (typeof ACTIONABLE_STATUSES)[number]);

  async function handleApprove() {
    setApproving(true);
    const { ok } = await mutateWithToast(
      `/api/admin/requests/${request.id}/approve`,
      { method: "POST" },
      { error: "Não foi possível aprovar a solicitação." }
    );
    if (ok) router.refresh();
    setApproving(false);
  }

  async function handleRejectConfirm() {
    setRejecting(true);
    const { ok } = await mutateWithToast(
      `/api/admin/requests/${request.id}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      },
      { error: "Não foi possível rejeitar a solicitação." }
    );
    if (ok) {
      setRejectOpen(false);
      router.refresh();
    }
    setRejecting(false);
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/admin/requests")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        ← Voltar para solicitações
      </button>

      <div>
        <h1 className="text-xl font-semibold text-foreground">{request.employeeName}</h1>
        <p className="text-sm text-muted-foreground">
          Solicitação criada em {formatDateTime(request.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6">
              <div>
                <p className="text-xs text-muted-foreground">Rota</p>
                <p className="text-sm font-medium text-foreground">
                  {origin} → {destination}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Datas</p>
                <p className="text-sm font-medium text-foreground">{datesLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Passageiros</p>
                <p className="text-sm font-medium text-foreground">
                  {request.passengers.length} passageiro{request.passengers.length > 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-6">
              <h2 className="text-base font-semibold text-foreground">Contexto da viagem</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {request.corporate.business_justification}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Avaliação de política</h2>
              <PolicyBadges evaluation={request.policy_evaluation} />
              {!request.policy_evaluation.compliant ? (
                <div className="flex flex-col gap-2">
                  {request.policy_evaluation.violations.map((violation) => (
                    <div
                      key={violation.rule_id}
                      className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[13px] text-amber-800"
                    >
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{violation.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
              <RequestStatusBadge status={request.status} />
              {canAct ? (
                <div className="flex flex-col gap-2">
                  <Button
                    className="bg-brand-gradient hover:bg-brand-gradient-hover"
                    loading={approving}
                    onClick={handleApprove}
                  >
                    Aprovar
                  </Button>
                  <Button variant="secondary" className="text-destructive" onClick={() => setRejectOpen(true)}>
                    Rejeitar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Linha do tempo</h2>
              <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
                {request.events.map((event, index) => (
                  <div key={index} className="text-xs">
                    <p className="text-muted-foreground">{formatDateTime(event.at)}</p>
                    <p className="font-medium text-foreground">{getTravelRequestTimelineLabel(event.kind)}</p>
                    {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O funcionário será notificado com esta justificativa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Descreva o motivo da rejeição..."
            className="min-h-[96px]"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={rejecting}
              disabled={rejectReason.trim().length === 0}
              onClick={handleRejectConfirm}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
