-- Schema inicial do travel-app (fase "Employee funcional com dados reais").
-- Ver travel-app/docs/SchemaGuide.md para uma explicação de cada tabela/coluna.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

-- ============================================================
-- 1. organizations
-- ============================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. profiles
--    Estende auth.users (tabela interna do Supabase Auth) com
--    os dados que o app precisa: a qual organização a pessoa
--    pertence e qual o papel dela (employee ou admin).
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  role text not null check (role in ('employee', 'admin')),
  full_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on profiles (organization_id);

-- ============================================================
-- 3. requests
--    Uma linha por solicitação de viagem criada pelo Employee.
--    Os campos jsonb espelham os tipos TypeScript já existentes
--    em travel-app/src/lib/types.ts (SearchCriteria,
--    SelectedOfferSnapshot, DuffelPassenger[], CorporateContext,
--    policy_evaluation, TravelRequestEvent[]).
-- ============================================================
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  employee_id uuid not null references profiles (id),
  status text not null default 'pending_admin'
    check (status in ('pending_admin', 'approved', 'rejected', 'needs_review', 'confirmed', 'cancelled')),
  total_amount numeric not null,
  total_currency text not null,
  created_at timestamptz not null default now(),
  search_criteria jsonb not null,
  selected_offer_snapshot jsonb not null,
  passengers jsonb not null,
  corporate jsonb not null,
  policy_evaluation jsonb not null,
  events jsonb not null default '[]'::jsonb
);

create index if not exists requests_organization_id_idx on requests (organization_id);
create index if not exists requests_employee_id_idx on requests (employee_id);
create index if not exists requests_status_idx on requests (status);

-- ============================================================
-- 4. Row Level Security (RLS)
--    O backend (Route Handlers) usa a service_role key, que
--    ignora RLS. Estas políticas são uma segunda camada de
--    segurança, para o caso de algo algum dia acessar o banco
--    direto do navegador com a sessão do usuário.
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table requests enable row level security;

create policy "organizations_select_member"
  on organizations for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.organization_id = organizations.id
    )
  );

create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

create policy "requests_select_own_or_admin"
  on requests for select
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = requests.organization_id
    )
  );

create policy "requests_insert_own"
  on requests for insert
  with check (employee_id = auth.uid());

create policy "requests_update_own"
  on requests for update
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- ============================================================
-- 5. Seed: organização única do MVP
--    Os dois usuários demo (employee@demo.com / admin@demo.com)
--    NÃO são criados aqui — eles precisam existir primeiro em
--    auth.users, o que é feito por um script separado
--    (via Supabase Admin API), não por SQL puro.
-- ============================================================
insert into organizations (name)
values ('Paggo (Demo)')
on conflict do nothing;
