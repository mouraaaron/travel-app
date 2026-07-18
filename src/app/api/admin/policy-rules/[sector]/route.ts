import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { SECTORS } from "@/lib/badge-variants";

export async function PATCH(request: Request, { params }: { params: { sector: string } }) {
  const auth = await requireApiAdmin(
    "Apenas administradores podem alterar a política de viagem.",
    "role, organization_id"
  );
  if (auth.response) return auth.response;
  const { supabase, adminProfile } = auth;

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
