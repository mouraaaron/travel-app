-- Suporte a "Semanas Presenciais": o Travel Admin escolhe um setor e um
-- período, e o sistema gera automaticamente uma solicitação de viagem
-- (ida + volta, já aprovada) para cada funcionário elegível do setor,
-- da cidade de origem dele até Curitiba. Spec completa em
-- docs/OnsiteWeeks-Spec.md.
--
-- Três blocos:
--
-- 1. profiles: 7 colunas novas ("perfil de viagem" do funcionário). Todas
--    nullable — ao contrário do padrão "default temporário + backfill +
--    drop default" usado em 0004/0005 para cost_center, estas só passam a
--    ser exigidas quando alguém tenta incluir a pessoa numa semana
--    presencial (checado em código, não no banco — ver src/lib/onsite-weeks.ts
--    computeEmployeeEligibility). Um profile sem esses campos continua
--    válido para todo o resto do sistema.
--
-- 2. onsite_weeks: um lote por (setor, data de ida, data de volta) na
--    organização — a unique constraint é a trava de idempotência (spec
--    seção 6, decisão da pergunta 11): uma segunda tentativa com os
--    mesmos parâmetros falha com erro de constraint (código Postgres
--    23505), que o Route Handler traduz numa mensagem amigável.
--    employee_outcomes (jsonb) guarda, por funcionário selecionado nessa
--    rodada, se a solicitação foi criada ou falhou e por quê — sem isso
--    não haveria como a tela de detalhe mostrar falhas parciais nem
--    oferecer "tentar novamente" (funcionários que falham não geram
--    linha em requests).
--
-- 3. requests.onsite_week_id: liga cada solicitação gerada de volta ao
--    lote. O índice único parcial (só quando onsite_week_id não é nulo)
--    impede duas solicitações para o mesmo funcionário no mesmo lote —
--    protege o fluxo de "retry" contra duplicar quem já teve sucesso.
--
-- RLS: reaproveita a função is_org_admin(org_id) já criada em
-- 0003_profiles_admin_select.sql. requests_insert_admin_onsite_week é
-- necessária porque requests_insert_own (0001_init.sql) só permite
-- employee_id = auth.uid() — sem uma policy nova, o admin não consegue
-- inserir solicitações em nome de terceiros. Ela só libera insert quando
-- onsite_week_id não é nulo, ou seja, o admin não pode usar essa policy
-- para criar solicitações avulsas arbitrárias em nome de qualquer um.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table profiles add column if not exists origin_airport_code text;
alter table profiles add column if not exists given_name text;
alter table profiles add column if not exists family_name text;
alter table profiles add column if not exists born_on date;
alter table profiles add column if not exists gender text check (gender in ('m', 'f'));
alter table profiles add column if not exists title text check (title in ('mr', 'mrs', 'ms', 'miss', 'dr'));
alter table profiles add column if not exists phone_number text;

create table if not exists onsite_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  sector text not null check (sector in ('product', 'marketing', 'engineering', 'founders')),
  week_start_date date not null,
  week_end_date date not null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'cancelled')),
  employee_outcomes jsonb not null default '[]'::jsonb,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (organization_id, sector, week_start_date, week_end_date)
);

create index if not exists onsite_weeks_organization_id_idx on onsite_weeks (organization_id);

alter table requests add column if not exists onsite_week_id uuid references onsite_weeks (id);

create unique index if not exists requests_onsite_week_employee_unique
  on requests (onsite_week_id, employee_id)
  where onsite_week_id is not null;

alter table onsite_weeks enable row level security;

create policy "onsite_weeks_select_org_member"
  on onsite_weeks for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.organization_id = onsite_weeks.organization_id
    )
  );

create policy "onsite_weeks_insert_org_admin"
  on onsite_weeks for insert
  with check (is_org_admin(onsite_weeks.organization_id));

create policy "onsite_weeks_update_org_admin"
  on onsite_weeks for update
  using (is_org_admin(onsite_weeks.organization_id))
  with check (is_org_admin(onsite_weeks.organization_id));

create policy "requests_insert_admin_onsite_week"
  on requests for insert
  with check (
    onsite_week_id is not null
    and is_org_admin(requests.organization_id)
  );
