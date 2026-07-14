import { createSupabaseServerClient } from "../supabase/server";

// Última rede de segurança: se não houver cache nenhum e a API de câmbio
// estiver fora do ar, usamos esse valor fixo em vez de falhar a busca de
// voos. Calibrado para USD (única moeda observada vindo da Duffel hoje) —
// atualizar periodicamente.
const FALLBACK_RATE_TO_BRL = 5.4;

const AWESOMEAPI_BASE = "https://economia.awesomeapi.com.br/json/last";
const FETCH_TIMEOUT_MS = 3000;

export async function getRateToBRL(currency: string): Promise<number> {
  if (currency === "BRL") return 1;

  const supabase = createSupabaseServerClient();
  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate_to_brl, fetched_at")
    .eq("currency", currency)
    .maybeSingle();

  if (cached && isFromToday(cached.fetched_at)) {
    const rate = Number(cached.rate_to_brl);
    if (Number.isFinite(rate)) {
      return rate;
    }
  }

  const liveRate = await fetchLiveRate(currency);
  if (liveRate !== null) {
    await supabase.from("exchange_rates").upsert({
      currency,
      rate_to_brl: liveRate,
      fetched_at: new Date().toISOString(),
    });
    return liveRate;
  }

  if (cached) {
    const rate = Number(cached.rate_to_brl);
    if (Number.isFinite(rate)) {
      return rate;
    }
  }

  return FALLBACK_RATE_TO_BRL;
}

function isFromToday(fetchedAt: string): boolean {
  const fetchedDate = new Date(fetchedAt).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return fetchedDate === today;
}

async function fetchLiveRate(currency: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`${AWESOMEAPI_BASE}/${currency}-BRL`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const json = (await response.json()) as Record<string, { bid?: string }>;
    const bid = json[`${currency}BRL`]?.bid;
    if (!bid) return null;

    const rate = Number(bid);
    return Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}
