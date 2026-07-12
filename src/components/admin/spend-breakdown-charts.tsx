"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getTravelRequestStatusBadge } from "@/lib/badge-variants";
import { formatCurrency } from "@/lib/offer-format";
import type { TravelRequestStatus, TripPurpose } from "@/lib/types";

const STATUS_CONFIG: ChartConfig = {
  count: { label: "Solicitações", color: "hsl(var(--chart-1))" },
};

export function StatusVolumeChart({ data }: { data: { status: TravelRequestStatus; count: number }[] }) {
  const chartData = data.map((entry) => ({
    label: getTravelRequestStatusBadge(entry.status).label,
    count: entry.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume por status</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={STATUS_CONFIG} className="h-64 w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const COST_CENTER_CONFIG: ChartConfig = {
  total: { label: "Gasto", color: "hsl(var(--chart-2))" },
};

export function CostCenterRankingChart({ data }: { data: { costCenter: string; total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de cost centers</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={COST_CENTER_CONFIG} className="h-64 w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), "BRL")}
            />
            <YAxis dataKey="costCenter" type="category" tickLine={false} axisLine={false} width={100} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), "BRL")} />}
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const TRIP_PURPOSE_CONFIG: ChartConfig = {
  client_meeting: { label: "Reunião com cliente", color: "hsl(var(--chart-1))" },
  conference: { label: "Conferência", color: "hsl(var(--chart-2))" },
  internal_meeting: { label: "Reunião interna", color: "hsl(var(--chart-3))" },
  training: { label: "Treinamento", color: "hsl(var(--chart-4))" },
  other: { label: "Outro", color: "hsl(var(--chart-5))" },
};

export function TripPurposeChart({ data }: { data: { purpose: TripPurpose; count: number }[] }) {
  const chartData = data.filter((entry) => entry.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivo da viagem</CardTitle>
        <CardDescription>Distribuição por finalidade</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={TRIP_PURPOSE_CONFIG} className="mx-auto aspect-square h-64">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="purpose" hideLabel />} />
            <Pie data={chartData} dataKey="count" nameKey="purpose" innerRadius={50} strokeWidth={4}>
              {chartData.map((entry) => (
                <Cell key={entry.purpose} fill={`var(--color-${entry.purpose})`} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="purpose" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
