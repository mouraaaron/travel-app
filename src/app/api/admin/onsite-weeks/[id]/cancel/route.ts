import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import type { OnsiteWeek } from "@/lib/onsite-weeks";
import type { TravelRequestEvent } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAdmin(
    "Apenas administradores podem cancelar uma semana presencial.",
    "role, organization_id"
  );
  if (auth.response) return auth.response;
  const { supabase, user, adminProfile } = auth;

  const { data: week } = await supabase
    .from("onsite_weeks")
    .select("id, status")
    .eq("id", params.id)
    .eq("organization_id", adminProfile.organization_id)
    .single();
  if (!week) {
    return NextResponse.json({ error: "Semana presencial não encontrada." }, { status: 404 });
  }
  if (week.status === "cancelled") {
    return NextResponse.json({ error: "Essa semana presencial já está cancelada." }, { status: 409 });
  }

  const { data: openRequests } = await supabase
    .from("requests")
    .select("id, events")
    .eq("onsite_week_id", params.id)
    .neq("status", "cancelled");

  const now = new Date().toISOString();
  const cancelEvent: TravelRequestEvent = { at: now, kind: "cancelled", actor_id: user.id };

  for (const openRequest of openRequests ?? []) {
    await supabase
      .from("requests")
      .update({ status: "cancelled", events: [...(openRequest.events as TravelRequestEvent[]), cancelEvent] })
      .eq("id", openRequest.id);
  }

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", params.id)
    .select("*")
    .single();

  if (!updatedWeek) {
    return NextResponse.json({ error: "Não foi possível cancelar a semana presencial." }, { status: 500 });
  }

  return NextResponse.json({
    onsite_week: updatedWeek as OnsiteWeek,
    cancelled_requests: (openRequests ?? []).length,
  });
}
