"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeDetail } from "@/components/admin/employee-detail";
import { outOfPolicyByEmployee, spendByEmployee } from "@/lib/admin-analytics";
import { formatCurrency } from "@/lib/offer-format";
import { initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

type SortColumn = "spend" | "violations";

interface EmployeeRankingRow {
  employeeId: string;
  name: string;
  totalSpend: number;
  violationCount: number;
}

export function EmployeeRankingTable({ requests }: { requests: AdminQueueRequest[] }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const rows = useMemo<EmployeeRankingRow[]>(() => {
    const spend = spendByEmployee(requests);
    const violations = outOfPolicyByEmployee(requests);
    const byEmployee = new Map<string, EmployeeRankingRow>();

    for (const entry of spend) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        name: entry.name,
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
          totalSpend: 0,
          violationCount: entry.count,
        });
      }
    }
    return Array.from(byEmployee.values());
  }, [requests]);

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

  const selectedEmployee = sortedRows.find((row) => row.employeeId === selectedEmployeeId);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Ranking de funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
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
              {sortedRows.map((row) => (
                <TableRow
                  key={row.employeeId}
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
                  <TableCell>{formatCurrency(row.totalSpend, "BRL")}</TableCell>
                  <TableCell>{row.violationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedEmployee ? (
        <EmployeeDetail
          employeeId={selectedEmployee.employeeId}
          employeeName={selectedEmployee.name}
          requests={requests}
        />
      ) : null}
    </div>
  );
}
