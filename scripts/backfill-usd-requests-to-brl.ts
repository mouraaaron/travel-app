import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o backfill."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const AWESOMEAPI_BASE = "https://economia.awesomeapi.com.br/json/last";

async function fetchCurrentUsdToBrlRate(): Promise<number> {
  const response = await fetch(`${AWESOMEAPI_BASE}/USD-BRL`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`AwesomeAPI retornou status ${response.status}`);
  }
  const json = (await response.json()) as Record<string, { bid?: string }>;
  const bid = json.USDBRL?.bid;
  const rate = Number(bid);
  if (!bid || !Number.isFinite(rate)) {
    throw new Error("Resposta da AwesomeAPI não trouxe uma cotação USD-BRL válida.");
  }
  return rate;
}

async function main() {
  const { data: rows, error: selectError } = await supabase
    .from("requests")
    .select("id, total_amount, total_currency, selected_offer_snapshot")
    .eq("total_currency", "USD");

  if (selectError) {
    throw new Error(`Falha ao buscar solicitações em USD: ${selectError.message}`);
  }
  if (!rows || rows.length === 0) {
    console.log("Nenhuma solicitação em USD encontrada. Nada para converter.");
    return;
  }

  const rate = await fetchCurrentUsdToBrlRate();
  console.log(`Taxa USD->BRL usada para o backfill: ${rate}`);
  console.log(`Convertendo ${rows.length} solicitação(ões)...`);

  for (const row of rows) {
    const oldAmount = Number(row.total_amount);
    const newAmount = oldAmount * rate;
    const snapshot = row.selected_offer_snapshot as Record<string, unknown>;

    const { error: updateError } = await supabase
      .from("requests")
      .update({
        total_amount: newAmount,
        total_currency: "BRL",
        exchange_rate_to_brl: rate,
        selected_offer_snapshot: {
          ...snapshot,
          total_amount: newAmount.toFixed(2),
          total_currency: "BRL",
          exchange_rate_to_brl: rate,
        },
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Falha ao atualizar a solicitação ${row.id}: ${updateError.message}`);
    }

    console.log(`  ${row.id}: ${oldAmount} USD -> ${newAmount.toFixed(2)} BRL`);
  }

  console.log("Backfill concluído.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
