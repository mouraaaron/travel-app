import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o reset."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada.`);
  }

  const { count: requestsBefore, error: countError } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  if (countError) {
    throw new Error(`Falha ao contar requests: ${countError.message}`);
  }

  const { data: mockEmployees, error: employeesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", org.id)
    .eq("role", "employee")
    .neq("id", DEMO_EMPLOYEE_ID);
  if (employeesError) {
    throw new Error(`Falha ao listar employees mock: ${employeesError.message}`);
  }

  console.log(
    `Antes do reset: ${requestsBefore ?? 0} requests, ${mockEmployees.length} employees mock ` +
      `(excluindo o employee demo fixo ${DEMO_EMPLOYEE_ID}). Guarde estes números para conferir depois do reseed.`
  );

  const { error: deleteRequestsError } = await supabase
    .from("requests")
    .delete()
    .eq("organization_id", org.id);
  if (deleteRequestsError) {
    throw new Error(`Falha ao apagar requests: ${deleteRequestsError.message}`);
  }

  for (const employee of mockEmployees) {
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(employee.id);
    if (deleteUserError) {
      throw new Error(`Falha ao apagar employee ${employee.id}: ${deleteUserError.message}`);
    }
  }

  console.log(
    `Reset concluído: ${requestsBefore ?? 0} requests apagadas e ${mockEmployees.length} employees mock ` +
      `apagados (profiles removidos em cascata via auth.users). Rode "npm run seed" e ` +
      `"npm run seed:sectors" agora, depois confira se o total de requests da org volta a bater com ${requestsBefore ?? 0}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
