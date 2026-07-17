import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar este script."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";

// Marks requests created by this script so re-runs can clean up prior mocks
// instead of piling up a new "in-course" flight every time it's re-run
// before a demo.
const MOCK_OFFER_ID_PREFIX = "off_demoday_mock_";

// Generous window around "now": run this a few hours before the presentation
// and the flight stays in-course (blue, animated) for the whole thing.
const HOURS_BEFORE_NOW = 2;
const HOURS_AFTER_NOW = 8;

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada — rode o seed principal primeiro.`);
  }

  const { data: demoProfile, error: demoProfileError } = await supabase
    .from("profiles")
    .select("id, full_name, cost_center")
    .eq("id", DEMO_EMPLOYEE_ID)
    .single();
  if (demoProfileError || !demoProfile) {
    throw new Error(`Profile demo ${DEMO_EMPLOYEE_ID} não encontrado — rode o seed principal antes deste script.`);
  }

  const { error: deleteError } = await supabase
    .from("requests")
    .delete()
    .like("selected_offer_snapshot->>offer_id", `${MOCK_OFFER_ID_PREFIX}%`);
  if (deleteError) {
    throw new Error(`Falha ao limpar mocks anteriores: ${deleteError.message}`);
  }

  const now = new Date();
  const departure = new Date(now.getTime() - HOURS_BEFORE_NOW * 60 * 60 * 1000);
  const arrival = new Date(now.getTime() + HOURS_AFTER_NOW * 60 * 60 * 1000);
  const totalAmount = 8200.0;

  const request = {
    organization_id: org.id,
    employee_id: demoProfile.id,
    status: "approved" as const,
    total_amount: totalAmount,
    total_currency: "BRL",
    created_at: departure.toISOString(),
    search_criteria: {
      slices: [{ origin: "GRU", destination: "JFK", departure_date: departure.toISOString().slice(0, 10) }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: `${MOCK_OFFER_ID_PREFIX}${Date.now()}`,
      total_amount: totalAmount.toFixed(2),
      total_currency: "BRL",
      owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
      slices: [
        {
          origin: "GRU",
          destination: "JFK",
          departure_datetime: departure.toISOString(),
          arrival_datetime: arrival.toISOString(),
          duration: `PT${HOURS_BEFORE_NOW + HOURS_AFTER_NOW}H00M`,
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passenger_identity_documents_required: true,
      expires_at: arrival.toISOString(),
    },
    passengers: [],
    corporate: {
      trip_purpose: "conference",
      cost_center: demoProfile.cost_center,
      business_justification: "Viagem de demonstração para apresentação do produto (Demo Day).",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: true, cost_above_threshold: false },
    },
    events: [
      { at: departure.toISOString(), kind: "created" },
      { at: departure.toISOString(), kind: "approved" },
    ],
  };

  const { error: insertError } = await supabase.from("requests").insert(request);
  if (insertError) {
    throw new Error(`Falha ao inserir o voo mock: ${insertError.message}`);
  }

  console.log(`Voo mock GRU->JFK criado para ${demoProfile.full_name}.`);
  console.log(`Partida: ${departure.toISOString()}  Chegada: ${arrival.toISOString()}`);
  console.log(`Vai aparecer como "em curso" (avião azul animado) em /admin até ${arrival.toISOString()}.`);
  console.log(`Rode este script de novo a qualquer momento antes da apresentação para renovar a janela de tempo.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
