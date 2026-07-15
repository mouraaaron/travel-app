import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestsList } from "@/components/trip/requests-list";
import { getCurrentProfile } from "@/lib/session";

export default async function RequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*")
    .eq("employee_id", profile.id)
    .order("created_at", { ascending: false });

  const requests = (rows ?? []).map(toTravelRequest);

  return <RequestsList requests={requests} />;
}
