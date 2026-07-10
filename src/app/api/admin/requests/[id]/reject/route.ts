import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

const REJECTABLE_STATUSES = ["pending_admin", "needs_review"] as const;

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "Informe o motivo da rejeição."),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem rejeitar solicitações." },
      { status: 403 }
    );
  }

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
