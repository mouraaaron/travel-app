import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { SECTORS, type Sector } from "@/lib/badge-variants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAdmin("Apenas administradores podem alterar o setor de um funcionário.");
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const costCenter = body?.cost_center as Sector | undefined;
  if (!costCenter || !SECTORS.includes(costCenter)) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ cost_center: costCenter })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, cost_center, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar o setor." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
