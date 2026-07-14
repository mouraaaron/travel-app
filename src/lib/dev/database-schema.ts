// Descrição estática do schema do banco (transcrita das migrations em
// supabase/migrations/0001..0005) para alimentar o diagrama ReactFlow em
// src/app/dev/schema. Não há introspecção automática: se o schema mudar,
// este arquivo precisa ser atualizado à mão.

export type ColumnFlag = "pk" | "fk" | "unique";

export interface SchemaColumn {
  name: string;
  type: string;
  flags?: ColumnFlag[];
  nullable?: boolean;
  check?: string;
  note?: string;
}

export interface SchemaTable {
  id: string;
  name: string;
  external?: boolean;
  rls?: boolean;
  note?: string;
  columns: SchemaColumn[];
}

export interface SchemaEdge {
  id: string;
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
  label: string;
  dashed?: boolean;
}

export const schemaTables: SchemaTable[] = [
  {
    id: "auth.users",
    name: "auth.users",
    external: true,
    note: "Gerenciado pelo Supabase Auth. Não existe nas migrations do app — profiles.id referencia esta tabela.",
    columns: [
      { name: "id", type: "uuid", flags: ["pk"] },
      { name: "email", type: "text" },
    ],
  },
  {
    id: "organizations",
    name: "organizations",
    rls: true,
    columns: [
      { name: "id", type: "uuid", flags: ["pk"], note: "default gen_random_uuid()" },
      { name: "name", type: "text" },
      { name: "created_at", type: "timestamptz", note: "default now()" },
    ],
  },
  {
    id: "profiles",
    name: "profiles",
    rls: true,
    note: "Estende auth.users com organização e papel do usuário.",
    columns: [
      { name: "id", type: "uuid", flags: ["pk", "fk"], note: "→ auth.users.id, on delete cascade" },
      { name: "organization_id", type: "uuid", flags: ["fk"] },
      { name: "role", type: "text", check: "role in ('employee', 'admin')" },
      { name: "full_name", type: "text" },
      { name: "created_at", type: "timestamptz", note: "default now()" },
      { name: "email", type: "text", note: "copiado de auth.users na criação" },
      { name: "status", type: "text", check: "status in ('active', 'inactive')", note: "default 'active'" },
      {
        name: "cost_center",
        type: "text",
        check: "cost_center in ('product', 'marketing', 'engineering', 'founders')",
        note: "setor do funcionário (nome legado da coluna)",
      },
    ],
  },
  {
    id: "requests",
    name: "requests",
    rls: true,
    note: "Uma linha por solicitação de viagem criada pelo employee.",
    columns: [
      { name: "id", type: "uuid", flags: ["pk"], note: "default gen_random_uuid()" },
      { name: "organization_id", type: "uuid", flags: ["fk"] },
      { name: "employee_id", type: "uuid", flags: ["fk"] },
      {
        name: "status",
        type: "text",
        check: "status in ('pending_admin', 'approved', 'rejected', 'needs_review', 'confirmed', 'cancelled')",
        note: "default 'pending_admin'",
      },
      { name: "total_amount", type: "numeric" },
      { name: "total_currency", type: "text" },
      { name: "created_at", type: "timestamptz", note: "default now()" },
      { name: "search_criteria", type: "jsonb" },
      { name: "selected_offer_snapshot", type: "jsonb" },
      { name: "passengers", type: "jsonb" },
      { name: "corporate", type: "jsonb" },
      { name: "policy_evaluation", type: "jsonb" },
      { name: "events", type: "jsonb", note: "default '[]'" },
    ],
  },
  {
    id: "policy_rules",
    name: "policy_rules",
    rls: true,
    note: "Uma linha por setor: limites de política de viagem.",
    columns: [
      { name: "id", type: "uuid", flags: ["pk"], note: "default gen_random_uuid()" },
      { name: "organization_id", type: "uuid", flags: ["fk", "unique"], note: "unique com sector" },
      {
        name: "sector",
        type: "text",
        flags: ["unique"],
        check: "sector in ('product', 'marketing', 'engineering', 'founders')",
        note: "unique com organization_id",
      },
      { name: "domestic_cap_brl", type: "numeric" },
      { name: "international_cap_brl", type: "numeric" },
      { name: "long_haul_cabin_hours", type: "numeric" },
      { name: "cost_flag_brl", type: "numeric" },
      { name: "updated_at", type: "timestamptz", note: "default now()" },
    ],
  },
];

export const schemaEdges: SchemaEdge[] = [
  {
    id: "profiles-organizations",
    source: "profiles",
    sourceColumn: "organization_id",
    target: "organizations",
    targetColumn: "id",
    label: "organization_id",
  },
  {
    id: "requests-organizations",
    source: "requests",
    sourceColumn: "organization_id",
    target: "organizations",
    targetColumn: "id",
    label: "organization_id",
  },
  {
    id: "requests-profiles",
    source: "requests",
    sourceColumn: "employee_id",
    target: "profiles",
    targetColumn: "id",
    label: "employee_id",
  },
  {
    id: "policy_rules-organizations",
    source: "policy_rules",
    sourceColumn: "organization_id",
    target: "organizations",
    targetColumn: "id",
    label: "organization_id",
  },
  {
    id: "profiles-auth_users",
    source: "profiles",
    sourceColumn: "id",
    target: "auth.users",
    targetColumn: "id",
    label: "extends",
    dashed: true,
  },
];
