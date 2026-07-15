"use client";

import { useMemo } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableNode, type TableNodeType } from "@/components/dev/table-node";
import { schemaEdges, schemaTables } from "@/lib/dev/database-schema";

const nodeTypes = { tableNode: TableNode };

const positions: Record<string, { x: number; y: number }> = {
  requests: { x: 0, y: 260 },
  onsite_weeks: { x: 420, y: 180 },
  exchange_rates: { x: 420, y: 620 },
  policy_rules: { x: 820, y: 0 },
  profiles: { x: 820, y: 460 },
  organizations: { x: 1240, y: 220 },
  "auth.users": { x: 1150, y: 600 },
};

export default function DatabaseSchemaPage() {
  const nodes = useMemo<TableNodeType[]>(
    () =>
      schemaTables.map((table) => ({
        id: table.id,
        type: "tableNode",
        position: positions[table.id] ?? { x: 0, y: 0 },
        data: { table },
      })),
    []
  );

  const edges = useMemo<Edge[]>(
    () =>
      schemaEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceColumn,
        target: edge.target,
        targetHandle: edge.targetColumn,
        type: "smoothstep",
        pathOptions: { borderRadius: 0 },
        animated: false,
        style: {
          stroke: "hsl(var(--muted-foreground))",
          strokeWidth: 1,
          strokeDasharray: edge.dashed ? 5 : undefined,
          opacity: 0.5,
        },
      })),
    []
  );

  return (
    <div className="h-screen w-screen bg-background">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3}>
        <Background />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
