import { createSupabaseServerClient } from "./supabase/server";

export interface CurrentProfile {
  id: string;
  organizationId: string;
  role: "employee" | "admin";
  fullName: string;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") return null;

  return {
    id: profile.id,
    organizationId: profile.organization_id,
    role: profile.role as "employee" | "admin",
    fullName: profile.full_name,
  };
}
