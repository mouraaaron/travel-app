"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FLIGHT_CRITERIA_DEFAULTS,
  FlightCriteriaStep,
} from "@/components/trip/flight-criteria-step";
import { PassengerDetailsStep } from "@/components/trip/passenger-details-step";
import type { PassengersFormValues } from "@/lib/passenger-schema";
import type { FlightSearchFormValues } from "@/lib/search-schema";

export function FlightRequestWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [criteria, setCriteria] = useState<FlightSearchFormValues>(FLIGHT_CRITERIA_DEFAULTS);

  function handleCriteriaContinue(values: FlightSearchFormValues) {
    setCriteria(values);
    setStep(2);
  }

  function handlePassengersSubmit(_values: PassengersFormValues) {
    // Passenger data is collected here (needed to issue a ticket later) but
    // isn't threaded into /search/results or persisted yet — there's no
    // backend/Duffel order-creation in this phase. See the change log for
    // this round for details; this is intentional, not a bug.
    const query = new URLSearchParams({
      mode: "flight",
      origin: criteria.origin.toUpperCase(),
      destination: criteria.destination.toUpperCase(),
      departureAt: criteria.departureAt,
      returnAt: criteria.returnAt ?? "",
      cabinClass: criteria.cabinClass,
    });
    router.push(`/search/results?${query.toString()}`);
  }

  if (step === 1) {
    return <FlightCriteriaStep defaultValues={criteria} onContinue={handleCriteriaContinue} />;
  }

  return (
    <PassengerDetailsStep
      passengerCount={criteria.passengerCount}
      onBack={() => setStep(1)}
      onSubmit={handlePassengersSubmit}
    />
  );
}
