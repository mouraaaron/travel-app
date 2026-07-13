import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SECTORS, type Sector } from "@/lib/badge-variants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar o setor de um funcionário." },
      { status: 403 }
    );
  }

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
