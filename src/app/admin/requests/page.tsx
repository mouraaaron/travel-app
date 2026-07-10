import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { RequestsQueue } from "@/components/admin/requests-queue";

export default async function AdminRequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  return <RequestsQueue requests={requests} />;
}
