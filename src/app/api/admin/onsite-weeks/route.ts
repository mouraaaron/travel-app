import { NextResponse } from "next/server";
import { z } from "zod";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import { deriveOnsiteWeekStatus, type TravelProfileFields } from "@/lib/onsite-weeks";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { processOnsiteWeekEmployee, type ProcessEmployeeParams } from "@/lib/onsite-weeks-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  sector: z.enum(["product", "marketing", "engineering", "founders"]),
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employee_ids: z.array(z.string().uuid()).min(1),
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { sector, week_start_date, week_end_date, employee_ids } = parsed.data;

  if (week_end_date < week_start_date) {
    return NextResponse.json(
      { error: "A data de volta não pode ser antes da data de ida." },
      { status: 400 }
    );
  }

  // Nasce com status "completed" como placeholder — este é um fluxo síncrono
  // (sem fila em background), então o UPDATE final abaixo, ao fim do
  // processamento de todos os funcionários, roda ainda dentro da mesma
  // requisição HTTP.
  const { data: insertedWeek, error: insertWeekError } = await supabase
    .from("onsite_weeks")
    .insert({
      organization_id: adminProfile.organization_id,
      sector,
      week_start_date,
      week_end_date,
      created_by: user.id,
      status: "completed",
      employee_outcomes: [],
    })
    .select("*")
    .single();

  if (insertWeekError || !insertedWeek) {
    if (insertWeekError?.code === "23505") {
      const { data: existing } = await supabase
        .from("onsite_weeks")
        .select("id")
        .eq("organization_id", adminProfile.organization_id)
        .eq("sector", sector)
        .eq("week_start_date", week_start_date)
        .eq("week_end_date", week_end_date)
        .single();
      return NextResponse.json(
        {
          error: "Já existe uma semana presencial organizada para esse setor nessas datas.",
          existing_onsite_week_id: existing?.id ?? null,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Não foi possível criar a semana presencial." }, { status: 500 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", sector)
    .eq("status", "active")
    .in("id", employee_ids);

  const { data: ruleRow } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", sector)
    .single();
  const policyDefaults = ruleRow ? toDuffelPolicyDefaults(ruleRow as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  const outcomes = await Promise.all(
    (employeeRows ?? []).map((employee) =>
      processOnsiteWeekEmployee({
        supabase,
        organizationId: adminProfile.organization_id,
        onsiteWeekId: insertedWeek.id,
        sector,
        weekStartDate: week_start_date,
        weekEndDate: week_end_date,
        policyDefaults,
        adminId: user.id,
        employee: employee as TravelProfileFields & { id: string; full_name: string },
      } satisfies ProcessEmployeeParams)
    )
  );

  const successCount = outcomes.filter((o) => o.status === "created").length;
  const finalStatus = deriveOnsiteWeekStatus(successCount, outcomes.length - successCount);

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: finalStatus, employee_outcomes: outcomes })
    .eq("id", insertedWeek.id)
    .select("*")
    .single();

  const finalWeek = updatedWeek ?? { ...insertedWeek, status: finalStatus, employee_outcomes: outcomes };

  return NextResponse.json({ onsite_week: toOnsiteWeek(finalWeek as OnsiteWeekRow) }, { status: 201 });
}
