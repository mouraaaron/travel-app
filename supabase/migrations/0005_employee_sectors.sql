-- travel-app/supabase/migrations/0005_employee_sectors.sql
-- Substitui a antiga divisão livre por cost_center (texto solto, escolhido
-- por solicitação, com listas inconsistentes entre corporate-schema.ts e
-- scripts/seed-demo-data.ts) por um setor fixo por funcionário: product,
-- marketing, engineering, founders.
--
-- O nome da coluna continua "cost_center" (decisão explícita), mas o dono e
-- o significado mudam: antes era "centro de custo da viagem" (em
-- requests.corporate, jsonb, escolhido manualmente); agora é "setor do
-- funcionário" (em profiles, coluna própria, fixo). requests.corporate
-- continua tendo cost_center dentro do jsonb, mas passa a ser uma cópia
-- congelada gravada pelo servidor no momento da criação da solicitação, não
-- mais escolhida pelo Employee — por isso não há coluna nova em `requests`
-- aqui, só a policy_rules nova e a coluna nova em profiles.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

-- ============================================================
-- 1. profiles.cost_center
--    Segue o mesmo padrão de 0004_profiles_employee_management.sql: cria a
--    coluna com um default temporário, faz o backfill explícito das 2
--    contas demo, e remove o default depois — para que todo profile criado
--    dali em diante (script de seed, futuro fluxo de admin) precise
--    informar o setor explicitamente, sem cair num valor silencioso.
-- ============================================================
alter table profiles add column if not exists cost_center text not null default 'engineering'
  check (cost_center in ('product', 'marketing', 'engineering', 'founders'));

update profiles set cost_center = 'engineering'
  where id = '39557140-a4c1-46cc-803e-021b433332ab'; -- employee@demo.com
update profiles set cost_center = 'founders'
  where id = 'b5c03efb-3a3e-42dd-96f7-45d398d3ac85'; -- admin@demo.com

alter table profiles alter column cost_center drop default;

-- ============================================================
-- 2. policy_rules
--    Uma linha por setor. Substitui o DUFFEL_POLICY_DEFAULTS hardcoded em
--    src/lib/policy.ts. As 4 linhas do único org do MVP já nascem seedadas
--    aqui, com os mesmos valores que eram hardcoded antes (para não mudar
--    o comportamento observável no dia 1) — o Travel Admin ajusta depois
--    pela tela /admin/settings.
-- ============================================================
create table if not exists policy_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  sector text not null check (sector in ('product', 'marketing', 'engineering', 'founders')),
  domestic_cap_brl numeric not null,
  international_cap_brl numeric not null,
  long_haul_cabin_hours numeric not null,
  cost_flag_brl numeric not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, sector)
);

create index if not exists policy_rules_organization_id_idx on policy_rules (organization_id);

insert into policy_rules (organization_id, sector, domestic_cap_brl, international_cap_brl, long_haul_cabin_hours, cost_flag_brl)
select id, sector, 3500, 12000, 8, 8000
from organizations, unnest(array['product', 'marketing', 'engineering', 'founders']) as sector
where name = 'Paggo (Demo)'
on conflict (organization_id, sector) do nothing;

-- ============================================================
-- 3. RLS para policy_rules
--    Mesma forma de is_org_admin() já criada em
--    0003_profiles_admin_select.sql: qualquer membro da organização pode
--    ler (o Employee precisa ler a política do próprio setor antes de
--    enviar uma solicitação); só admin da organização pode atualizar.
-- ============================================================
alter table policy_rules enable row level security;

create policy "policy_rules_select_org_member"
  on policy_rules for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.organization_id = policy_rules.organization_id
    )
  );

create policy "policy_rules_update_org_admin"
  on policy_rules for update
  using (is_org_admin(policy_rules.organization_id))
  with check (is_org_admin(policy_rules.organization_id));
