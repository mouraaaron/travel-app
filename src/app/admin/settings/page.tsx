import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PolicyRulesForm } from "@/components/admin/policy-rules-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PolicyRuleRow } from "@/lib/policy-rules";

export default async function AdminSettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase.from("policy_rules").select("*").order("sector", { ascending: true });
  const rules = (rows ?? []) as PolicyRuleRow[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      <div>
        <h2 className="text-base font-semibold text-foreground">Política de viagem por setor</h2>
        <p className="text-sm text-muted-foreground">
          Cada setor tem seus próprios tetos de gasto e regras de classe executiva. Alterações valem para novas
          solicitações a partir de agora.
        </p>
      </div>
      {rules.length === 0 ? (
        <EmptyState title="Nenhuma política de viagem cadastrada ainda" />
      ) : (
        <PolicyRulesForm rules={rules} />
      )}

      <div>
        <h2 className="text-base font-semibold text-foreground">Schema do banco de dados</h2>
        <p className="text-sm text-muted-foreground">
          Diagrama interativo das tabelas e como elas se relacionam.
        </p>
        <Button variant="secondary" size="sm" asChild className="mt-3 w-fit">
          <Link href="/dev/schema" target="_blank">
            Ver diagrama do schema
          </Link>
        </Button>
      </div>
    </div>
  );
}
