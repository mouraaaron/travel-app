# Schema Diagram Crow's Foot Notation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add crow's foot notation (bar = "one", three-prong fork = "many") to the edges of the `/dev/schema` ReactFlow diagram, so relationship cardinality is visible without reading code.

**Architecture:** two SVG `<marker>` defs (`crowfoot-one`, `crowfoot-many`) rendered once in `src/app/dev/schema/page.tsx`, referenced by each edge's `markerStart`/`markerEnd` (raw marker `id` string — see "Critical gotcha" below). A new optional `oneToOne` flag on `SchemaEdge` (`src/lib/dev/database-schema.ts`) drives which marker pair an edge uses; every edge is 1-to-N by default, except `profiles-auth_users` which is 1-to-1.

**Tech Stack:** Next.js App Router, React, `@xyflow/react` (ReactFlow), TypeScript. No new dependencies.

## Global Constraints

- No SQL migrations, no changes under `supabase/migrations/` — this is a presentation-only change to a static TS data file and a client component.
- No automated tests — `/dev/schema` is a dev-only visual page with no existing test coverage (matches convention already used for other visual components in this repo, e.g. `flight-path-map.tsx`). Verification is `tsc`/`lint` + manual browser check.
- Do not run `npm run build` if `npm run dev` is already running elsewhere — concurrent build+dev corrupts `.next` and breaks the live dev server. Ask before running `npm run build`; prefer `npx tsc --noEmit` and `npm run lint` for automated verification.
- **Critical gotcha (verified against `node_modules/@xyflow/react/dist/esm/index.js:2955-2956`):** ReactFlow itself wraps a string `markerStart`/`markerEnd` as `` url('#' + value) ``. Passing an already-wrapped string like `"url(#crowfoot-one)"` produces the broken `url('#url(#crowfoot-one)')`. Edge objects must set `markerStart`/`markerEnd` to the **bare marker id** (`"crowfoot-one"`, `"crowfoot-many"`), never pre-wrapped in `url(...)`.

---

### Task 1: Mark the 1-to-1 relationship in schema data

**Files:**
- Modify: `src/lib/dev/database-schema.ts:26-34` (the `SchemaEdge` interface)
- Modify: `src/lib/dev/database-schema.ts:220-228` (the `profiles-auth_users` edge object)

**Interfaces:**
- Produces: `SchemaEdge.oneToOne?: boolean` — consumed by Task 2's marker-selection logic in `page.tsx`. Absent or `false` means 1-to-N (default); `true` means 1-to-1.

- [ ] **Step 1: Add the `oneToOne` field to `SchemaEdge`**

In `src/lib/dev/database-schema.ts`, replace:

```ts
export interface SchemaEdge {
  id: string;
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
  label: string;
  dashed?: boolean;
}
```

with:

```ts
export interface SchemaEdge {
  id: string;
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
  label: string;
  dashed?: boolean;
  /** 1-pra-1 (default é 1-pra-N, com o lado "muitos" em `source`). */
  oneToOne?: boolean;
}
```

- [ ] **Step 2: Mark `profiles-auth_users` as 1-to-1**

In the same file, find the `profiles-auth_users` edge inside `schemaEdges`:

```ts
  {
    id: "profiles-auth_users",
    source: "profiles",
    sourceColumn: "id",
    target: "auth.users",
    targetColumn: "id",
    label: "extends",
    dashed: true,
  },
```

Replace with:

```ts
  {
    id: "profiles-auth_users",
    source: "profiles",
    sourceColumn: "id",
    target: "auth.users",
    targetColumn: "id",
    label: "extends",
    dashed: true,
    oneToOne: true,
  },
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0 (no type errors — `oneToOne` is a valid optional field, `SchemaEdge[]` literal still matches).

- [ ] **Step 4: Commit**

```bash
git add src/lib/dev/database-schema.ts
git commit -m "feat: mark profiles-auth_users as one-to-one in schema diagram data"
```

---

### Task 2: Render crow's foot markers on diagram edges

**Files:**
- Modify: `src/app/dev/schema/page.tsx` (whole file — small, shown in full below)

**Interfaces:**
- Consumes: `SchemaEdge.oneToOne?: boolean` from Task 1.
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Add the hidden SVG marker defs and wire them into the edges**

Replace the full contents of `src/app/dev/schema/page.tsx` with:

```tsx
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

const MARKER_STROKE = { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 };

function CrowFootMarkerDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <marker id="crowfoot-one" viewBox="0 0 12 12" refX={10} refY={6} markerWidth={12} markerHeight={12} orient="auto">
          <path d="M 10 1 L 10 11" style={MARKER_STROKE} fill="none" />
        </marker>
        <marker id="crowfoot-many" viewBox="0 0 12 12" refX={0} refY={6} markerWidth={14} markerHeight={14} orient="auto">
          <path d="M 0 6 L 12 0 M 0 6 L 12 6 M 0 6 L 12 12" style={MARKER_STROKE} fill="none" />
        </marker>
      </defs>
    </svg>
  );
}

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
        markerStart: edge.oneToOne ? "crowfoot-one" : "crowfoot-many",
        markerEnd: "crowfoot-one",
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
      <CrowFootMarkerDefs />
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3}>
        <Background />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

Note what changed vs. the original: added `MARKER_STROKE` constant, added the `CrowFootMarkerDefs` component, rendered `<CrowFootMarkerDefs />` as a sibling right before `<ReactFlow>`, and added the two `markerStart`/`markerEnd` lines inside the edges `useMemo`. Everything else (positions, node mapping, `Background`/`MiniMap`/`Controls`) is unchanged.

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run lint`
Expected: no errors for `src/app/dev/schema/page.tsx`.

- [ ] **Step 3: Manual browser verification**

Start (or reuse an already-running) `npm run dev`, then in a browser:

1. Go to `/admin/settings`, click the schema diagram link → confirm it still opens `/dev/schema` normally.
2. On each of the 7 default (1-to-N) edges (`profiles-organizations`, `requests-organizations`, `requests-profiles`, `policy_rules-organizations`, `onsite_weeks-organizations`, `onsite_weeks-profiles`, `requests-onsite_weeks`): confirm a three-prong crow's foot appears at the FK-owning table's end of the line, and a single perpendicular bar appears at the PK-owning table's end.
3. On `profiles-auth_users`: confirm **both** ends show a single bar (no crow's foot) — this is the 1-to-1 case.
4. Toggle OS/browser dark mode: confirm marker color follows the line color (both use `--muted-foreground`).
5. Zoom and pan the diagram: confirm markers stay attached and correctly oriented at every zoom level (they should not stretch or detach — `markerUnits` defaults to `strokeWidth`, so they scale with the line).

- [ ] **Step 4: Commit**

```bash
git add src/app/dev/schema/page.tsx
git commit -m "feat: render crow's foot cardinality markers on schema diagram edges"
```
