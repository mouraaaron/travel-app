import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeRequestsTable } from "@/components/admin/employee-requests-table";
import { SpendChart } from "@/components/admin/spend-chart";
import { monthlySpend } from "@/lib/admin-analytics";
import { getDuffelFlagBadges } from "@/lib/badge-variants";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

interface EmployeeDetailProps {
  employeeId: string;
  employeeName: string;
  requests: AdminQueueRequest[];
}

export function EmployeeDetail({ employeeId, employeeName, requests }: EmployeeDetailProps) {
  const employeeRequests = requests.filter((request) => request.employee_id === employeeId);
  const monthly = monthlySpend(employeeRequests);
  const outOfPolicy = [...employeeRequests]
    .filter((request) => !request.policy_evaluation.compliant)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Tabs defaultValue="all">
      <TabsList indicator={false}>
        <TabsTrigger value="all">Todas</TabsTrigger>
        <TabsTrigger value="spend">Gasto mensal</TabsTrigger>
        <TabsTrigger value="violations">Desvios de política</TabsTrigger>
      </TabsList>

      <TabsContent value="all">
        <EmployeeRequestsTable requests={employeeRequests} />
      </TabsContent>

      <TabsContent value="spend">
        <SpendChart data={monthly} title="Gasto mensal" description={employeeName} />
      </TabsContent>

      <TabsContent value="violations">
        <Card>
          <CardHeader>
            <CardTitle>Desvios de política — {employeeName}</CardTitle>
          </CardHeader>
          <CardContent>
            {outOfPolicy.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nenhum desvio de política" size="tiny" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outOfPolicy.map((request) => {
                    const snapshot = request.selected_offer_snapshot;
                    const { origin, destination } = getRouteLabel(snapshot.slices);
                    const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>
                              {origin} → {destination}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {flagBadges.map((badge) => (
                                <Badge key={badge.label} variant={badge.variant}>
                                  {badge.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-muted-foreground">
                          {request.corporate.out_of_policy_justification ?? "—"}
                        </TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
