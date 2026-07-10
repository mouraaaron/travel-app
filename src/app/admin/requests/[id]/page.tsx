import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { AdminRequestDetailView } from "@/components/admin/request-detail-view";
import { RequestNotFound } from "@/components/trip/request-not-found";

export default async function AdminRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("id", params.id)
    .single();

  if (!row) {
    return <RequestNotFound backHref="/admin/requests" backLabel="Solicitações" />;
  }

  return <AdminRequestDetailView request={toAdminQueueRequest(row as RequestRowWithEmployee)} />;
}
