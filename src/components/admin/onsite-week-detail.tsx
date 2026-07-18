"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { mutateWithToast } from "@/lib/client-mutation";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import type { OnsiteWeek } from "@/lib/onsite-weeks";

export interface RequestCost {
  amount: number;
  currency: string;
}

export function OnsiteWeekDetail({
  onsiteWeek,
  requestCosts,
}: {
  onsiteWeek: OnsiteWeek;
  requestCosts: Record<string, RequestCost>;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const statusBadge = getOnsiteWeekStatusBadge(onsiteWeek.status);
  const sectorBadge = getSectorBadge(onsiteWeek.sector);
  const failed = onsiteWeek.employee_outcomes.filter((o) => o.status === "failed");

  const createdCosts = onsiteWeek.employee_outcomes
    .filter((o) => o.status === "created" && o.request_id)
    .map((o) => requestCosts[o.request_id as string])
    .filter((cost): cost is RequestCost => cost !== undefined);
  const totalCost = createdCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const totalCostCurrency = createdCosts[0]?.currency ?? "BRL";

  const entranceMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, delay: 0.08, ease: "easeOut" as const },
      };

  async function handleRetry() {
    setRetrying(true);
    const { ok } = await mutateWithToast(
      `/api/admin/onsite-weeks/${onsiteWeek.id}/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: failed.map((o) => o.employee_id) }),
      },
      { success: "Tentativa concluída.", error: "Não foi possível tentar novamente." }
    );
    if (ok) router.refresh();
    setRetrying(false);
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    const { ok } = await mutateWithToast(
      `/api/admin/onsite-weeks/${onsiteWeek.id}/cancel`,
      { method: "POST" },
      { success: "Semana presencial cancelada.", error: "Não foi possível cancelar a semana presencial." }
    );
    if (ok) {
      setCancelOpen(false);
      router.refresh();
    }
    setCancelling(false);
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

      <motion.div {...entranceMotionProps} className="w-fit">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo total</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-foreground">
              {formatCurrency(totalCost, totalCostCurrency)}
            </span>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...entranceMotionProps}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {onsiteWeek.employee_outcomes.map((outcome) => {
              const cost = outcome.request_id ? requestCosts[outcome.request_id] : undefined;
              return (
                <TableRow key={outcome.employee_id}>
                  <TableCell className="text-foreground">{outcome.employee_name}</TableCell>
                  <TableCell>
                    {outcome.status === "created" ? (
                      <Link
                        href={`/admin/requests/${outcome.request_id}`}
                        className="text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        Solicitação aprovada
                      </Link>
                    ) : onsiteWeek.status === "cancelled" ? (
                      <span className="text-destructive">Não ocorreu</span>
                    ) : (
                      <span className="text-destructive">{outcome.error_message ?? "Falhou"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {cost ? formatCurrency(cost.amount, cost.currency) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </motion.div>

      {onsiteWeek.status !== "cancelled" ? (
        <div className="flex items-center gap-2">
          {failed.length > 0 ? (
            <Button variant="secondary" loading={retrying} onClick={handleRetry}>
              {`Tentar novamente (${failed.length})`}
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
            <Button variant="destructive" loading={cancelling} onClick={handleCancelConfirm}>
              Cancelar semana presencial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
