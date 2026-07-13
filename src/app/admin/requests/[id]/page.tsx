import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { AdminRequestDetailView } from "@/components/admin/request-detail-view";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function AdminRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("id", params.id)
    .single();

  if (!row) {
    return (
      <NotFoundState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/admin/requests"
        backLabel="Solicitações"
      />
    );
  }

  return <AdminRequestDetailView request={toAdminQueueRequest(row as RequestRowWithEmployee)} />;
}
