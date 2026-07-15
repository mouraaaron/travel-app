"use client";

import { Diamond, KeyRound, MoreVertical, Table2 } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import type { SchemaColumn, SchemaTable } from "@/lib/dev/database-schema";

export type TableNodeType = Node<{ table: SchemaTable }, "tableNode">;

function ColumnBullet({ column }: { column: SchemaColumn }) {
  if (column.flags?.includes("pk")) {
    return <KeyRound className="h-3 w-3 shrink-0 text-amber-400" strokeWidth={2.5} />;
  }
  return (
    <Diamond
      className={cn("h-2.5 w-2.5 shrink-0", column.nullable ? "text-muted-foreground/50" : "text-violet-400")}
      fill={column.nullable ? "none" : "currentColor"}
      strokeWidth={2}
    />
  );
}

export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { table } = data;

  if (table.external) {
    const idColumn = table.columns.find((column) => column.flags?.includes("pk")) ?? table.columns[0];
    return (
      <div className="flex w-fit items-center gap-1.5 rounded-sm border border-border/60 bg-card/60 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
        <Table2 className="h-3 w-3 shrink-0" />
        <span className="font-mono">
          {table.name}.{idColumn.name}
        </span>
        <Handle
          type="target"
          position={Position.Left}
          id={idColumn.name}
          className="!h-1.5 !w-1.5 !rounded-none !border-none !bg-muted-foreground/60"
        />
      </div>
    );
  }

  return (
    <div className="w-[230px] overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold">{table.name}</span>
        </div>
        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>

      <div className="divide-y divide-border/60">
        {table.columns.map((column) => {
          const isPk = column.flags?.includes("pk");
          const isFk = column.flags?.includes("fk");
          const title = [column.check, column.note].filter(Boolean).join(" — ") || undefined;

          return (
            <div
              key={column.name}
              title={title}
              className="relative flex items-center justify-between gap-2 px-2.5 py-1.5"
            >
              {isPk && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={column.name}
                  className="!left-0 !h-1.5 !w-1.5 !rounded-none !border-none !bg-muted-foreground/60"
                />
              )}
              {isFk && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={column.name}
                  className="!right-0 !h-1.5 !w-1.5 !rounded-none !border-none !bg-muted-foreground/60"
                />
              )}

              <span className="flex min-w-0 items-center gap-1.5">
                <ColumnBullet column={column} />
                <span
                  className={cn(
                    "truncate font-mono text-[11px]",
                    isPk ? "font-semibold text-foreground" : "text-foreground/90"
                  )}
                >
                  {column.name}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{column.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
