import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getPolicyDefaults } from "@/lib/policy-rules";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cost_center")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const defaults = await getPolicyDefaults(supabase, profile.organization_id, profile.cost_center);

  return NextResponse.json({ defaults });
}
