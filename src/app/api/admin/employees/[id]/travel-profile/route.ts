import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const travelProfileSchema = z.object({
  origin_airport_code: z.string().length(3),
  given_name: z.string().trim().min(1),
  family_name: z.string().trim().min(1),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "mrs", "ms", "miss", "dr"]),
  phone_number: z.string().trim().min(8),
});

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
      { error: "Apenas administradores podem alterar o perfil de viagem de um funcionário." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = travelProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de perfil de viagem inválidos." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", params.id)
    .select(
      "id, full_name, email, role, status, cost_center, created_at, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível salvar o perfil de viagem." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
