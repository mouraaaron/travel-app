"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeReportPanel } from "@/components/admin/employee-report-panel";
import { outOfPolicyByEmployee, spendByEmployee } from "@/lib/admin-analytics";
import { getSectorBadge, type Sector } from "@/lib/badge-variants";
import { formatCurrency } from "@/lib/offer-format";
import { initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

type SortColumn = "spend" | "violations";

interface EmployeeRankingRow {
  employeeId: string;
  name: string;
  sector: Sector;
  totalSpend: number;
  violationCount: number;
}

export function EmployeeRankingTable({ requests }: { requests: AdminQueueRequest[] }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const sectorByEmployee = useMemo(() => {
    const map = new Map<string, Sector>();
    for (const request of requests) {
      if (!map.has(request.employee_id)) map.set(request.employee_id, request.employeeSector);
    }
    return map;
  }, [requests]);

  const rows = useMemo<EmployeeRankingRow[]>(() => {
    const spend = spendByEmployee(requests);
    const violations = outOfPolicyByEmployee(requests);
    const byEmployee = new Map<string, EmployeeRankingRow>();

    for (const entry of spend) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        name: entry.name,
        sector: sectorByEmployee.get(entry.employeeId) ?? "engineering",
        totalSpend: entry.total,
        violationCount: 0,
      });
    }
    for (const entry of violations) {
      const existing = byEmployee.get(entry.employeeId);
      if (existing) {
        existing.violationCount = entry.count;
      } else {
        byEmployee.set(entry.employeeId, {
          employeeId: entry.employeeId,
          name: entry.name,
          sector: sectorByEmployee.get(entry.employeeId) ?? "engineering",
          totalSpend: 0,
          violationCount: entry.count,
        });
      }
    }
    return Array.from(byEmployee.values());
  }, [requests, sectorByEmployee]);

  const sortedRows = useMemo(() => {
    const factor = sortDir === "desc" ? -1 : 1;
    const key: keyof EmployeeRankingRow = sortColumn === "spend" ? "totalSpend" : "violationCount";
    return [...rows].sort((a, b) => (Number(a[key]) - Number(b[key])) * factor);
  }, [rows, sortColumn, sortDir]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDir("desc");
    }
  }

  function handleBackToList() {
    const idToRefocus = selectedEmployeeId;
    setSelectedEmployeeId(null);
    if (idToRefocus) {
      rowRefs.current.get(idToRefocus)?.focus();
    }
  }

  const selectedEmployee = sortedRows.find((row) => row.employeeId === selectedEmployeeId);

  return (
    <div className="relative flex flex-col gap-5">
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Ranking de funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("spend")} className="flex items-center gap-1 font-medium">
                      Gasto total <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("violations")} className="flex items-center gap-1 font-medium">
                      Desvios de política <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => {
                  const sectorBadge = getSectorBadge(row.sector);
                  return (
                    <TableRow
                      key={row.employeeId}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row.employeeId, el);
                        else rowRefs.current.delete(row.employeeId);
                      }}
                      tabIndex={-1}
                      data-state={row.employeeId === selectedEmployeeId ? "selected" : undefined}
                      onClick={() => setSelectedEmployeeId(row.employeeId)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>{initialsFromName(row.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{row.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(row.totalSpend, "BRL")}</TableCell>
                      <TableCell>{row.violationCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selectedEmployee ? (
        <EmployeeReportPanel
          employeeId={selectedEmployee.employeeId}
          employeeName={selectedEmployee.name}
          requests={requests}
          onBack={handleBackToList}
        />
      ) : null}
    </div>
  );
}
