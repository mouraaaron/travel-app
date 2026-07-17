# Busca global de cidades/aeroportos via Duffel Places API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** substituir a limitação do array fixo de 26 cidades (`src/lib/airports.ts`) por uma busca que cobre qualquer cidade/aeroporto do mundo, usando a Places API da própria Duffel (`GET /places/suggestions`), sem deixar o autocomplete mais lento nem menos confiável do que hoje.

**Architecture:** o array local `CITIES`/`searchAirports()` continua existindo e é sempre a primeira coisa mostrada — instantâneo, sem rede, sem regressão de UX. Em paralelo, um hook React (`usePlaceSuggestions`) faz debounce (300ms) e chama uma nova rota `/api/places/suggestions`, que autentica o usuário via Supabase (mesmo padrão de `/api/flights/search`) e delega para `suggestPlaces()` em `src/lib/duffel/client.ts`. Essa função chama a Duffel com timeout de 2.5s e, em qualquer falha (timeout, erro de rede, resposta não-ok, `DUFFEL_API_KEY` ausente), retorna `null` — nunca lança exceção. A rota trata `null` (ou lista vazia) caindo de volta para `searchAirports()` local. Resultado: o pior caso do novo fluxo é idêntico ao comportamento atual; o melhor caso adiciona cobertura global sem bloquear a digitação.

**Tech Stack:** Next.js 14 (Route Handlers), Duffel API v2 (`/places/suggestions`), Supabase Auth (`@supabase/ssr`), Vitest.

## Global Constraints

- O array local `CITIES` e a função `searchAirports()` (`src/lib/airports.ts`) NÃO são removidos — continuam sendo o resultado instantâneo exibido antes de qualquer resposta de rede, e o fallback caso a Duffel falhe.
- Nenhuma nova variável de ambiente: reaproveita `DUFFEL_API_KEY`, já usada em `src/lib/duffel/client.ts:11`.
- Timeout da chamada à Duffel Places API: `PLACES_FETCH_TIMEOUT_MS = 2500` (2.5s) — mais curto que o timeout de câmbio (3s) porque é uma busca interativa (typeahead), não uma cotação em background.
- Debounce no cliente: `DEBOUNCE_MS = 300` antes de disparar a chamada de rede, para não fazer uma requisição por tecla digitada.
- Tamanho mínimo de busca: 2 caracteres (mesma regra que já existe hoje no combobox).
- `suggestPlaces()` e `resolvePlaceSuggestions()` nunca lançam exceção por falha de rede/timeout — sempre degradam para `searchAirports()` local, seguindo o mesmo padrão de rede de segurança já usado em `src/lib/currency/exchange-rate.ts`.
- A interface pública do `CityAirportCombobox` (props `value`, `onChange`, `label`, `placeholder`, `autoFocus`) não muda — `src/components/trip/search-criteria-form.tsx` não precisa de nenhuma alteração.
- Seguindo a convenção já estabelecida no repo, código/rotas que tocam rede externa (`duffel/client.ts`, rotas de API) não têm teste automatizado unitário; apenas lógica pura (mapeamento, cache/orquestração) é coberta por testes. Verificação dessas partes é manual, com comandos exatos em cada task.

---

### Task 1: Tipos da Places API + mapeamento para `AirportOption`

**Files:**
- Modify: `travel-app/src/lib/duffel/types.ts`
- Create: `travel-app/src/lib/duffel/map-place.ts`
- Test: `travel-app/src/lib/duffel/map-place.test.ts`

**Interfaces:**
- Consumes: `AirportOption` de `travel-app/src/lib/airports.ts` (já existe: `{ code: string; label: string; sublabel: string; lat: number; lng: number }`).
- Produces: `mapDuffelPlaceSuggestionsToAirportOptions(places: DuffelRawPlaceSuggestion[]): AirportOption[]`, usado por `suggestPlaces()` (Task 2).

- [ ] **Step 1: Escrever o teste (falhando)**

Crie `travel-app/src/lib/duffel/map-place.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapDuffelPlaceSuggestionsToAirportOptions } from "./map-place";
import type { DuffelRawPlaceSuggestion } from "./types";

describe("mapDuffelPlaceSuggestionsToAirportOptions", () => {
  it("maps a top-level airport place directly", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "airport",
        name: "Miami International Airport",
        iata_code: "MIA",
        city_name: "Miami",
        latitude: 25.7959,
        longitude: -80.287,
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result).toEqual([
      {
        code: "MIA",
        label: "Miami (MIA)",
        sublabel: "Miami International Airport",
        lat: 25.7959,
        lng: -80.287,
      },
    ]);
  });

  it("expands a city place into one option per nested airport", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "Amsterdam",
        iata_code: "AMS",
        city_name: "Amsterdam",
        latitude: 52.3676,
        longitude: 4.9041,
        airports: [
          {
            type: "airport",
            name: "Amsterdam Airport Schiphol",
            iata_code: "AMS",
            city_name: "Amsterdam",
            latitude: 52.3086,
            longitude: 4.7639,
          },
        ],
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result).toEqual([
      {
        code: "AMS",
        label: "Amsterdam (AMS)",
        sublabel: "Amsterdam Airport Schiphol",
        lat: 52.3086,
        lng: 4.7639,
      },
    ]);
  });

  it("falls back to the city's own lat/lng when a nested airport has none", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "Testville",
        iata_code: null,
        city_name: "Testville",
        latitude: 10,
        longitude: 20,
        airports: [
          {
            type: "airport",
            name: "Testville Airport",
            iata_code: "TVA",
            city_name: "Testville",
            latitude: null,
            longitude: null,
          },
        ],
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result[0]).toEqual({
      code: "TVA",
      label: "Testville (TVA)",
      sublabel: "Testville Airport",
      lat: 10,
      lng: 20,
    });
  });

  it("skips airports without an IATA code", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "No Airport City",
        iata_code: null,
        city_name: "No Airport City",
        latitude: 0,
        longitude: 0,
        airports: [
          {
            type: "airport",
            name: "Unnamed strip",
            iata_code: null,
            city_name: "No Airport City",
            latitude: 0,
            longitude: 0,
          },
        ],
      },
    ];

    expect(mapDuffelPlaceSuggestionsToAirportOptions(raw)).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(mapDuffelPlaceSuggestionsToAirportOptions([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-place.test.ts`
Expected: FAIL — `Cannot find module './map-place'` (e possivelmente erro de tipo por `DuffelRawPlaceSuggestion` não existir ainda em `./types`).

- [ ] **Step 3: Adicionar os tipos brutos da Places API**

Em `travel-app/src/lib/duffel/types.ts`, adicione ao final do arquivo:

```ts
export interface DuffelRawPlaceSuggestion {
  type: "airport" | "city";
  name: string;
  iata_code: string | null;
  city_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  airports?: DuffelRawPlaceSuggestion[];
}

export interface DuffelPlacesResponse {
  data: DuffelRawPlaceSuggestion[];
}
```

- [ ] **Step 4: Implementar o mapeamento**

Crie `travel-app/src/lib/duffel/map-place.ts`:

```ts
import type { AirportOption } from "../airports";
import type { DuffelRawPlaceSuggestion } from "./types";

export function mapDuffelPlaceSuggestionsToAirportOptions(
  places: DuffelRawPlaceSuggestion[]
): AirportOption[] {
  const options: AirportOption[] = [];

  for (const place of places) {
    if (place.type === "airport") {
      if (!place.iata_code) continue;
      options.push({
        code: place.iata_code,
        label: `${place.city_name ?? place.name} (${place.iata_code})`,
        sublabel: place.name,
        lat: place.latitude ?? 0,
        lng: place.longitude ?? 0,
      });
      continue;
    }

    for (const airport of place.airports ?? []) {
      if (!airport.iata_code) continue;
      options.push({
        code: airport.iata_code,
        label: `${place.name} (${airport.iata_code})`,
        sublabel: airport.name,
        lat: airport.latitude ?? place.latitude ?? 0,
        lng: airport.longitude ?? place.longitude ?? 0,
      });
    }
  }

  return options;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-place.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
cd travel-app
git add src/lib/duffel/types.ts src/lib/duffel/map-place.ts src/lib/duffel/map-place.test.ts
git commit -m "feat: map Duffel Places API suggestions to AirportOption"
```

---

### Task 2: `suggestPlaces()` em `duffel/client.ts`

**Files:**
- Modify: `travel-app/src/lib/duffel/client.ts`

**Interfaces:**
- Consumes: `mapDuffelPlaceSuggestionsToAirportOptions` (Task 1), `DuffelPlacesResponse` (Task 1), constante `DUFFEL_API_BASE` já existente no arquivo (linha 6).
- Produces: `suggestPlaces(query: string): Promise<AirportOption[] | null>` — `null` significa "falhou, use o fallback local"; usado pela rota `/api/places/suggestions` (Task 3).

- [ ] **Step 1: Adicionar a função**

Em `travel-app/src/lib/duffel/client.ts`, adicione o import e a função (mantendo tudo que já existe no arquivo):

```ts
import type { AirportOption } from "../airports";
import { mapDuffelPlaceSuggestionsToAirportOptions } from "./map-place";
import type { DuffelPlacesResponse } from "./types";
```

(junte esse import aos já existentes no topo do arquivo)

```ts
const PLACES_FETCH_TIMEOUT_MS = 2500;

export async function suggestPlaces(query: string): Promise<AirportOption[] | null> {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PLACES_FETCH_TIMEOUT_MS);

    const response = await fetch(
      `${DUFFEL_API_BASE}/places/suggestions?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const json = (await response.json()) as DuffelPlacesResponse;
    return mapDuffelPlaceSuggestionsToAirportOptions(json.data);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verificar manualmente com a chave de test mode**

Run:

```bash
cd travel-app
npx tsx --env-file=.env.local -e "
import('./src/lib/duffel/client').then(async ({ suggestPlaces }) => {
  const result = await suggestPlaces('Amsterdam');
  console.log(JSON.stringify(result, null, 2));
});
"
```

Expected: um array JSON com pelo menos uma opção contendo `"code": "AMS"`. Se retornar `null`, confira se `DUFFEL_API_KEY` está definida em `.env.local` e se é uma chave válida (`duffel_test_...`).

- [ ] **Step 3: Rodar a suíte completa para garantir que nada quebrou**

Run: `cd travel-app && npm test`
Expected: todos os testes existentes continuam passando (nenhum teste cobre `client.ts` diretamente, então essa mudança não deve alterar nenhum resultado).

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add src/lib/duffel/client.ts
git commit -m "feat: add suggestPlaces() using the Duffel Places API"
```

---

### Task 3: Rota `GET /api/places/suggestions`

**Files:**
- Create: `travel-app/src/app/api/places/suggestions/route.ts`

**Interfaces:**
- Consumes: `suggestPlaces` (Task 2), `searchAirports` e `AirportOption` de `travel-app/src/lib/airports.ts`, `createSupabaseServerClient` de `travel-app/src/lib/supabase/server.ts` (mesma assinatura usada em `src/app/api/flights/search/route.ts:3,31-34`).
- Produces: `GET /api/places/suggestions?query=<string>` → `200 { options: AirportOption[] }` | `400 { error }` | `401 { error }`. Consumido por `resolvePlaceSuggestions` (Task 4).

- [ ] **Step 1: Implementar a rota**

Crie `travel-app/src/app/api/places/suggestions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { suggestPlaces } from "@/lib/duffel/client";
import { searchAirports, type AirportOption } from "@/lib/airports";

const querySchema = z.string().trim().min(2);

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(searchParams.get("query"));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro query inválido (mínimo 2 caracteres)." },
      { status: 400 }
    );
  }

  const query = parsed.data;
  const remoteOptions = await suggestPlaces(query);

  if (!remoteOptions || remoteOptions.length === 0) {
    return NextResponse.json({ options: searchAirports(query) });
  }

  return NextResponse.json({ options: mergeWithLocalFallback(remoteOptions, query) });
}

function mergeWithLocalFallback(remoteOptions: AirportOption[], query: string): AirportOption[] {
  const localOptions = searchAirports(query);
  const seenCodes = new Set(remoteOptions.map((option) => option.code));
  const merged = [...remoteOptions];
  for (const local of localOptions) {
    if (!seenCodes.has(local.code)) merged.push(local);
  }
  return merged;
}
```

- [ ] **Step 2: Verificar manualmente o gate de autenticação**

Run:

```bash
cd travel-app
npm run dev
```

Em outro terminal:

```bash
curl -s -o - -w "\n%{http_code}\n" "http://localhost:3000/api/places/suggestions?query=amsterdam"
```

Expected: corpo `{"error":"Não autenticado."}` com status `401` (sem cookie de sessão). A verificação autenticada completa acontece na Task 6, pelo navegador.

- [ ] **Step 3: Verificar o gate de validação**

Run: `curl -s -o - -w "\n%{http_code}\n" "http://localhost:3000/api/places/suggestions?query=a"`
Expected: status `400` (ou `401` se a checagem de auth rodar antes — nesse caso, confirme o erro de validação também logado ao testar autenticado na Task 6).

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add src/app/api/places/suggestions/route.ts
git commit -m "feat: add /api/places/suggestions route"
```

---

### Task 4: `resolvePlaceSuggestions` (orquestração + cache, testável sem DOM)

**Files:**
- Create: `travel-app/src/lib/place-suggestions.ts`
- Test: `travel-app/src/lib/place-suggestions.test.ts`

**Interfaces:**
- Consumes: `searchAirports`, `AirportOption` de `travel-app/src/lib/airports.ts`; endpoint `/api/places/suggestions` (Task 3) via `fetch`.
- Produces: `resolvePlaceSuggestions(query: string, signal: AbortSignal): Promise<AirportOption[]>` e `clearPlaceSuggestionsCache(): void`, usados por `usePlaceSuggestions` (Task 5).

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `travel-app/src/lib/place-suggestions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPlaceSuggestionsCache, resolvePlaceSuggestions } from "./place-suggestions";

describe("resolvePlaceSuggestions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearPlaceSuggestionsCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns an empty array without calling fetch for queries shorter than 2 chars", async () => {
    global.fetch = vi.fn();

    const result = await resolvePlaceSuggestions("a", new AbortController().signal);

    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches and returns remote options on success", async () => {
    const remoteOptions = [
      { code: "AMS", label: "Amsterdam (AMS)", sublabel: "Schiphol", lat: 52.3, lng: 4.7 },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ options: remoteOptions }),
    }) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("amsterdam", new AbortController().signal);

    expect(result).toEqual(remoteOptions);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches successful responses per normalized query", async () => {
    const remoteOptions = [
      { code: "AMS", label: "Amsterdam (AMS)", sublabel: "Schiphol", lat: 52.3, lng: 4.7 },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ options: remoteOptions }),
    }) as unknown as typeof fetch;

    await resolvePlaceSuggestions("Amsterdam", new AbortController().signal);
    await resolvePlaceSuggestions("  amsterdam  ", new AbortController().signal);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to local searchAirports when the response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("brasilia", new AbortController().signal);

    expect(result.map((option) => option.code)).toEqual(["BSB"]);
  });

  it("falls back to local searchAirports when fetch throws a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("brasilia", new AbortController().signal);

    expect(result.map((option) => option.code)).toEqual(["BSB"]);
  });

  it("re-throws AbortError so a superseded request does not overwrite newer state", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    global.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    await expect(
      resolvePlaceSuggestions("brasilia", new AbortController().signal)
    ).rejects.toBe(abortError);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd travel-app && npx vitest run src/lib/place-suggestions.test.ts`
Expected: FAIL — `Cannot find module './place-suggestions'`.

- [ ] **Step 3: Implementar**

Crie `travel-app/src/lib/place-suggestions.ts`:

```ts
import { searchAirports, type AirportOption } from "./airports";

const cache = new Map<string, AirportOption[]>();

export function clearPlaceSuggestionsCache(): void {
  cache.clear();
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export async function resolvePlaceSuggestions(
  query: string,
  signal: AbortSignal
): Promise<AirportOption[]> {
  const key = normalizeQuery(query);
  if (key.length < 2) return [];

  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/places/suggestions?query=${encodeURIComponent(query)}`, {
      signal,
    });

    if (!response.ok) return searchAirports(query);

    const json = (await response.json()) as { options: AirportOption[] };
    if (!Array.isArray(json.options) || json.options.length === 0) {
      return searchAirports(query);
    }

    cache.set(key, json.options);
    return json.options;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return searchAirports(query);
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd travel-app && npx vitest run src/lib/place-suggestions.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd travel-app
git add src/lib/place-suggestions.ts src/lib/place-suggestions.test.ts
git commit -m "feat: add resolvePlaceSuggestions with local fallback and caching"
```

---

### Task 5: Hook `usePlaceSuggestions`

**Files:**
- Create: `travel-app/src/lib/use-place-suggestions.ts`

**Interfaces:**
- Consumes: `searchAirports`, `AirportOption` (`travel-app/src/lib/airports.ts`), `resolvePlaceSuggestions` (Task 4).
- Produces: `usePlaceSuggestions(query: string, enabled: boolean): { options: AirportOption[]; isLoading: boolean }`, usado por `CityAirportCombobox` (Task 6).

Este hook não tem teste automatizado — o repo não usa `@testing-library/react`/`jsdom` (`vitest.config.ts` usa `environment: "node"`) e a lógica testável de verdade (cache, fallback, debounce de dados) já está coberta em `place-suggestions.test.ts` (Task 4). A verificação deste hook é manual, na Task 6.

- [ ] **Step 1: Implementar o hook**

Crie `travel-app/src/lib/use-place-suggestions.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { searchAirports, type AirportOption } from "./airports";
import { resolvePlaceSuggestions } from "./place-suggestions";

const DEBOUNCE_MS = 300;

export function usePlaceSuggestions(
  query: string,
  enabled: boolean
): { options: AirportOption[]; isLoading: boolean } {
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();

    if (!enabled || query.trim().length < 2) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    setOptions(searchAirports(query));
    setIsLoading(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = setTimeout(() => {
      resolvePlaceSuggestions(query, controller.signal)
        .then((remoteOptions) => {
          setOptions(remoteOptions);
          setIsLoading(false);
        })
        .catch(() => {
          // Requisição cancelada por uma tecla mais nova: o próximo efeito já assumiu o estado.
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);

  return { options, isLoading };
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd travel-app && npx tsc --noEmit`
Expected: sem erros novos relacionados a `use-place-suggestions.ts`.

- [ ] **Step 3: Commit**

```bash
cd travel-app
git add src/lib/use-place-suggestions.ts
git commit -m "feat: add usePlaceSuggestions hook with debounce and instant local results"
```

---

### Task 6: Conectar o hook ao `CityAirportCombobox` + verificação end-to-end

**Files:**
- Modify: `travel-app/src/components/trip/city-airport-combobox.tsx`

**Interfaces:**
- Consumes: `usePlaceSuggestions` (Task 5). Props do componente (`value`, `onChange`, `label`, `placeholder`, `autoFocus`) não mudam — `search-criteria-form.tsx` continua funcionando sem alterações.

- [ ] **Step 1: Atualizar os imports**

Em `travel-app/src/components/trip/city-airport-combobox.tsx`, troque:

```ts
import { useId, useRef, useState } from "react";
import { findAirportByCode, searchAirports, type AirportOption } from "@/lib/airports";
import { cn } from "@/lib/utils";
```

por:

```ts
import { useId, useRef, useState } from "react";
import { findAirportByCode } from "@/lib/airports";
import { usePlaceSuggestions } from "@/lib/use-place-suggestions";
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Trocar a busca local direta pelo hook**

Troque a linha:

```ts
const options = open && query.trim().length >= 2 ? searchAirports(query) : [];
```

por:

```ts
const { options, isLoading } = usePlaceSuggestions(query, open);
```

- [ ] **Step 3: Envolver o input num wrapper relativo e mostrar um indicador de carregamento**

Troque o bloco do `<input>` (mantendo todas as props exatamente como estão hoje) de:

```tsx
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      />
```

para:

```tsx
      <div className="relative">
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setOpen(false), 150);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
        />
        {isLoading ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
          />
        ) : null}
      </div>
```

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `cd travel-app && npm test`
Expected: todos os testes passam, incluindo os novos de `map-place.test.ts` e `place-suggestions.test.ts`.

- [ ] **Step 5: Verificação manual end-to-end no navegador**

```bash
cd travel-app
npm run dev
```

No navegador: faça login, abra o fluxo de nova solicitação de viagem até o formulário de origem/destino e confira:

1. Digite `"São Paulo"` (já está no array local) → as opções `GRU`/`CGH` aparecem **instantaneamente**, sem o spinner ficar visível por muito tempo (a resposta da Duffel só substitui a lista alguns instantes depois, sem "pulo" perceptível).
2. Digite `"Amsterdam"` (não está no array local) → nenhuma opção aparece nos primeiros ~300ms, o spinner aparece, e em seguida a opção `Amsterdam (AMS)` surge.
3. Digite algo sem sentido, tipo `"zzzzz"` → nenhuma opção aparece, sem erro no console.
4. Abra o DevTools → Network, filtre por `places/suggestions` e confirme que digitar rápido (ex.: "Ams", "Amst", "Amste") gera **uma única** requisição (não uma por tecla) — o debounce está funcionando.

- [ ] **Step 6: Commit**

```bash
cd travel-app
git add src/components/trip/city-airport-combobox.tsx
git commit -m "feat: wire CityAirportCombobox to global Duffel Places suggestions"
```
