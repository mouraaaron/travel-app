"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnsiteWeekStatusBadge, getSectorBadge, SECTOR_LABELS } from "@/lib/badge-variants";
import { formatDate } from "@/lib/offer-format";
import type { OnsiteWeek } from "@/lib/onsite-weeks-mapper";

export function OnsiteWeekDetail({ onsiteWeek }: { onsiteWeek: OnsiteWeek }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const statusBadge = getOnsiteWeekStatusBadge(onsiteWeek.status);
  const sectorBadge = getSectorBadge(onsiteWeek.sector);
  const failed = onsiteWeek.employee_outcomes.filter((o) => o.status === "failed");

  async function handleRetry() {
    setRetrying(true);
    try {
      const response = await fetch(`/api/admin/onsite-weeks/${onsiteWeek.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: failed.map((o) => o.employee_id) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível tentar novamente.");
        return;
      }
      toast.success("Tentativa concluída.");
      router.refresh();
    } catch {
      toast.error("Não foi possível tentar novamente.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      const response = await fetch(`/api/admin/onsite-weeks/${onsiteWeek.id}/cancel`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível cancelar a semana presencial.");
        return;
      }
      toast.success("Semana presencial cancelada.");
      setCancelOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível cancelar a semana presencial.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/onsite-weeks">← Semanas Presenciais</Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">{SECTOR_LABELS[onsiteWeek.sector]}</h1>
          <span className="text-sm text-muted-foreground">
            {formatDate(onsiteWeek.week_start_date)} – {formatDate(onsiteWeek.week_end_date)}
          </span>
        </div>
        <div className="flex gap-2">
          <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Funcionário</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {onsiteWeek.employee_outcomes.map((outcome) => (
            <TableRow key={outcome.employee_id}>
              <TableCell className="text-foreground">{outcome.employee_name}</TableCell>
              <TableCell>
                {outcome.status === "created" ? (
                  <Link href={`/admin/requests/${outcome.request_id}`} className="text-primary hover:underline">
                    Solicitação criada
                  </Link>
                ) : (
                  <span className="text-destructive">{outcome.error_message ?? "Falhou"}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {onsiteWeek.status !== "cancelled" ? (
        <div className="flex items-center gap-2">
          {failed.length > 0 ? (
            <Button variant="secondary" disabled={retrying} onClick={handleRetry}>
              {retrying ? "Tentando novamente..." : `Tentar novamente (${failed.length})`}
            </Button>
          ) : null}
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>
            Cancelar semana presencial
          </Button>
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar semana presencial</DialogTitle>
            <DialogDescription>
              Isso cancela todas as solicitações de viagem geradas por este lote. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={handleCancelConfirm}>
              {cancelling ? "Cancelando..." : "Cancelar semana presencial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
