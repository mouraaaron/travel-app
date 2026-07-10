import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestDetailView } from "@/components/trip/request-detail-view";
import { RequestNotFound } from "@/components/trip/request-not-found";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("requests").select("*").eq("id", params.id).single();

  if (!row) {
    return <RequestNotFound />;
  }

  return <RequestDetailView request={toTravelRequest(row)} />;
}
