import { NextResponse } from "next/server";
import { z } from "zod";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import {
  deriveOnsiteWeekStatus,
  mergeOnsiteWeekOutcomes,
  type OnsiteWeek,
  type TravelProfileFields,
} from "@/lib/onsite-weeks";
import { processOnsiteWeekEmployee, type ProcessEmployeeParams } from "@/lib/onsite-weeks-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const retrySchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  const { data: week } = await supabase
    .from("onsite_weeks")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", adminProfile.organization_id)
    .single();
  if (!week) {
    return NextResponse.json({ error: "Semana presencial não encontrada." }, { status: 404 });
  }
  if (week.status === "cancelled") {
    return NextResponse.json(
      { error: "Não é possível tentar novamente uma semana presencial cancelada." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", week.sector)
    .eq("status", "active")
    .in("id", parsed.data.employee_ids);

  const { data: ruleRow } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", week.sector)
    .single();
  const policyDefaults = ruleRow ? toDuffelPolicyDefaults(ruleRow as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  const newOutcomes = await Promise.all(
    (employeeRows ?? []).map((employee) =>
      processOnsiteWeekEmployee({
        supabase,
        organizationId: adminProfile.organization_id,
        onsiteWeekId: week.id,
        sector: week.sector,
        weekStartDate: week.week_start_date,
        weekEndDate: week.week_end_date,
        policyDefaults,
        adminId: user.id,
        employee: employee as TravelProfileFields & { id: string; full_name: string },
      } satisfies ProcessEmployeeParams)
    )
  );

  const mergedOutcomes = mergeOnsiteWeekOutcomes(week.employee_outcomes, newOutcomes);
  const successCount = mergedOutcomes.filter((o) => o.status === "created").length;
  const finalStatus = deriveOnsiteWeekStatus(mergedOutcomes.length - successCount);

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: finalStatus, employee_outcomes: mergedOutcomes })
    .eq("id", week.id)
    .select("*")
    .single();

  return NextResponse.json({
    onsite_week: (updatedWeek ?? { ...week, status: finalStatus, employee_outcomes: mergedOutcomes }) as OnsiteWeek,
  });
}
