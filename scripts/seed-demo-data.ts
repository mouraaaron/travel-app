import { createClient } from "@supabase/supabase-js";
import { fakerPT_BR as faker } from "@faker-js/faker";
import type { TravelRequestStatus, TripPurpose } from "../src/lib/types";
import type { Sector } from "../src/lib/badge-variants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o seed."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";
const REQUESTS_PER_EMPLOYEE = 12;

const SECTORS: Sector[] = ["product", "marketing", "engineering", "founders"];
const TRIP_PURPOSES: TripPurpose[] = ["client_meeting", "conference", "internal_meeting", "training", "other"];
const CARRIERS = [
  { iata_code: "LA", name: "LATAM" },
  { iata_code: "G3", name: "Gol" },
  { iata_code: "AD", name: "Azul" },
];
const ROUTES: Array<{ origin: string; destination: string; international: boolean }> = [
  { origin: "GRU", destination: "GIG", international: false },
  { origin: "GRU", destination: "BSB", international: false },
  { origin: "GRU", destination: "CNF", international: false },
  { origin: "GRU", destination: "SSA", international: false },
  { origin: "GRU", destination: "JFK", international: true },
  { origin: "GRU", destination: "MIA", international: true },
];

const TRIP_JUSTIFICATIONS: Record<TripPurpose, string[]> = {
  client_meeting: [
    "Reunião presencial com cliente para apresentação de proposta comercial.",
    "Visita técnica ao cliente para acompanhar a implantação do projeto.",
    "Negociação de contrato com cliente estratégico da conta.",
    "Reunião de alinhamento trimestral com cliente-chave.",
  ],
  conference: [
    "Participação em conferência do setor para networking e capacitação.",
    "Palestra em evento do setor representando a empresa.",
    "Participação em feira do setor para prospecção de parceiros.",
    "Apresentação de case da empresa em congresso da área.",
  ],
  internal_meeting: [
    "Reunião de planejamento estratégico com a liderança na matriz.",
    "Alinhamento presencial com equipe de outra unidade.",
    "Kickoff presencial de projeto interno com stakeholders.",
    "Encontro trimestral de lideranças da empresa.",
  ],
  training: [
    "Participação em treinamento técnico oferecido pelo fornecedor.",
    "Capacitação presencial obrigatória para certificação da equipe.",
    "Treinamento de liderança promovido pela empresa.",
    "Workshop de atualização profissional na área de atuação.",
  ],
  other: [
    "Viagem para representar a empresa em evento institucional.",
    "Deslocamento para resolução de demanda operacional pontual.",
    "Viagem de suporte a outra unidade da empresa.",
  ],
};

const OUT_OF_POLICY_JUSTIFICATIONS: string[] = [
  "Não havia voos dentro do teto de política disponíveis para as datas da viagem.",
  "Reunião marcada em cima da hora exigiu compra de passagem com tarifa mais alta.",
  "Único voo compatível com a agenda do cliente excedia o limite de custo da política.",
  "Alta demanda no período, por evento no destino, elevou o preço acima do teto padrão.",
];

// Maioria confirmed/approved, com alguns pending_admin/rejected/cancelled — mistura realista.
const STATUS_POOL: TravelRequestStatus[] = [
  "confirmed", "confirmed", "confirmed",
  "approved", "approved", "approved",
  "pending_admin", "pending_admin",
  "rejected",
  "cancelled",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDateWithinLastMonths(months: number): Date {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

async function createEmployee(organizationId: string): Promise<{ id: string; fullName: string; sector: Sector }> {
  const fullName = faker.person.fullName();
  const email = faker.internet
    .email({ firstName: fullName.split(" ")[0], provider: "demo-paggo.com" })
    .toLowerCase();
  const sector = pick(SECTORS);

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: "Employee#Demo2026",
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(`Falha ao criar usuário ${email}: ${userError?.message}`);
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userData.user.id,
    organization_id: organizationId,
    role: "employee",
    full_name: fullName,
    email,
    cost_center: sector,
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile para ${email}: ${profileError.message}`);
  }

  console.log(`Criado employee: ${fullName} <${email}> (${sector})`);
  return { id: userData.user.id, fullName, sector };
}

function buildRequest(employeeId: string, organizationId: string, sector: Sector) {
  const status = pick(STATUS_POOL);
  const route = pick(ROUTES);
  const carrier = pick(CARRIERS);
  const compliant = Math.random() > 0.25; // ~25% fora de política
  const basePrice = route.international ? 4500 + Math.random() * 6000 : 400 + Math.random() * 3200;
  const totalAmount = Number((compliant ? basePrice : basePrice + 3000 + Math.random() * 4000).toFixed(2));
  const createdAt = randomDateWithinLastMonths(6);
  const purpose = pick(TRIP_PURPOSES);
  const cap = route.international ? 12000 : 3500;

  const events: Array<{ at: string; kind: string }> = [{ at: createdAt.toISOString(), kind: "created" }];
  if (status !== "pending_admin") {
    const resolvedAt = new Date(createdAt.getTime() + (2 + Math.random() * 46) * 60 * 60 * 1000);
    const kind = status === "rejected" ? "rejected" : status === "cancelled" ? "cancelled" : "approved";
    events.push({ at: resolvedAt.toISOString(), kind });
    if (status === "confirmed") {
      events.push({ at: new Date(resolvedAt.getTime() + 60 * 60 * 1000).toISOString(), kind: "confirmed" });
    }
  }

  return {
    organization_id: organizationId,
    employee_id: employeeId,
    status,
    total_amount: totalAmount,
    total_currency: "BRL",
    created_at: createdAt.toISOString(),
    search_criteria: {
      slices: [{ origin: route.origin, destination: route.destination, departure_date: createdAt.toISOString().slice(0, 10) }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: `off_seed_${faker.string.alphanumeric(10)}`,
      total_amount: totalAmount.toFixed(2),
      total_currency: "BRL",
      owner: { iata_code: carrier.iata_code, name: carrier.name, logo_symbol_url: "" },
      slices: [
        {
          origin: route.origin,
          destination: route.destination,
          departure_datetime: createdAt.toISOString(),
          arrival_datetime: new Date(createdAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          duration: "PT3H00M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passenger_identity_documents_required: route.international,
      expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
    passengers: [],
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: pick(TRIP_JUSTIFICATIONS[purpose]),
      ...(compliant ? {} : { out_of_policy_justification: pick(OUT_OF_POLICY_JUSTIFICATIONS) }),
    },
    policy_evaluation: {
      compliant,
      violations: compliant
        ? []
        : [
            {
              rule_id: "cost-cap",
              message: `Preço R$ ${totalAmount.toFixed(2)} excede o teto de R$ ${cap.toFixed(2)} para voos ${
                route.international ? "internacionais" : "domésticos"
              }.`,
              field: "totalAmount",
              expected: `<= ${cap}`,
              actual: String(totalAmount),
            },
          ],
      flags: {
        international_travel: route.international,
        cost_above_threshold: !compliant,
      },
    },
    events,
  };
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada — rode a migração 0001_init.sql primeiro.`);
  }

  const { data: demoProfile, error: demoProfileError } = await supabase
    .from("profiles")
    .select("cost_center")
    .eq("id", DEMO_EMPLOYEE_ID)
    .single();
  if (demoProfileError || !demoProfile) {
    throw new Error(
      `Profile demo ${DEMO_EMPLOYEE_ID} não encontrado — rode 0005_employee_sectors.sql antes do seed.`
    );
  }

  const newEmployees = await Promise.all([
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
  ]);
  const employees: Array<{ id: string; sector: Sector }> = [
    { id: DEMO_EMPLOYEE_ID, sector: demoProfile.cost_center as Sector },
    ...newEmployees.map((e) => ({ id: e.id, sector: e.sector })),
  ];

  const requests = employees.flatMap(({ id, sector }) =>
    Array.from({ length: REQUESTS_PER_EMPLOYEE }, () => buildRequest(id, org.id, sector))
  );

  const { error: insertError } = await supabase.from("requests").insert(requests);
  if (insertError) {
    throw new Error(`Falha ao inserir requests: ${insertError.message}`);
  }

  console.log(`Seed concluído: ${newEmployees.length} employees novos, ${requests.length} requests criadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
