-- travel-app/supabase/migrations/0006_exchange_rates.sql
-- Cache global de cotação de moeda estrangeira -> BRL, usado para converter
-- os valores retornados pela Duffel (total_amount/total_currency das
-- ofertas, hoje sempre USD nas buscas observadas). Não pertence a nenhuma
-- organização — é um dado de mercado compartilhado por todo o app.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

create table if not exists exchange_rates (
  currency text primary key,
  rate_to_brl numeric not null,
  fetched_at timestamptz not null default now()
);

alter table exchange_rates enable row level security;

create policy "exchange_rates_select_authenticated"
  on exchange_rates for select
  using (auth.uid() is not null);

create policy "exchange_rates_upsert_authenticated"
  on exchange_rates for insert
  with check (auth.uid() is not null);

create policy "exchange_rates_update_authenticated"
  on exchange_rates for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
