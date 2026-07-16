import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import {
  avgApprovalTimeHours,
  avgOnsiteWeekCostBySector,
  complianceRate,
  monthlySpend,
  requestsByStatus,
  requestVolumeBySector,
  spendBySector,
  spendVsPreviousMonth,
  tripPurposeBreakdown,
} from "@/lib/admin-analytics";
import { StatCards } from "@/components/admin/stat-cards";
import { SpendChart } from "@/components/admin/spend-chart";
import {
  AvgOnsiteWeekCostChart,
  SectorSpendChart,
  SectorVolumeChart,
  StatusVolumeChart,
  TripPurposeChart,
} from "@/components/admin/spend-breakdown-charts";
import { EmptyState } from "@/components/ui/empty-state";
import { inCourseFlights } from "@/lib/in-course-flights";
import { FlightPathMap } from "@/components/admin/flight-path-map";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name, cost_center)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

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
  const avgOnsiteWeekCost = avgOnsiteWeekCostBySector(requests);
  const flights = inCourseFlights(requests);

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

      <SpendChart data={monthly} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusVolumeChart data={statusVolume} />
        <SectorSpendChart data={sectorSpend} />
        <TripPurposeChart data={tripPurpose} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectorVolumeChart data={sectorVolume} />
        <AvgOnsiteWeekCostChart data={avgOnsiteWeekCost} />
      </div>

      <FlightPathMap flights={flights} />
    </div>
  );
}
