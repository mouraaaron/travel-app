import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { suggestPlaces } from "@/lib/duffel/client";
import { searchAirports, type AirportOption } from "@/lib/airports";

const querySchema = z.string().trim().min(2);

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(searchParams.get("query"));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro query inválido (mínimo 2 caracteres)." },
      { status: 400 }
    );
  }

  const query = parsed.data;
  const remoteOptions = await suggestPlaces(query);

  if (!remoteOptions || remoteOptions.length === 0) {
    return NextResponse.json({ options: searchAirports(query), source: "local" });
  }

  return NextResponse.json({
    options: mergeWithLocalFallback(remoteOptions, query),
    source: "remote",
  });
}

function mergeWithLocalFallback(remoteOptions: AirportOption[], query: string): AirportOption[] {
  const localOptions = searchAirports(query);
  const seenCodes = new Set(remoteOptions.map((option) => option.code));
  const merged = [...remoteOptions];
  for (const local of localOptions) {
    if (!seenCodes.has(local.code)) merged.push(local);
  }
  return merged;
}
