import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

const APPROVABLE_STATUSES = ["pending_admin", "needs_review"] as const;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
      { error: "Apenas administradores podem aprovar solicitações." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (!APPROVABLE_STATUSES.includes(existing.status as (typeof APPROVABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Só é possível aprovar solicitações pendentes ou que precisam de revisão." },
      { status: 409 }
    );
  }

  const approveEvent: TravelRequestEvent = {
    at: new Date().toISOString(),
    kind: "approved",
    actor_id: user.id,
  };
  const events = [...(existing.events as TravelRequestEvent[]), approveEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "approved", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível aprovar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
