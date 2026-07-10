import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestsList } from "@/components/trip/requests-list";

export default async function RequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  const requests = (rows ?? []).map(toTravelRequest);

  return <RequestsList requests={requests} />;
}
