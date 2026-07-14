# Visualização do schema do banco em ReactFlow

## Contexto

O schema atual (`supabase/migrations/0001` a `0005`) tem 4 tabelas próprias
(`organizations`, `profiles`, `requests`, `policy_rules`) mais `auth.users`,
gerenciada pelo Supabase e referenciada por `profiles.id`. Já existe um
diagrama estático em `docs/Schema-Banco-de-Dados.excalidraw`; este trabalho
adiciona uma versão interativa dentro do próprio app, usando `@xyflow/react`
(sucessor do pacote `reactflow`), para facilitar consulta rápida durante o
desenvolvimento.

## Escopo

- Nova rota `src/app/dev/schema/page.tsx` (client component).
- Novo componente `TableNode` (nó customizado do ReactFlow) em
  `src/components/dev/`, mostrando: nome da tabela, lista de colunas
  (nome, tipo, badges PK/FK/UNIQUE/CHECK) e um badge de RLS quando a
  tabela tem `enable row level security`.
- Dados do schema (tabelas, colunas, FKs) definidos como uma constante
  TypeScript estática dentro do próprio componente/arquivo de dados —
  não há introspecção automática do banco.
- 5 nós: `auth.users` (estilo tracejado/externo), `organizations`,
  `profiles`, `requests`, `policy_rules`.
- 5 edges (FKs reais das migrations):
  - `profiles.organization_id → organizations.id`
  - `requests.organization_id → organizations.id`
  - `requests.employee_id → profiles.id`
  - `policy_rules.organization_id → organizations.id`
  - `profiles.id → auth.users.id` (tracejada, "extends")
- Posições iniciais fixas (schema pequeno, sem necessidade de layout
  automático tipo dagre). Nós arrastáveis, zoom/pan livres via
  `Background`, `MiniMap`, `Controls` padrão do ReactFlow.

## Fora de escopo

- Introspecção automática do banco (ex.: gerar os dados a partir do
  Postgres information_schema) — os dados são transcritos manualmente
  das migrations e precisam ser atualizados à mão se o schema mudar.
- Alterar `src/middleware.ts` para liberar `/dev/schema` sem login — a
  rota segue a mesma exigência de autenticação de todo o app.
- Editar ou exportar o diagrama (somente visualização).

## Dependências

- Adicionar `@xyflow/react` a `package.json`.
