import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const E2E_EMPLOYEE = {
  email: "e2e-employee@demo-paggo.com",
  password: "E2e#Traveler2026",
  fullName: "E2E Traveler",
};

export const E2E_ADMIN = {
  email: "e2e-admin@demo-paggo.com",
  password: "E2e#Admin2026",
  fullName: "E2E Admin",
};

function loadEnvLocal(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function createServiceClient(): SupabaseClient {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários no .env.local para o e2e.");
  }
  return createClient(url, key);
}

export async function findUserIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}
