-- Adiciona a policy de SELECT que faltava para o Travel Admin ler o full_name
-- de outros funcionários da mesma organização (join usado pela fila de
-- aprovação em /admin/requests, "profiles(full_name)").
--
-- `0001_init.sql` só tem `profiles_select_own` (auth.uid() = id) — sem uma
-- policy adicional, o join sempre retorna null pra qualquer profile que não
-- seja o do próprio admin, e a fila cai no fallback genérico "Funcionário".
--
-- Por que uma função `security definer` em vez de uma subquery direta em
-- `profiles` dentro da própria policy de `profiles`: isso é um erro comum de
-- RLS no Postgres/Supabase — uma policy de SELECT em `profiles` cujo `using`
-- faz subquery em `profiles` de novo faz o rewriter de RLS reexpandir as
-- policies de `profiles` recursivamente (a re-checagem da subquery interna
-- também precisa aplicar RLS, que inclui essa mesma policy, e assim por
-- diante), o que o Postgres detecta e rejeita com
-- "infinite recursion detected in policy for relation \"profiles\"" —
-- independente de outra policy (como `profiles_select_own`) já "garantir" a
-- visibilidade da linha; a recursão é estrutural na expansão da query, não
-- na avaliação booleana linha a linha. A correção padrão (documentada pelo
-- próprio Supabase) é isolar a checagem de role numa função `security
-- definer`: como o dono da função é o dono da tabela (que por padrão não
-- está sujeito a RLS, já que `0001_init.sql` não usa
-- `force row level security`), a consulta interna da função não aciona RLS
-- de novo, quebrando o ciclo.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and organization_id = org_id
  );
$$;

create policy "profiles_select_org_admin"
  on profiles for select
  using (is_org_admin(profiles.organization_id));
