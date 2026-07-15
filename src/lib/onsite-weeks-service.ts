import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sector } from "./badge-variants";
import { DuffelSearchError, searchFlights } from "./duffel/client";
import {
  buildOnsiteWeekCorporateContext,
  buildOnsiteWeekOfferSnapshot,
  buildOnsiteWeekPassenger,
  buildOnsiteWeekSearchCriteria,
  computeEmployeeEligibility,
  pickCheapestOffer,
  type OnsiteWeekEmployeeOutcome,
  type TravelProfileFields,
} from "./onsite-weeks";
import { evaluateDuffelOffer, type DuffelPolicyDefaults } from "./policy";

export interface ProcessEmployeeParams {
  supabase: SupabaseClient;
  organizationId: string;
  onsiteWeekId: string;
  sector: Sector;
  weekStartDate: string;
  weekEndDate: string;
  policyDefaults: DuffelPolicyDefaults;
  adminId: string;
  employee: { id: string; full_name: string } & TravelProfileFields;
}

export async function processOnsiteWeekEmployee(
  params: ProcessEmployeeParams
): Promise<OnsiteWeekEmployeeOutcome> {
  const {
    supabase,
    organizationId,
    onsiteWeekId,
    sector,
    weekStartDate,
    weekEndDate,
    policyDefaults,
    adminId,
    employee,
  } = params;

  const eligibility = computeEmployeeEligibility(employee);
  if (eligibility.status !== "ok") {
    return {
      employee_id: employee.id,
      employee_name: employee.full_name,
      status: "failed",
      error_message: `Perfil incompleto: falta ${eligibility.missingFields.join(", ")}.`,
    };
  }

  try {
    const searchCriteria = buildOnsiteWeekSearchCriteria(
      employee.origin_airport_code as string,
      weekStartDate,
      weekEndDate
    );
    const offers = await searchFlights(searchCriteria);
    const cheapest = pickCheapestOffer(offers);
    if (!cheapest) {
      return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        status: "failed",
        error_message: "Nenhuma oferta de voo disponível para essa rota e essas datas.",
      };
    }

    const evaluation = evaluateDuffelOffer(cheapest, policyDefaults);
    const now = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from("requests")
      .insert({
        organization_id: organizationId,
        employee_id: employee.id,
        onsite_week_id: onsiteWeekId,
        status: "approved",
        total_amount: cheapest.totalAmount,
        total_currency: cheapest.currency,
        exchange_rate_to_brl: cheapest.rateToBRL ?? null,
        search_criteria: searchCriteria,
        selected_offer_snapshot: buildOnsiteWeekOfferSnapshot(cheapest),
        passengers: [buildOnsiteWeekPassenger(employee)],
        corporate: buildOnsiteWeekCorporateContext(sector, weekStartDate, weekEndDate),
        policy_evaluation: evaluation,
        events: [
          { at: now, kind: "created" },
          {
            at: now,
            kind: "approved",
            actor_id: adminId,
            note: "Aprovada automaticamente ao organizar a semana presencial.",
          },
        ],
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        status: "failed",
        error_message: "Não foi possível salvar a solicitação.",
      };
    }

    return {
      employee_id: employee.id,
      employee_name: employee.full_name,
      status: "created",
      request_id: inserted.id,
    };
  } catch (err) {
    const message = err instanceof DuffelSearchError ? err.message : "Erro inesperado ao buscar voos.";
    return { employee_id: employee.id, employee_name: employee.full_name, status: "failed", error_message: message };
  }
}
