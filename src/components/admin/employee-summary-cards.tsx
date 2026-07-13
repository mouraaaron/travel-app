import { ListChecks, ShieldAlert, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/offer-format";

interface EmployeeSummaryCardsProps {
  totalSpend: number;
  requestCount: number;
  violationCount: number;
}

export function EmployeeSummaryCards({
  totalSpend,
  requestCount,
  violationCount,
}: EmployeeSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Gasto total</CardDescription>
          <Wallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{formatCurrency(totalSpend, "BRL")}</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Solicitações</CardDescription>
          <ListChecks className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{requestCount}</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Desvios de política</CardDescription>
          <ShieldAlert className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{violationCount}</CardTitle>
        </CardContent>
      </Card>
    </div>
  );
}
