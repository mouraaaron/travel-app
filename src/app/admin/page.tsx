import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { toEmployee, type EmployeeRow } from "@/lib/employees-mapper";
import {
  avgApprovalTimeHours,
  complianceRate,
  headcountBySector,
  monthlySpend,
  recentOutOfPolicy,
  requestsByStatus,
  requestVolumeBySector,
  spendBySector,
  spendVsPreviousMonth,
  tripPurposeBreakdown,
} from "@/lib/admin-analytics";
import { StatCards } from "@/components/admin/stat-cards";
import { SpendChart } from "@/components/admin/spend-chart";
import { OutOfPolicyPanel } from "@/components/admin/out-of-policy-panel";
import {
  SectorHeadcountChart,
  SectorSpendChart,
  SectorVolumeChart,
  StatusVolumeChart,
  TripPurposeChart,
} from "@/components/admin/spend-breakdown-charts";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name, cost_center)")
    .order("created_at", { ascending: true });

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, cost_center, created_at");

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);
  const employees = ((employeeRows ?? []) as EmployeeRow[]).map(toEmployee);
  const headcount = headcountBySector(employees);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-foreground">Painel</h1>
        <EmptyState title="Nenhuma solicitação registrada ainda" />
      </div>
    );
  }

  const monthly = monthlySpend(requests);
  const spendDelta = spendVsPreviousMonth(monthly);
  const compliance = complianceRate(requests);
  const avgApproval = avgApprovalTimeHours(requests);
  const statusVolume = requestsByStatus(requests);
  const sectorSpend = spendBySector(requests);
  const sectorVolume = requestVolumeBySector(requests);
  const tripPurpose = tripPurposeBreakdown(requests);
  const outOfPolicy = recentOutOfPolicy(requests);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Painel</h1>

      <StatCards
        totalSpend={spendDelta.current}
        spendDeltaPct={spendDelta.deltaPct}
        complianceRatePct={compliance.ratePct}
        avgApprovalTimeHours={avgApproval}
        totalRequests={requests.length}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendChart data={monthly} />
        </div>
        <OutOfPolicyPanel requests={outOfPolicy} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusVolumeChart data={statusVolume} />
        <SectorSpendChart data={sectorSpend} />
        <TripPurposeChart data={tripPurpose} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectorVolumeChart data={sectorVolume} />
        <SectorHeadcountChart data={headcount} />
      </div>
    </div>
  );
}
