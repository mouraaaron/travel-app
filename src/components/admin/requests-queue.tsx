"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import { filterRequestsForQueue, type AdminQueueTab } from "@/lib/admin-requests";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import { cn, initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function RequestsQueue({ requests }: { requests: AdminQueueRequest[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminQueueTab>("pending");
  const [query, setQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterRequestsForQueue(requests, { tab, query }),
    [requests, tab, query]
  );

  async function handleQuickApprove(id: string) {
    setApprovingId(id);
    try {
      const response = await fetch(`/api/admin/requests/${id}/approve`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível aprovar a solicitação.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Não foi possível aprovar a solicitação.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Solicitações</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AdminQueueTab)}>
          <TabsList indicator={false}>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "all" ? (
          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por funcionário ou rota"
              className="pl-8"
            />
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "pending" ? "Nenhuma solicitação pendente" : "Nenhuma solicitação encontrada"}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
          {filtered.map((request) => {
            const snapshot = request.selected_offer_snapshot;
            const { origin, destination } = getRouteLabel(snapshot.slices);
            const outOfPolicy = !request.policy_evaluation.compliant;
            const policyBadge = getDuffelPolicyBadge(request.policy_evaluation);
            const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
            const isOnsiteWeek = request.onsite_week_id !== null;
            const canQuickApprove =
              request.status === "pending_admin" &&
              !outOfPolicy &&
              !request.policy_evaluation.flags.cost_above_threshold;

            return (
              <div
                key={request.id}
                className={cn(
                  "flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between",
                  outOfPolicy && "border-l-[3px] border-l-amber-500 bg-amber-50/40"
                )}
              >
                <div className="flex gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initialsFromName(request.employeeName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{request.employeeName}</span>
                      <RequestStatusBadge status={request.status} />
                      {isOnsiteWeek ? <Badge variant="info">Semana Presencial</Badge> : null}
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {origin} → {destination} · {request.passengers.length} passageiro
                      {request.passengers.length > 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
                      {flagBadges.map((badge) => (
                        <Badge key={badge.label} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(request.created_at)}</span>
                  <div className="flex gap-2">
                    {canQuickApprove ? (
                      <Button
                        variant="success"
                        size="sm"
                        loading={approvingId === request.id}
                        onClick={() => handleQuickApprove(request.id)}
                      >
                        Aprovar
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/requests/${request.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
