import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminProfile {
  role: string;
  organization_id: string;
  [column: string]: unknown;
}

export async function requireApiUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
      supabase,
      user: null,
    } as const;
  }
  return { response: null, supabase, user } as const;
}

export async function requireApiAdmin(forbiddenMessage: string, select = "role") {
  const auth = await requireApiUser();
  if (auth.response) {
    return {
      response: auth.response,
      supabase: auth.supabase,
      user: null,
      adminProfile: null,
    } as const;
  }
  const { supabase, user } = auth;

  const { data } = await supabase.from("profiles").select(select).eq("id", user.id).single();
  const adminProfile = data as AdminProfile | null;
  if (!adminProfile || adminProfile.role !== "admin") {
    return {
      response: NextResponse.json({ error: forbiddenMessage }, { status: 403 }),
      supabase,
      user,
      adminProfile: null,
    } as const;
  }

  return { response: null, supabase, user, adminProfile } as const;
}
