# Busca de cidade de origem no perfil de viagem do funcionário (admin/employees)

## Problema

Em `/admin/employees/[id]`, o campo de origem do perfil de viagem do
funcionário (`origin_airport_code`) é hoje um `<Input>` de texto livre:
o admin precisa saber e digitar de cor o código IATA de 3 letras do
aeroporto (ex: `GRU`), sem nenhuma busca ou validação contra uma lista real
de aeroportos. O label também diz "Aeroporto de origem (IATA)", enquanto o
resto do produto (regra de elegibilidade em `src/lib/onsite-weeks.ts`) já se
refere ao mesmo campo como "Cidade de origem".

O produto já tem uma engine de busca de aeroporto por nome de cidade —
`CityAirportCombobox` (`src/components/trip/city-airport-combobox.tsx`),
hoje usada no formulário de busca de passagens (`search-criteria-form.tsx`)
para os campos de origem e destino. Essa engine combina uma lista local
instantânea de ~27 cidades (`searchAirports` em `src/lib/airports.ts`) com a
Duffel Places API (`GET /places/suggestions`, via `usePlaceSuggestions` →
`resolvePlaceSuggestions` → rota `/api/places/suggestions` →
`suggestPlaces()`), cobrindo qualquer cidade do mundo, com fallback
automático e silencioso para a lista local caso a Duffel falhe ou demore.
Essa engine não é usada hoje em `admin/employees`.

## Objetivos

1. Trocar o label do campo de "Aeroporto de origem (IATA)" para
   "Cidade de origem" em `employee-travel-profile-form.tsx`.
2. Substituir o `<Input>` de texto livre pelo mesmo componente
   `CityAirportCombobox` já usado na busca de passagens, para que o admin
   busque por nome de cidade em vez de digitar o código IATA de cor.

## Não-objetivos

- Não muda a Duffel Places API, a rota `/api/places/suggestions`, o hook
  `usePlaceSuggestions` nem `searchAirports`/`CITIES` — a engine em si já
  existe e não precisa de nenhuma alteração de comportamento.
- Não adiciona validação nova no backend (a rota
  `PATCH /api/admin/employees/[id]/travel-profile` já valida
  `origin_airport_code` com `z.string().length(3)`, o que continua correto:
  todo `AirportOption.code` — vindo da lista local ou da Duffel — é um
  código IATA de 3 letras).
- Não muda a coluna `profiles.origin_airport_code` (`text`, nullable) nem a
  interface `TravelProfileFields`.
- Não adiciona indicação visual de campo obrigatório — o formulário de admin
  não tem esse padrão hoje para nenhum campo, e não foi pedido.

## Design

### 1. `employee-travel-profile-form.tsx` — trocar Input por CityAirportCombobox

Hoje (linhas 68-78):

```tsx
<div className="flex flex-col gap-1.5">
  <Label>Aeroporto de origem (IATA)</Label>
  <Input
    value={values.origin_airport_code}
    maxLength={3}
    placeholder="Ex: GRU"
    onChange={(e) =>
      setValues((v) => ({ ...v, origin_airport_code: e.target.value.toUpperCase() }))
    }
  />
</div>
```

Passa a ser:

```tsx
<CityAirportCombobox
  value={values.origin_airport_code}
  onChange={(code) => setValues((v) => ({ ...v, origin_airport_code: code }))}
  label="Cidade de origem"
  placeholder="Ex: São Paulo (GRU)"
/>
```

- `CityAirportCombobox` já renderiza seu próprio `<label>` internamente
  (associado ao input via `htmlFor`/`useId`), então o `<Label>` do shadcn que
  envolvia o `<Input>` antigo é removido — não fica duplicado.
- O `onChange` do combobox entrega diretamente um `AirportOption.code`
  (string de 3 letras, já maiúscula) quando o usuário seleciona uma opção da
  lista, e `""` enquanto o usuário está digitando sem ter selecionado nada
  ainda (comportamento já existente do componente, igual ao da busca de
  passagens). O `setValues` fica estruturalmente igual ao que já existe hoje
  — só troca de onde vem o valor.
- `Input` deixa de ser usado para este campo específico, mas continua
  importado e usado pelos outros campos do mesmo formulário (telefone, nome,
  sobrenome, data de nascimento) — nenhuma outra mudança no arquivo.
- Import novo: `import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";`.

### 2. `city-airport-combobox.tsx` — fallback para código não encontrado na lista local

Hoje (linha 22):

```ts
const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
```

Se o `value` inicial (código já salvo, ex: vindo de um perfil de funcionário
já cadastrado) não estiver na lista local de ~27 cidades (`CITIES` em
`src/lib/airports.ts`) — o que passa a ser possível agora que o admin também
pode escolher qualquer cidade coberta pela Duffel —, `findAirportByCode`
retorna `undefined` e o campo abriria em branco, escondendo um valor salvo
válido.

Passa a ser:

```ts
const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? value);
```

- Se não encontrar o código na lista local, mostra o próprio código IATA
  bruto (ex: `"AMS"`) em vez de deixar o campo vazio. Nunca esconde um valor
  já salvo.
- Essa mudança é no componente compartilhado, então também beneficia o
  formulário de busca de passagens (`search-criteria-form.tsx`) — hoje esse
  formulário sempre inicia com `value` vazio (não pré-popula com um código
  salvo), então não há mudança de comportamento observável ali; o efeito
  prático é só a correção do caso do admin.
- Quando o usuário digita de novo em cima desse valor de fallback, o
  comportamento já existente do componente vale normalmente: `onChange("")`
  é chamado a cada tecla, e o texto exibido só volta a virar um código válido
  quando uma opção da lista é selecionada.

### 3. Validação e persistência (sem mudança)

- `PATCH /api/admin/employees/[id]/travel-profile` continua validando com
  `z.string().length(3)` e gravando direto em `profiles.origin_airport_code`.
  Um `AirportOption.code` escolhido via combobox (seja da lista local, seja
  da Duffel) sempre tem exatamente 3 letras, então a validação atual
  continua correta sem alteração.

## Casos de borda cobertos

| Cenário | Comportamento |
|---|---|
| Funcionário sem `origin_airport_code` salvo (perfil novo) | Combobox abre vazio, igual ao `Input` hoje |
| Código salvo está na lista local (ex: `GRU`) | Combobox abre mostrando "São Paulo (GRU)" |
| Código salvo NÃO está na lista local, mas é válido (ex: `AMS`, escolhido via Duffel) | Combobox abre mostrando o código bruto `"AMS"` (fallback), em vez de vazio |
| Admin digita um nome de cidade | Resultado instantâneo da lista local aparece primeiro; após 300ms de debounce, resultado da Duffel (se disponível) substitui/mescla, com spinner enquanto carrega — mesmo comportamento já existente na busca de passagens |
| Admin digita mas não seleciona nenhuma opção e clica em "Salvar perfil de viagem" | `values.origin_airport_code` está `""` no momento do clique (porque toda tecla zera o valor até uma seleção real); a API rejeita com erro de validação (`length(3)` falha para string vazia), mesmo comportamento de erro que já existe hoje se o admin apagasse o campo de texto livre sem preencher 3 caracteres |

## Testes

- Nem `city-airport-combobox.tsx` nem `employee-travel-profile-form.tsx` têm
  testes unitários hoje — convenção já estabelecida no repo de não testar
  componentes de UI diretamente, só lógica pura (ex: `airports.test.ts`,
  `duffel/map-place.test.ts`, `place-suggestions.test.ts`). Esta mudança não
  adiciona lógica pura nova (é só troca de componente + um fallback de uma
  linha), então não adiciona arquivos de teste novos.
- Verificação será manual: abrir `/admin/employees/[id]` de um funcionário
  existente, confirmar o label "Cidade de origem", digitar o nome de uma
  cidade (ex: "São Paulo"), selecionar uma opção, salvar, recarregar a
  página e confirmar que o valor persiste e é exibido corretamente. Repetir
  com uma cidade fora da lista local (ex: "Amsterdã") para validar a
  cobertura via Duffel e, separadamente, testar o fallback abrindo um
  perfil com um código pré-existente fora da lista local (pode simular
  gravando um valor manualmente, ex. via SQL/Supabase Studio, já que não há
  hoje nenhum perfil real nessa condição).
