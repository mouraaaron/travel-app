import { createClient } from "@supabase/supabase-js";
import { fakerPT_BR as faker } from "@faker-js/faker";

// Preenche os campos de perfil de viagem (origin_airport_code, given_name,
// family_name, born_on, gender, title, phone_number) adicionados pela
// migração 0008_onsite_weeks.sql, para todo profile que ainda não os tenha
// — necessário porque "Organizar Semana Presencial" (docs/OnsiteWeeks-Spec.md)
// exige esses 7 campos preenchidos por funcionário antes de incluí-lo num
// lote, e nenhum profile existente (nem os 2 demo, nem os 5 criados por
// seed-sector-demo-employees.ts, se esse seed já tiver rodado) os tinha
// antes desta migração.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o seed."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// CWB (Curitiba) está incluído de propósito: dá pra demonstrar a regra de
// "quem já está em Curitiba nasce desmarcado na revisão" sem editar nada
// manualmente depois do seed.
const AIRPORT_POOL = ["GRU", "CGH", "GIG", "SDU", "BSB", "CNF", "POA", "SSA", "REC", "FOR", "CWB"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function splitName(fullName: string): { given_name: string; family_name: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    given_name: parts[0],
    family_name: parts.length > 1 ? parts.slice(1).join(" ") : parts[0],
  };
}

async function main() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .is("origin_airport_code", null);

  if (error) {
    throw new Error(`Falha ao buscar profiles: ${error.message}`);
  }
  if (!profiles || profiles.length === 0) {
    console.log("Nenhum profile com dados de viagem faltando. Nada a fazer.");
    return;
  }

  for (const profile of profiles) {
    const { given_name, family_name } = splitName(profile.full_name);
    const isMale = faker.person.sexType() === "male";
    const bornOn = faker.date.birthdate({ min: 24, max: 58, mode: "age" }).toISOString().slice(0, 10);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        origin_airport_code: pick(AIRPORT_POOL),
        given_name,
        family_name,
        born_on: bornOn,
        gender: isMale ? "m" : "f",
        title: isMale ? "mr" : "ms",
        phone_number: faker.phone.number(),
      })
      .eq("id", profile.id);

    if (updateError) {
      throw new Error(`Falha ao atualizar profile ${profile.id}: ${updateError.message}`);
    }
    console.log(`Atualizado: ${profile.full_name}`);
  }

  console.log(`Seed concluído: ${profiles.length} profiles atualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
