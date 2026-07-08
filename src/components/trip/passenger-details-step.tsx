"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  buildEmptyPassenger,
  passengersSchema,
  type PassengersFormValues,
} from "@/lib/passenger-schema";

export function PassengerDetailsStep({
  passengerCount,
  onBack,
  onSubmit,
}: {
  passengerCount: number;
  onBack: () => void;
  onSubmit: (values: PassengersFormValues) => void;
}) {
  const form = useForm<PassengersFormValues>({
    resolver: zodResolver(passengersSchema),
    defaultValues: {
      passengers: Array.from({ length: passengerCount }, () => buildEmptyPassenger()),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados dos passageiros</CardTitle>
        <CardDescription>
          Preencha as informações necessárias para emitir as passagens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {Array.from({ length: passengerCount }, (_, index) => (
              <div key={index} className="flex flex-col gap-4">
                {index > 0 ? <Separator /> : null}
                <p className="text-sm font-medium">Passageiro {index + 1}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.firstName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.lastName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobrenome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.dateOfBirth`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.gender`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sexo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="f">Feminino</SelectItem>
                            <SelectItem value="m">Masculino</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+55 11 91234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onBack}>
                Voltar
              </Button>
              <Button
                type="submit"
                className="bg-brand-gradient hover:bg-brand-gradient-hover text-white"
              >
                Buscar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
