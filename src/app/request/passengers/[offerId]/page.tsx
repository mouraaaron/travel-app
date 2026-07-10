"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import { COUNTRIES } from "@/lib/airports";
import {
  buildEmptyDuffelPassenger,
  duffelPassengersSchema,
  toE164,
  type DuffelPassengerFormValues,
  type DuffelPassengersFormValues,
} from "@/lib/passenger-schema";
import { useTripFlow } from "@/lib/trip-flow-store";
import type { SearchPassengerSpec } from "@/lib/types";

const MOCK_LOGGED_IN_USER = {
  given_name: "Aaron",
  family_name: "Moura",
  born_on: "1998-03-14",
  gender: "m" as const,
  email: "aaron@paggo.com",
  phoneCountry: "55",
  phoneLocalNumber: "41999998888",
};

const TYPE_LABELS: Record<SearchPassengerSpec["type"], string> = {
  adult: "Adulto",
  child: "Criança",
  infant_without_seat: "Bebê",
};

function buildInitialPassengers(
  specs: SearchPassengerSpec[],
  passportRequired: boolean
): DuffelPassengerFormValues[] {
  let adultSeen = false;
  return specs.map((spec, index) => {
    const base = buildEmptyDuffelPassenger(spec.type, `pas-${index + 1}`);
    const withPassport = { ...base, passportRequired };
    if (spec.type === "adult" && !adultSeen) {
      adultSeen = true;
      return { ...withPassport, ...MOCK_LOGGED_IN_USER };
    }
    return withPassport;
  });
}

function isPassengerComplete(passenger: DuffelPassengerFormValues): boolean {
  const baseComplete =
    Boolean(passenger.given_name) &&
    Boolean(passenger.family_name) &&
    Boolean(passenger.born_on) &&
    Boolean(passenger.email) &&
    Boolean(passenger.phoneLocalNumber);
  if (!passenger.passportRequired) return baseComplete;
  return (
    baseComplete &&
    Boolean(passenger.passportNumber) &&
    Boolean(passenger.passportIssuingCountry) &&
    Boolean(passenger.passportExpiresOn)
  );
}

export default function PassengersPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const router = useRouter();
  const { criteria, offers, setPassengers } = useTripFlow();
  const offer = offers.find((o) => o.id === offerId);

  const initialPassengers = useMemo(
    () =>
      criteria
        ? buildInitialPassengers(criteria.passengers, offer?.passengerIdentityDocumentsRequired ?? false)
        : [],
    [criteria, offer]
  );

  const form = useForm<DuffelPassengersFormValues>({
    resolver: zodResolver(duffelPassengersSchema),
    defaultValues: { passengers: initialPassengers },
  });

  const { fields } = useFieldArray({ control: form.control, name: "passengers" });
  const allPassengers = form.watch("passengers");
  const infants = allPassengers.filter((p) => p.type === "infant_without_seat");

  if (!criteria || !offer) {
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          title="Selecione uma oferta primeiro"
          description="Volte aos resultados e escolha uma oferta para continuar."
          button={{ label: "Ver resultados", onClick: () => router.push("/results") }}
        />
      </div>
    );
  }

  function onSubmit(values: DuffelPassengersFormValues) {
    setPassengers(
      values.passengers.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        email: p.email,
        phone_number: toE164(p.phoneCountry, p.phoneLocalNumber),
        ...(p.passportRequired
          ? {
              identity_documents: [
                {
                  type: "passport" as const,
                  unique_identifier: p.passportNumber ?? "",
                  issuing_country_code: p.passportIssuingCountry ?? "",
                  expires_on: p.passportExpiresOn ?? "",
                },
              ],
            }
          : {}),
        ...(p.infantResponsibleFor ? { infant_passenger_id: p.infantResponsibleFor } : {}),
      }))
    );
    router.push("/request/review");
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <WizardStepper current="passengers" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dados dos passageiros</h1>
        <p className="text-sm text-muted-foreground">
          Viagem {offer.origin} → {offer.destination} · {offer.airline} · os dados alimentam a emissão do bilhete
          — confira com o documento em mãos.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-2">
              <Accordion type="single" collapsible defaultValue={fields[0]?.id}>
                {fields.map((field, index) => {
                  const passenger = form.watch(`passengers.${index}`);
                  const complete = isPassengerComplete(passenger);
                  return (
                    <AccordionItem key={field.id} value={field.id}>
                      <AccordionTrigger className="px-4">
                        <span className="flex items-center gap-2">
                          Passageiro {index + 1} — {TYPE_LABELS[passenger.type]}
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          {complete ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : null}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-4 px-4 pb-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.title`}
                            render={({ field: titleField }) => (
                              <FormItem>
                                <FormLabel>Título</FormLabel>
                                <Select value={titleField.value} onValueChange={titleField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="mr">Sr.</SelectItem>
                                    <SelectItem value="mrs">Sra.</SelectItem>
                                    <SelectItem value="ms">Ms.</SelectItem>
                                    <SelectItem value="miss">Srta.</SelectItem>
                                    <SelectItem value="dr">Dr.</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.given_name`}
                            render={({ field: nameField }) => (
                              <FormItem>
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input {...nameField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.family_name`}
                            render={({ field: lastNameField }) => (
                              <FormItem>
                                <FormLabel>Sobrenome</FormLabel>
                                <FormControl>
                                  <Input {...lastNameField} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                  Sem acentos — as companhias não aceitam acentos no bilhete.
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.born_on`}
                            render={({ field: dobField }) => (
                              <FormItem>
                                <FormLabel>Data de nascimento</FormLabel>
                                <FormControl>
                                  <Input type="date" {...dobField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.gender`}
                            render={({ field: genderField }) => (
                              <FormItem>
                                <FormLabel>Gênero</FormLabel>
                                <Select value={genderField.value} onValueChange={genderField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="m">Masculino</SelectItem>
                                    <SelectItem value="f">Feminino</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  As companhias aéreas exigem m/f no bilhete.
                                </p>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.email`}
                            render={({ field: emailField }) => (
                              <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                  <Input type="email" {...emailField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.phoneCountry`}
                            render={({ field: countryField }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <Select value={countryField.value} onValueChange={countryField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {COUNTRIES.map((country) => (
                                      <SelectItem key={country.iso2} value={country.dialCode}>
                                        {country.name} (+{country.dialCode})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.phoneLocalNumber`}
                            render={({ field: phoneField }) => (
                              <FormItem>
                                <FormLabel className="opacity-0">Número</FormLabel>
                                <FormControl>
                                  <Input placeholder="41999998888" {...phoneField} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                  {toE164(form.watch(`passengers.${index}.phoneCountry`), phoneField.value || "")}
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {passenger.passportRequired ? (
                          <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportNumber`}
                              render={({ field: passportField }) => (
                                <FormItem>
                                  <FormLabel>Número do passaporte</FormLabel>
                                  <FormControl>
                                    <Input {...passportField} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportIssuingCountry`}
                              render={({ field: issuingField }) => (
                                <FormItem>
                                  <FormLabel>País emissor</FormLabel>
                                  <Select value={issuingField.value} onValueChange={issuingField.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {COUNTRIES.map((country) => (
                                        <SelectItem key={country.iso2} value={country.iso2}>
                                          {country.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportExpiresOn`}
                              render={({ field: expiresField }) => (
                                <FormItem>
                                  <FormLabel>Validade</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...expiresField} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ) : null}

                        {infants.length > 0 && passenger.type === "adult" ? (
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.infantResponsibleFor`}
                            render={({ field: responsibleField }) => {
                              const claimedByOthers = new Set(
                                allPassengers
                                  .filter((p, i) => i !== index && p.infantResponsibleFor)
                                  .map((p) => p.infantResponsibleFor)
                              );
                              const availableInfants = infants.filter(
                                (inf) => inf.id === responsibleField.value || !claimedByOthers.has(inf.id)
                              );
                              return (
                                <FormItem className="max-w-xs">
                                  <FormLabel>Responsável por qual bebê?</FormLabel>
                                  <Select
                                    value={responsibleField.value ?? "none"}
                                    onValueChange={(value) =>
                                      responsibleField.onChange(value === "none" ? undefined : value)
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Nenhum" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhum</SelectItem>
                                      {availableInfants.map((inf) => (
                                        <SelectItem key={inf.id} value={inf.id}>
                                          Passageiro{" "}
                                          {form.getValues("passengers").findIndex((p) => p.id === inf.id) + 1}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {form.formState.errors.passengers?.root?.message ? (
            <p className="text-sm text-destructive">{form.formState.errors.passengers.root.message}</p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="link" onClick={() => router.push(`/offer/${offer.id}`)}>
              Voltar
            </Button>
            <Button type="submit" className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Continuar para revisão
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
