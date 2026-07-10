import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DuffelSearchError, searchFlights } from "@/lib/duffel/client";
import type { SearchCriteria } from "@/lib/types";

const searchCriteriaSchema = z.object({
  slices: z
    .array(
      z.object({
        origin: z.string().length(3),
        destination: z.string().length(3),
        departure_date: z.string().min(1),
      })
    )
    .min(1),
  passengers: z
    .array(z.object({ type: z.enum(["adult", "child", "infant_without_seat"]) }))
    .min(1),
  cabin_class: z.enum(["economy", "premium_economy", "business", "first"]),
  max_connections: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  preferences: z
    .object({
      arrive_by_outbound: z.string().optional(),
      depart_after_return: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = searchCriteriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Critérios de busca inválidos." }, { status: 400 });
  }

  try {
    const offers = await searchFlights(parsed.data as SearchCriteria);
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof DuffelSearchError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erro inesperado ao buscar voos." }, { status: 500 });
  }
}
