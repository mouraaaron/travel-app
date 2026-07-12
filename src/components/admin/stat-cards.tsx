import { ArrowDown, ArrowUp, CheckCircle2, Clock, ListChecks, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/offer-format";

interface StatCardsProps {
  totalSpend: number;
  spendDeltaPct: number;
  complianceRatePct: number;
  avgApprovalTimeHours: number;
  totalRequests: number;
}

export function StatCards({
  totalSpend,
  spendDeltaPct,
  complianceRatePct,
  avgApprovalTimeHours,
  totalRequests,
}: StatCardsProps) {
  const isUp = spendDeltaPct >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Gasto total (mês atual)</CardDescription>
          <Wallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{formatCurrency(totalSpend, "BRL")}</CardTitle>
          <Badge variant={isUp ? "default" : "secondary"} className="w-fit gap-1">
            {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(spendDeltaPct).toFixed(1)}% vs. mês anterior
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Taxa de compliance</CardDescription>
          <CheckCircle2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{complianceRatePct.toFixed(1)}%</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Tempo médio de aprovação</CardDescription>
          <Clock className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{avgApprovalTimeHours.toFixed(1)}h</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Volume de solicitações</CardDescription>
          <ListChecks className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{totalRequests}</CardTitle>
        </CardContent>
      </Card>
    </div>
  );
}
