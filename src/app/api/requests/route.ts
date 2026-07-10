import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";

const requestCreateSchema = z.object({
  search_criteria: z.object({
    slices: z
      .array(
        z.object({
          origin: z.string(),
          destination: z.string(),
          departure_date: z.string(),
        })
      )
      .min(1),
    passengers: z.array(z.object({ type: z.enum(["adult", "child", "infant_without_seat"]) })).min(1),
    cabin_class: z.enum(["economy", "premium_economy", "business", "first"]),
    max_connections: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    preferences: z
      .object({ arrive_by_outbound: z.string().optional(), depart_after_return: z.string().optional() })
      .optional(),
  }),
  selected_offer_snapshot: z.object({
    offer_id: z.string(),
    total_amount: z.string(),
    total_currency: z.string(),
    owner: z.object({ iata_code: z.string(), name: z.string(), logo_symbol_url: z.string() }),
    slices: z.array(z.any()),
    conditions: z.any(),
    passenger_identity_documents_required: z.boolean(),
    total_emissions_kg: z.number().optional(),
    expires_at: z.string(),
  }),
  passengers: z.array(z.any()).min(1),
  corporate: z.object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"]),
    cost_center: z.string(),
    project_code: z.string().optional(),
    business_justification: z.string(),
    out_of_policy_justification: z.string().optional(),
  }),
  policy_evaluation: z.object({
    compliant: z.boolean(),
    violations: z.array(z.any()),
    flags: z.object({ international_travel: z.boolean(), cost_above_threshold: z.boolean() }),
  }),
  events: z.array(
    z.object({ at: z.string(), kind: z.string(), actor_id: z.string().optional(), note: z.string().optional() })
  ),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados da solicitação inválidos." }, { status: 400 });
  }

  const totalAmount = Number(parsed.data.selected_offer_snapshot.total_amount);

  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({
      organization_id: profile.organization_id,
      employee_id: user.id,
      status: "pending_admin",
      total_amount: totalAmount,
      total_currency: parsed.data.selected_offer_snapshot.total_currency,
      search_criteria: parsed.data.search_criteria,
      selected_offer_snapshot: parsed.data.selected_offer_snapshot,
      passengers: parsed.data.passengers,
      corporate: parsed.data.corporate,
      policy_evaluation: parsed.data.policy_evaluation,
      events: parsed.data.events,
    })
    .select()
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Não foi possível salvar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(inserted) }, { status: 201 });
}
