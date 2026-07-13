-- Adiciona email e status a profiles, e a policy de UPDATE que faltava para
-- o Travel Admin gerenciar papel/status de outros funcionários da mesma
-- organização (aba "Funcionários").
--
-- Duas colunas novas:
--   - email: copiado de auth.users no momento da criação do usuário. Hoje só
--     existem os 2 profiles demo — o backfill abaixo preenche os dois com o
--     e-mail já conhecido (seção 6 do SchemaGuide.md). Todo profile criado
--     depois (via script de seed ou fluxo manual) deve passar email
--     explicitamente.
--   - status: 'active' | 'inactive'. Um profile 'inactive' é tratado como
--     deslogado por getCurrentProfile() (src/lib/session.ts) — bloqueia
--     acesso sem apagar o histórico de requests da pessoa.
--
-- A policy de UPDATE segue o mesmo padrão de requests_update_admin
-- (0002_admin_request_updates.sql) e reaproveita a função is_org_admin já
-- criada em 0003_profiles_admin_select.sql — o backend usa a anon key +
-- sessão do usuário (não service role), então RLS é aplicado de verdade.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table profiles add column if not exists email text not null default '';

update profiles set email = 'employee@demo.com'
  where id = '39557140-a4c1-46cc-803e-021b433332ab';
update profiles set email = 'admin@demo.com'
  where id = 'b5c03efb-3a3e-42dd-96f7-45d398d3ac85';

alter table profiles alter column email drop default;

alter table profiles add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive'));

create policy "profiles_update_org_admin"
  on profiles for update
  using (is_org_admin(profiles.organization_id))
  with check (is_org_admin(profiles.organization_id));
