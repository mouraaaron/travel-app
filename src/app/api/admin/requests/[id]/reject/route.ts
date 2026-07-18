import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api-auth";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

const REJECTABLE_STATUSES = ["pending_admin", "needs_review"] as const;

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "Informe o motivo da rejeição."),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAdmin("Apenas administradores podem rejeitar solicitações.");
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (!REJECTABLE_STATUSES.includes(existing.status as (typeof REJECTABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Só é possível rejeitar solicitações pendentes ou que precisam de revisão." },
      { status: 409 }
    );
  }

  const rejectEvent: TravelRequestEvent = {
    at: new Date().toISOString(),
    kind: "rejected",
    actor_id: user.id,
    note: parsed.data.reason,
  };
  const events = [...(existing.events as TravelRequestEvent[]), rejectEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "rejected", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível rejeitar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
