"use client";

import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnsiteWeekStatusBadge, getSectorBadge, SECTOR_LABELS } from "@/lib/badge-variants";
import { formatDate } from "@/lib/offer-format";
import type { OnsiteWeek } from "@/lib/onsite-weeks";

export function OnsiteWeeksList({ onsiteWeeks }: { onsiteWeeks: OnsiteWeek[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Semanas Presenciais</h1>
        <Button size="sm" onClick={() => router.push("/admin/onsite-weeks/new")}>
          <Plus className="mr-1.5 size-4" />
          Organizar nova semana presencial
        </Button>
      </div>

      {onsiteWeeks.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhuma semana presencial organizada ainda"
          button={{ label: "Organizar nova semana presencial", onClick: () => router.push("/admin/onsite-weeks/new") }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitações</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {onsiteWeeks.map((week) => {
              const sectorBadge = getSectorBadge(week.sector);
              const statusBadge = getOnsiteWeekStatusBadge(week.status);
              const createdCount = week.employee_outcomes.filter((o) => o.status === "created").length;
              return (
                <TableRow
                  key={week.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/onsite-weeks/${week.id}`)}
                >
                  <TableCell>
                    <Badge variant={sectorBadge.variant}>{SECTOR_LABELS[week.sector]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {formatDate(week.week_start_date)} – {formatDate(week.week_end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {createdCount} de {week.employee_outcomes.length}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(week.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
