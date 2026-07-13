import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cost_center")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const { data: rule } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("sector", profile.cost_center)
    .single();

  const defaults = rule ? toDuffelPolicyDefaults(rule as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  return NextResponse.json({ defaults });
}
