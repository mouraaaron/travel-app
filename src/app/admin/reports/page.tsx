import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { EmployeeRankingTable } from "@/components/admin/employee-ranking-table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminReportsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
      {requests.length === 0 ? (
        <EmptyState title="Nenhuma solicitação registrada ainda" />
      ) : (
        <EmployeeRankingTable requests={requests} />
      )}
    </div>
  );
}
