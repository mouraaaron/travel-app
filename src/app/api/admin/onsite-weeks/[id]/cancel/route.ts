import { NextResponse } from "next/server";
import type { OnsiteWeek } from "@/lib/onsite-weeks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TravelRequestEvent } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
      { error: "Apenas administradores podem cancelar uma semana presencial." },
      { status: 403 }
    );
  }

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
