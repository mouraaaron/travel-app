import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeStatus } from "@/lib/badge-variants";

const VALID_STATUSES: EmployeeStatus[] = ["active", "inactive"];

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
      { error: "Apenas administradores podem ativar ou desativar um funcionário." },
      { status: 403 }
    );
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: "Você não pode desativar sua própria conta." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar o status." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
