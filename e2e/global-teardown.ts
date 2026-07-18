import { createServiceClient, findUserIdByEmail, E2E_EMPLOYEE } from "./support";

/**
 * Remove as solicitações criadas pelos testes para não acumular lixo no banco
 * de demo. Os usuários e2e são mantidos (o setup é idempotente).
 */
export default async function globalTeardown() {
  const supabase = createServiceClient();
  const employeeId = await findUserIdByEmail(supabase, E2E_EMPLOYEE.email);
  if (!employeeId) return;
  await supabase.from("requests").delete().eq("employee_id", employeeId);
}
