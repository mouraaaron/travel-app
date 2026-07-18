import { createServiceClient, findUserIdByEmail, E2E_ADMIN, E2E_EMPLOYEE } from "./support";

/**
 * Garante (de forma idempotente) os dois usuários dedicados do e2e no Supabase,
 * na mesma organização dos dados de demo. Nada dos usuários de demo é alterado.
 */
export default async function globalSetup() {
  const supabase = createServiceClient();

  const { data: orgRef, error: orgError } = await supabase
    .from("profiles")
    .select("organization_id")
    .not("organization_id", "is", null)
    .limit(1)
    .single();
  if (orgError || !orgRef) {
    throw new Error(`e2e setup: não foi possível descobrir a organização de demo (${orgError?.message}).`);
  }

  for (const account of [
    { ...E2E_EMPLOYEE, role: "employee" as const },
    { ...E2E_ADMIN, role: "admin" as const },
  ]) {
    const existing = await findUserIdByEmail(supabase, account.email);
    if (existing) continue;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(`e2e setup: falha ao criar ${account.email}: ${createError?.message}`);
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      full_name: account.fullName,
      email: account.email,
      role: account.role,
      status: "active",
      cost_center: "engineering",
      organization_id: orgRef.organization_id,
    });
    if (profileError) {
      throw new Error(`e2e setup: falha ao criar profile de ${account.email}: ${profileError.message}`);
    }
  }
}
