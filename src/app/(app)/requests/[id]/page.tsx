import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestDetailView } from "@/components/trip/request-detail-view";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("requests").select("*").eq("id", params.id).single();

  if (!row) {
    return (
      <NotFoundState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/requests"
        backLabel="Minhas solicitações"
      />
    );
  }

  return <RequestDetailView request={toTravelRequest(row)} />;
}
