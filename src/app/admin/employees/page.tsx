import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Employee } from "@/lib/employees";
import { EmployeesTable } from "@/components/admin/employees-table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminEmployeesPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, cost_center, created_at")
    .order("full_name", { ascending: true });

  const employees = (rows ?? []) as Employee[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Funcionários</h1>
      {employees.length === 0 ? (
        <EmptyState title="Nenhum funcionário cadastrado ainda" />
      ) : (
        <EmployeesTable employees={employees} />
      )}
    </div>
  );
}
