import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeRole } from "@/lib/badge-variants";

const VALID_ROLES: EmployeeRole[] = ["employee", "admin"];

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
      { error: "Apenas administradores podem alterar a função de um funcionário." },
      { status: 403 }
    );
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: "Você não pode alterar sua própria função." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar a função." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
