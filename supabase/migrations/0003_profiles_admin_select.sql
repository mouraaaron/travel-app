-- Adiciona a policy de SELECT que faltava para o Travel Admin ler o full_name
-- de outros funcionários da mesma organização (join usado pela fila de
-- aprovação em /admin/requests, "profiles(full_name)").
--
-- `0001_init.sql` só tem `profiles_select_own` (auth.uid() = id) — sem uma
-- policy adicional, o join sempre retorna null pra qualquer profile que não
-- seja o do próprio admin, e a fila cai no fallback genérico "Funcionário".
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

create policy "profiles_select_org_admin"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = profiles.organization_id
    )
  );
