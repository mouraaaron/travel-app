import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeeActions } from "@/components/admin/employee-actions";
import { EmployeeSummaryCards } from "@/components/admin/employee-summary-cards";
import { EmployeeTravelProfileForm } from "@/components/admin/employee-travel-profile-form";
import { NotFoundState } from "@/components/layout/not-found-state";
import { getEmployeeStatusBadge, getRoleBadge, getSectorBadge } from "@/lib/badge-variants";
import { outOfPolicyByEmployee, spendByEmployee } from "@/lib/admin-analytics";
import type { Employee } from "@/lib/employees";
import { formatDate } from "@/lib/offer-format";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { getCurrentProfile } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initialsFromName } from "@/lib/utils";

export default async function AdminEmployeeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const currentProfile = await getCurrentProfile();

  const { data: employeeRow } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, status, cost_center, created_at, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("id", params.id)
    .single();

  if (!employeeRow) {
    return (
      <NotFoundState
        title="Funcionário não encontrado"
        description="Ele pode ter sido removido, ou você não tem acesso a ele."
        backHref="/admin/employees"
        backLabel="Funcionários"
      />
    );
  }

  const employee = employeeRow as Employee;

  const { data: requestRows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("employee_id", params.id);

  const employeeRequests = ((requestRows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);
  const totalSpend = spendByEmployee(employeeRequests)[0]?.total ?? 0;
  const violationCount = outOfPolicyByEmployee(employeeRequests)[0]?.count ?? 0;

  const roleBadge = getRoleBadge(employee.role);
  const statusBadge = getEmployeeStatusBadge(employee.status);
  const sectorBadge = getSectorBadge(employee.cost_center);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/employees">← Funcionários</Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initialsFromName(employee.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground">{employee.full_name}</span>
            <span className="text-sm text-muted-foreground">{employee.email}</span>
            <span className="text-xs text-muted-foreground">
              Desde {formatDate(employee.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </div>

      <EmployeeSummaryCards
        totalSpend={totalSpend}
        requestCount={employeeRequests.length}
        violationCount={violationCount}
      />

      <Button variant="secondary" size="sm" asChild className="w-fit">
        <Link href="/admin/reports">Ver relatório completo</Link>
      </Button>

      <EmployeeActions
        employeeId={employee.id}
        role={employee.role}
        status={employee.status}
        costCenter={employee.cost_center}
        isSelf={currentProfile?.id === employee.id}
      />

      <EmployeeTravelProfileForm employeeId={employee.id} profile={employee} />
    </div>
  );
}
