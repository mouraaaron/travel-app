import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SECTORS } from "@/lib/badge-variants";

export async function PATCH(request: Request, { params }: { params: { sector: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar a política de viagem." },
      { status: 403 }
    );
  }

  if (!SECTORS.includes(params.sector as (typeof SECTORS)[number])) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const domesticCapBRL = Number(body?.domesticCapBRL);
  const internationalCapBRL = Number(body?.internationalCapBRL);
  const longHaulCabinHours = Number(body?.longHaulCabinHours);
  const costFlagBRL = Number(body?.costFlagBRL);

  if (
    [domesticCapBRL, internationalCapBRL, longHaulCabinHours, costFlagBRL].some(
      (n) => !Number.isFinite(n) || n < 0
    )
  ) {
    return NextResponse.json({ error: "Valores de política inválidos." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("policy_rules")
    .update({
      domestic_cap_brl: domesticCapBRL,
      international_cap_brl: internationalCapBRL,
      long_haul_cabin_hours: longHaulCabinHours,
      cost_flag_brl: costFlagBRL,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", params.sector)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível salvar a política." }, { status: 500 });
  }

  return NextResponse.json({ rule: updated });
}
