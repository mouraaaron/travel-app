-- Adiciona a policy de UPDATE que faltava para o Travel Admin aprovar/rejeitar
-- solicitações de outras pessoas da mesma organização.
--
-- `0001_init.sql` já tem `requests_update_own` (o próprio funcionário pode
-- atualizar a solicitação que ele mesmo criou) e `requests_select_own_or_admin`
-- (admin pode LER solicitações da própria organização) — mas nunca existiu uma
-- policy de UPDATE para admin. Sem ela, aprovar/rejeitar falha silenciosamente:
-- o backend usa a anon key + sessão do usuário (não a service role key), então
-- RLS é aplicado de verdade.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

create policy "requests_update_admin"
  on requests for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = requests.organization_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = requests.organization_id
    )
  );
