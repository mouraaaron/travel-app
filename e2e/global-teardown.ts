import { createServiceClient, findUserIdByEmail, E2E_ADMIN, E2E_EMPLOYEE } from "./support";

/**
 * Os usuários e2e são efêmeros: existem apenas durante a rodada de testes.
 * Aqui removemos as solicitações criadas e os próprios usuários (profile +
 * auth), para que nada apareça na aba de funcionários do demo.
 */
export default async function globalTeardown() {
  const supabase = createServiceClient();

  for (const account of [E2E_EMPLOYEE, E2E_ADMIN]) {
    const userId = await findUserIdByEmail(supabase, account.email);
    if (!userId) continue;
    await supabase.from("requests").delete().eq("employee_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
  }
}
