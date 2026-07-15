import { NextResponse } from "next/server";
import { z } from "zod";
import { buildOnsiteWeekPreviewEmployee } from "@/lib/onsite-weeks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const previewSchema = z.object({
  sector: z.enum(["product", "marketing", "engineering", "founders"]),
});

export async function POST(request: Request) {
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
      { error: "Apenas administradores podem organizar semanas presenciais." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", parsed.data.sector)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  const employees = (employeeRows ?? []).map(buildOnsiteWeekPreviewEmployee);

  return NextResponse.json({ employees });
}
