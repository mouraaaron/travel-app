import { BarChart3 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import {
  avgApprovalTimeHours,
  complianceRate,
  monthlySpend,
  recentOutOfPolicy,
  requestsByStatus,
  spendByCostCenter,
  spendVsPreviousMonth,
  tripPurposeBreakdown,
} from "@/lib/admin-analytics";
import { StatCards } from "@/components/admin/stat-cards";
import { SpendChart } from "@/components/admin/spend-chart";
import { OutOfPolicyPanel } from "@/components/admin/out-of-policy-panel";
import {
  CostCenterRankingChart,
  StatusVolumeChart,
  TripPurposeChart,
} from "@/components/admin/spend-breakdown-charts";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-foreground">Painel</h1>
        <EmptyState icon={BarChart3} title="Nenhuma solicitação registrada ainda" />
      </div>
    );
  }

  const monthly = monthlySpend(requests);
  const spendDelta = spendVsPreviousMonth(monthly);
  const compliance = complianceRate(requests);
  const avgApproval = avgApprovalTimeHours(requests);
  const statusVolume = requestsByStatus(requests);
  const costCenterRanking = spendByCostCenter(requests);
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
        <CostCenterRankingChart data={costCenterRanking} />
        <TripPurposeChart data={tripPurpose} />
      </div>
    </div>
  );
}
