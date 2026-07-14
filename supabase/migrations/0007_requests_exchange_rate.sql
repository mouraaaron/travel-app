-- travel-app/supabase/migrations/0007_requests_exchange_rate.sql
-- Grava a taxa de câmbio (rate_to_brl) usada para converter a oferta
-- selecionada, no momento em que a solicitação é criada. Complementa
-- exchange_rates (0006), que só guarda a cotação mais recente por moeda —
-- esta coluna guarda qual taxa foi realmente aplicada a cada solicitação
-- específica, para auditoria individual. Nullable porque solicitações
-- antigas (seed sintético em BRL) nunca tiveram uma taxa real associada.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table requests add column if not exists exchange_rate_to_brl numeric;
