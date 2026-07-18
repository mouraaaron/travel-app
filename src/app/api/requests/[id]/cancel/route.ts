import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (existing.status !== "pending_admin") {
    return NextResponse.json(
      { error: "Só é possível cancelar solicitações aguardando aprovação." },
      { status: 409 }
    );
  }

  const cancelEvent: TravelRequestEvent = { at: new Date().toISOString(), kind: "cancelled" };
  const events = [...(existing.events as TravelRequestEvent[]), cancelEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "cancelled", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível cancelar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
