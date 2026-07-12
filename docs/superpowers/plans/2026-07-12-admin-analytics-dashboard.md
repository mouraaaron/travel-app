# Admin Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two "em construção" placeholders (`src/app/admin/page.tsx`, `src/app/admin/reports/page.tsx`) with a real analytics dashboard — company-wide spend/compliance KPIs at `/admin`, per-employee drill-down at `/admin/reports` — backed by a pure aggregation library and a demo-data seed script.

**Architecture:** `/admin` and `/admin/reports` are `async` Server Components that fetch `requests` via `createSupabaseServerClient()` (real RLS, same pattern as `src/app/admin/requests/page.tsx`), map rows with the existing `toAdminQueueRequest`, and hand the resulting `AdminQueueRequest[]` to presentational/client components. `/admin` precomputes all KPIs server-side via `src/lib/admin-analytics.ts` (pure functions, no I/O) and passes already-aggregated data as props. `/admin/reports` passes the raw `AdminQueueRequest[]` into a client component (`EmployeeRankingTable`) that owns the row-selection state and calls the same pure functions client-side to (re)derive per-employee data on selection — this is the only way to support "select a row, no new route" without a server round-trip per click.

**Tech Stack:** Next.js 14 (App Router, Server Components), Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Recharts 2.15.4 via a verbatim shadcn `ui/chart.tsx`, shadcn `ui/table.tsx`, Tailwind v3, Vitest, `@faker-js/faker` (dev-only, seed script), `tsx` (dev-only, runs the seed script).

## Global Constraints

- **`recharts` pinned to `2.15.4`** (exact version, matches `paggo-university-prototypes`). **`@faker-js/faker` pinned to `^10.5.0`** (devDependency only — never imported outside `scripts/`). **`tsx` pinned to `^4.23.0`** (devDependency only, new script runner — this repo has no `.ts` script runner today).
- **No new Supabase migration.** `requests_select_own_or_admin` (`supabase/migrations/0001_init.sql`) and `profiles_select_org_admin` (`supabase/migrations/0003_profiles_admin_select.sql`) already grant admin `SELECT` on all org `requests`/`profiles`.
- **Do not modify `src/lib/policy.ts`.** Read its types (`DuffelPolicyEvaluation`, `DuffelPolicyViolation`, `DuffelPolicyFlags`) only.
- **No budget table, no date-range picker, no CSV/PDF export, no Tier‑3 KPIs** (nacional vs. internacional, ticket médio, taxa de aprovação/rejeição individual, cost center predominante por pessoa) — out of scope per spec.
- **Spend definition ("gasto realizado"):** a request counts toward every spend KPI (`monthlySpend`, `spendVsPreviousMonth`, `spendByEmployee`, `spendByCostCenter`, and the "Gasto total" stat card) only when `status` is one of `pending_admin`, `approved`, `needs_review`, `confirmed` — i.e. **not** `rejected` or `cancelled` (money never actually committed for those). This reading comes directly from the spec's decision #1: "KPIs de 'gasto realizado + desvio de política', não '% de budget consumido'."
- **Compliance/volume KPIs count every request regardless of status:** `complianceRate`, `outOfPolicyByEmployee`, `requestsByStatus`, `tripPurposeBreakdown`, `recentOutOfPolicy` are not filtered by the realized-spend rule above — a rejected request can still be evidence of a policy violation.
- **Spend amount always comes from `Number(request.selected_offer_snapshot.total_amount)`** (a string field). `AdminQueueRequest` (= `TravelRequest & { employeeName: string }`, defined in `src/lib/requests-mapper.ts`) has **no top-level `total_amount`/`total_currency`** — do not invent one.
- **`events[]` uses `at` for the timestamp and `kind` for the discriminator** (`"created" | "approved" | "rejected" | "needs_review" | "confirmed" | "cancelled"`) — not `created_at`/`type`.
- **`corporate.out_of_policy_justification` lives on `corporate`, not on `policy_evaluation`.**
- **`PolicyBadges` does not exist anywhere in this codebase.** The spec's claim that `employee-detail.tsx` can reuse it "sem alteração" is inaccurate (verified by search). Use the actual existing pattern instead: call `getDuffelPolicyBadge`/`getDuffelFlagBadges` from `src/lib/badge-variants.ts` directly and render `<Badge variant={badge.variant}>{badge.label}</Badge>`, exactly as `src/components/admin/requests-queue.tsx` already does. Do not create a new `PolicyBadges` component.
- **Testing:** only `src/lib/admin-analytics.ts` gets automated tests (Vitest, co-located `admin-analytics.test.ts`), matching the precedent in `2026-07-10-travel-admin-approval-panel-design.md` — no React component test runner exists in this repo (`vitest.config.ts` sets `environment: "node"`, no jsdom/RTL). Every other task is verified via `npm run build` (tsc + Next build, type-checks the whole `src/**` tree even for not-yet-wired files) and `npm run lint`.
- **shadcn "default" style conventions already in use:** `cn` from `@/lib/utils`, `React.forwardRef` + `displayName` on every primitive, `"use client"` at the top of interactive/stateful components. `ui/chart.tsx` and `ui/table.tsx` are copied **verbatim** from `C:\Users\aaron\bootcamp\reference\paggo-university-prototypes\.claude\skills\paggo-shadcn-bootstrap\boilerplate\src\components\ui\{chart,table}.tsx` — both already use Tailwind v3 + the same `cn` signature as `travel-app`, no adaptation needed.
- **`--chart-1`..`--chart-5` already exist** in `src/styles/paggo-shadcn-vars.css` (imported by `globals.css`), unconsumed until this feature. No `tailwind.config.ts` changes needed — `chart.tsx` references them via inline CSS custom properties (`var(--color-<key>)`), not Tailwind utility classes.
- **The admin layout (`src/app/admin/layout.tsx`) already provides page padding** (`px-6 pb-16 pt-8`) and the role gate — new page components render their content directly, no extra outer wrapper padding.
- Every task commits with `git add <files>` + `git commit` (no `--no-verify`).

---

### Task 1: Add dependencies and the seed npm script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `recharts` (dependency, `2.15.4`) importable by later tasks; `@faker-js/faker` and `tsx` (devDependencies) for the seed script; a `"seed"` npm script.

- [ ] **Step 1: Install the runtime dependency**

```bash
npm install recharts@2.15.4
```

- [ ] **Step 2: Install the dev dependencies**

```bash
npm install -D @faker-js/faker@^10.5.0 tsx@^4.23.0
```

- [ ] **Step 3: Add the `seed` script**

Open `package.json` and add a `"seed"` entry to `"scripts"` (Node 20.6+'s built-in `--env-file` flag loads `.env.local` without adding `dotenv` as a dependency — this repo's Node is v24, well past that floor):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "seed": "tsx --env-file=.env.local scripts/seed-demo-data.ts"
}
```

- [ ] **Step 4: Verify the install**

Run: `npm run build`
Expected: build succeeds (no new source files reference the new deps yet, so this just confirms `package.json`/`package-lock.json` are consistent and nothing broke).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts, faker, and tsx for the admin analytics dashboard"
```

---

### Task 2: Add shadcn `ui/chart.tsx` and `ui/table.tsx`

**Files:**
- Create: `src/components/ui/chart.tsx`
- Create: `src/components/ui/table.tsx`

**Interfaces:**
- Produces: `ChartContainer`, `ChartConfig`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle` from `@/components/ui/chart`; `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` from `@/components/ui/table`. Both consumed by every `admin/*` component built in later tasks.

- [ ] **Step 1: Create `src/components/ui/chart.tsx`**

Copy this verbatim (byte-identical to the reference repo's copy, already confirmed Tailwind-v3/`cn`-compatible with this project):

```tsx
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`
              const itemConfig = getPayloadConfigFromPayload(config, item, key)
              const indicatorColor = color || item.payload.fill || item.color

              return (
                <div
                  key={item.dataKey}
                  className={cn(
                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                    indicator === "dot" && "items-center"
                  )}
                >
                  {formatter && item?.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn(
                              "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                              {
                                "h-2.5 w-2.5": indicator === "dot",
                                "w-1": indicator === "line",
                                "w-0 border-[1.5px] border-dashed bg-transparent":
                                  indicator === "dashed",
                                "my-0.5": nestLabel && indicator === "dashed",
                              }
                            )}
                            style={
                              {
                                "--color-bg": indicatorColor,
                                "--color-border": indicatorColor,
                              } as React.CSSProperties
                            }
                          />
                        )
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "items-end" : "items-center"
                        )}
                      >
                        <div className="grid gap-1.5">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-muted-foreground">
                            {itemConfig?.label || item.name}
                          </span>
                        </div>
                        {item.value && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {item.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload
          .filter((item) => item.type !== "none")
          .map((item) => {
            const key = `${nameKey || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)

            return (
              <div
                key={item.value}
                className={cn(
                  "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
                )}
              >
                {itemConfig?.icon && !hideIcon ? (
                  <itemConfig.icon />
                ) : (
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />
                )}
                {itemConfig?.label}
              </div>
            )
          })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
```

- [ ] **Step 2: Create `src/components/ui/table.tsx`**

Copy this verbatim:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/chart.tsx src/components/ui/table.tsx
git commit -m "feat: add shadcn chart and table primitives"
```

---

### Task 3: `src/lib/admin-analytics.ts` — pure aggregation functions

**Files:**
- Create: `src/lib/admin-analytics.ts`
- Test: `src/lib/admin-analytics.test.ts`

**Interfaces:**
- Consumes: `AdminQueueRequest` from `./requests-mapper` (= `TravelRequest & { employeeName: string }`; fields used: `employee_id: string`, `employeeName: string`, `created_at: string`, `status: TravelRequestStatus`, `corporate: { cost_center: string; trip_purpose: TripPurpose; ... }`, `selected_offer_snapshot: { total_amount: string; total_currency: string; ... }`, `policy_evaluation: { compliant: boolean; ... }`, `events: { at: string; kind: "created"|"approved"|"rejected"|"needs_review"|"confirmed"|"cancelled" }[]`); `TravelRequestStatus`, `TripPurpose` from `./types`.
- Produces (consumed by Tasks 4–10):
  - `monthlySpend(requests: AdminQueueRequest[], months?: number): { month: string; total: number }[]`
  - `spendVsPreviousMonth(monthly: { month: string; total: number }[]): { current: number; deltaPct: number }`
  - `complianceRate(requests: AdminQueueRequest[]): { compliantCount: number; nonCompliantCount: number; ratePct: number }`
  - `spendByEmployee(requests: AdminQueueRequest[]): { employeeId: string; name: string; total: number }[]`
  - `outOfPolicyByEmployee(requests: AdminQueueRequest[]): { employeeId: string; name: string; count: number }[]`
  - `spendByCostCenter(requests: AdminQueueRequest[]): { costCenter: string; total: number }[]`
  - `requestsByStatus(requests: AdminQueueRequest[]): { status: TravelRequestStatus; count: number }[]` (always 6 entries, one per known status, in enum order)
  - `avgApprovalTimeHours(requests: AdminQueueRequest[]): number`
  - `tripPurposeBreakdown(requests: AdminQueueRequest[]): { purpose: TripPurpose; count: number }[]` (always 5 entries, one per known purpose, in enum order)
  - `recentOutOfPolicy(requests: AdminQueueRequest[], limit?: number): AdminQueueRequest[]`

- [ ] **Step 1: Write failing tests for `monthlySpend` and `spendVsPreviousMonth`**

Create `src/lib/admin-analytics.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monthlySpend, spendVsPreviousMonth } from "./admin-analytics";
import type { AdminQueueRequest } from "./requests-mapper";

function makeRequest(overrides: Partial<AdminQueueRequest> = {}): AdminQueueRequest {
  return {
    id: "req_1",
    organization_id: "org_1",
    employee_id: "emp_1",
    employeeName: "Carlos Medeiros",
    created_at: "2026-07-06T09:14:00Z",
    status: "pending_admin",
    search_criteria: {
      slices: [{ origin: "CNF", destination: "GRU", departure_date: "2026-07-20" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: "off_1",
      total_amount: "890.00",
      total_currency: "BRL",
      owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
      slices: [
        {
          origin: "CNF",
          destination: "GRU",
          departure_datetime: "2026-07-20T08:00:00Z",
          arrival_datetime: "2026-07-20T09:30:00Z",
          duration: "PT1H30M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-07-15T00:00:00Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "client_meeting",
      cost_center: "Vendas",
      business_justification: "Visita a cliente.",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [{ at: "2026-07-06T09:14:00Z", kind: "created" }],
    ...overrides,
  };
}

describe("monthlySpend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("buckets realized spend into the last 6 months, oldest first, zero-filling empty months", () => {
    const requests = [
      makeRequest({ id: "a", created_at: "2026-06-10T10:00:00Z", status: "approved", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", created_at: "2026-07-05T10:00:00Z", status: "confirmed", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", created_at: "2026-07-06T10:00:00Z", status: "rejected", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "2000.00" } }),
      makeRequest({ id: "d", created_at: "2026-01-01T10:00:00Z", status: "confirmed", selected_offer_snapshot: { ...makeRequest().selected_offer_snapshot, total_amount: "9999.00" } }),
    ];

    const result = monthlySpend(requests);

    expect(result).toEqual([
      { month: "Fev/26", total: 0 },
      { month: "Mar/26", total: 0 },
      { month: "Abr/26", total: 0 },
      { month: "Mai/26", total: 0 },
      { month: "Jun/26", total: 1000 },
      { month: "Jul/26", total: 500 },
    ]);
  });

  it("returns 6 zero buckets when there are no requests", () => {
    expect(monthlySpend([])).toHaveLength(6);
    expect(monthlySpend([]).every((bucket) => bucket.total === 0)).toBe(true);
  });
});

describe("spendVsPreviousMonth", () => {
  it("computes the percentage delta between the last two buckets", () => {
    const monthly = [
      { month: "Mai/26", total: 1000 },
      { month: "Jun/26", total: 1000 },
      { month: "Jul/26", total: 1500 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 1500, deltaPct: 50 });
  });

  it("treats a zero previous month with positive current spend as a 100% increase", () => {
    const monthly = [
      { month: "Jun/26", total: 0 },
      { month: "Jul/26", total: 500 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 500, deltaPct: 100 });
  });

  it("returns a zero delta when both months are zero", () => {
    const monthly = [
      { month: "Jun/26", total: 0 },
      { month: "Jul/26", total: 0 },
    ];
    expect(spendVsPreviousMonth(monthly)).toEqual({ current: 0, deltaPct: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `Cannot find module './admin-analytics'` (file doesn't exist yet).

- [ ] **Step 3: Implement `monthlySpend` and `spendVsPreviousMonth`**

Create `src/lib/admin-analytics.ts`:

```ts
import type { AdminQueueRequest } from "./requests-mapper";
import type { TravelRequestStatus, TripPurpose } from "./types";

const REALIZED_SPEND_STATUSES: TravelRequestStatus[] = [
  "pending_admin",
  "approved",
  "needs_review",
  "confirmed",
];

function requestSpend(request: AdminQueueRequest): number {
  return Number(request.selected_offer_snapshot.total_amount);
}

function isRealizedSpend(request: AdminQueueRequest): boolean {
  return REALIZED_SPEND_STATUSES.includes(request.status);
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(-2)}`;
}

export function monthlySpend(
  requests: AdminQueueRequest[],
  months = 6
): { month: string; total: number }[] {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return { label: monthLabel(date), year: date.getUTCFullYear(), month: date.getUTCMonth(), total: 0 };
  });

  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const created = new Date(request.created_at);
    const bucket = buckets.find(
      (b) => b.year === created.getUTCFullYear() && b.month === created.getUTCMonth()
    );
    if (bucket) bucket.total += requestSpend(request);
  }

  return buckets.map((b) => ({ month: b.label, total: b.total }));
}

export function spendVsPreviousMonth(
  monthly: { month: string; total: number }[]
): { current: number; deltaPct: number } {
  const current = monthly.at(-1)?.total ?? 0;
  const previous = monthly.length >= 2 ? monthly[monthly.length - 2].total : 0;
  if (previous === 0) {
    return { current, deltaPct: current === 0 ? 0 : 100 };
  }
  return { current, deltaPct: ((current - previous) / previous) * 100 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write failing tests for `complianceRate`, `spendByEmployee`, `outOfPolicyByEmployee`, `spendByCostCenter`**

Append to `src/lib/admin-analytics.test.ts`:

```ts
import { complianceRate, outOfPolicyByEmployee, spendByCostCenter, spendByEmployee } from "./admin-analytics";

describe("complianceRate", () => {
  it("counts compliant vs non-compliant requests regardless of status", () => {
    const requests = [
      makeRequest({ id: "a", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "b", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "c", policy_evaluation: { compliant: true, violations: [], flags: { international_travel: false, cost_above_threshold: false } } }),
      makeRequest({ id: "d", status: "rejected", policy_evaluation: { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } } }),
    ];
    expect(complianceRate(requests)).toEqual({ compliantCount: 3, nonCompliantCount: 1, ratePct: 75 });
  });

  it("returns a zero rate for an empty list", () => {
    expect(complianceRate([])).toEqual({ compliantCount: 0, nonCompliantCount: 0, ratePct: 0 });
  });
});

describe("spendByEmployee", () => {
  it("sums realized spend per employee, sorted descending", () => {
    const snapshot = makeRequest().selected_offer_snapshot;
    const requests = [
      makeRequest({ id: "a", employee_id: "A", employeeName: "Alice", status: "approved", selected_offer_snapshot: { ...snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", employee_id: "A", employeeName: "Alice", status: "confirmed", selected_offer_snapshot: { ...snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", employee_id: "B", employeeName: "Bob", status: "rejected", selected_offer_snapshot: { ...snapshot, total_amount: "2000.00" } }),
      makeRequest({ id: "d", employee_id: "B", employeeName: "Bob", status: "approved", selected_offer_snapshot: { ...snapshot, total_amount: "300.00" } }),
    ];
    expect(spendByEmployee(requests)).toEqual([
      { employeeId: "A", name: "Alice", total: 1500 },
      { employeeId: "B", name: "Bob", total: 300 },
    ]);
  });
});

describe("outOfPolicyByEmployee", () => {
  it("counts non-compliant requests per employee, sorted descending", () => {
    const compliant = makeRequest().policy_evaluation;
    const nonCompliant = { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } };
    const requests = [
      makeRequest({ id: "a", employee_id: "A", employeeName: "Alice", policy_evaluation: nonCompliant }),
      makeRequest({ id: "b", employee_id: "A", employeeName: "Alice", policy_evaluation: nonCompliant }),
      makeRequest({ id: "c", employee_id: "A", employeeName: "Alice", policy_evaluation: compliant }),
      makeRequest({ id: "d", employee_id: "B", employeeName: "Bob", policy_evaluation: nonCompliant }),
    ];
    expect(outOfPolicyByEmployee(requests)).toEqual([
      { employeeId: "A", name: "Alice", count: 2 },
      { employeeId: "B", name: "Bob", count: 1 },
    ]);
  });
});

describe("spendByCostCenter", () => {
  it("sums realized spend per cost center, sorted descending", () => {
    const snapshot = makeRequest().selected_offer_snapshot;
    const requests = [
      makeRequest({ id: "a", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "Vendas" }, selected_offer_snapshot: { ...snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", status: "confirmed", corporate: { ...makeRequest().corporate, cost_center: "Vendas" }, selected_offer_snapshot: { ...snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "Engenharia" }, selected_offer_snapshot: { ...snapshot, total_amount: "800.00" } }),
    ];
    expect(spendByCostCenter(requests)).toEqual([
      { costCenter: "Vendas", total: 1500 },
      { costCenter: "Engenharia", total: 800 },
    ]);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `complianceRate`, `spendByEmployee`, `outOfPolicyByEmployee`, `spendByCostCenter` are not exported.

- [ ] **Step 7: Implement `complianceRate`, `spendByEmployee`, `outOfPolicyByEmployee`, `spendByCostCenter`**

Append to `src/lib/admin-analytics.ts`:

```ts
export function complianceRate(requests: AdminQueueRequest[]): {
  compliantCount: number;
  nonCompliantCount: number;
  ratePct: number;
} {
  const compliantCount = requests.filter((r) => r.policy_evaluation.compliant).length;
  const nonCompliantCount = requests.length - compliantCount;
  const ratePct = requests.length === 0 ? 0 : (compliantCount / requests.length) * 100;
  return { compliantCount, nonCompliantCount, ratePct };
}

export function spendByEmployee(
  requests: AdminQueueRequest[]
): { employeeId: string; name: string; total: number }[] {
  const totals = new Map<string, { name: string; total: number }>();
  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const entry = totals.get(request.employee_id) ?? { name: request.employeeName, total: 0 };
    entry.total += requestSpend(request);
    totals.set(request.employee_id, entry);
  }
  return [...totals.entries()]
    .map(([employeeId, { name, total }]) => ({ employeeId, name, total }))
    .sort((a, b) => b.total - a.total);
}

export function outOfPolicyByEmployee(
  requests: AdminQueueRequest[]
): { employeeId: string; name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const request of requests) {
    if (request.policy_evaluation.compliant) continue;
    const entry = counts.get(request.employee_id) ?? { name: request.employeeName, count: 0 };
    entry.count += 1;
    counts.set(request.employee_id, entry);
  }
  return [...counts.entries()]
    .map(([employeeId, { name, count }]) => ({ employeeId, name, count }))
    .sort((a, b) => b.count - a.count);
}

export function spendByCostCenter(
  requests: AdminQueueRequest[]
): { costCenter: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const key = request.corporate.cost_center;
    totals.set(key, (totals.get(key) ?? 0) + requestSpend(request));
  }
  return [...totals.entries()]
    .map(([costCenter, total]) => ({ costCenter, total }))
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 9: Write failing tests for `requestsByStatus` and `tripPurposeBreakdown`**

Append to `src/lib/admin-analytics.test.ts`:

```ts
import { requestsByStatus, tripPurposeBreakdown } from "./admin-analytics";

describe("requestsByStatus", () => {
  it("returns all 6 statuses in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", status: "confirmed" }),
      makeRequest({ id: "b", status: "confirmed" }),
      makeRequest({ id: "c", status: "pending_admin" }),
    ];
    expect(requestsByStatus(requests)).toEqual([
      { status: "pending_admin", count: 1 },
      { status: "approved", count: 0 },
      { status: "rejected", count: 0 },
      { status: "needs_review", count: 0 },
      { status: "confirmed", count: 2 },
      { status: "cancelled", count: 0 },
    ]);
  });
});

describe("tripPurposeBreakdown", () => {
  it("returns all 5 purposes in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", corporate: { ...makeRequest().corporate, trip_purpose: "conference" } }),
      makeRequest({ id: "b", corporate: { ...makeRequest().corporate, trip_purpose: "conference" } }),
      makeRequest({ id: "c", corporate: { ...makeRequest().corporate, trip_purpose: "client_meeting" } }),
    ];
    expect(tripPurposeBreakdown(requests)).toEqual([
      { purpose: "client_meeting", count: 1 },
      { purpose: "conference", count: 2 },
      { purpose: "internal_meeting", count: 0 },
      { purpose: "training", count: 0 },
      { purpose: "other", count: 0 },
    ]);
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `requestsByStatus`, `tripPurposeBreakdown` are not exported.

- [ ] **Step 11: Implement `requestsByStatus` and `tripPurposeBreakdown`**

Append to `src/lib/admin-analytics.ts`:

```ts
const ALL_STATUSES: TravelRequestStatus[] = [
  "pending_admin",
  "approved",
  "rejected",
  "needs_review",
  "confirmed",
  "cancelled",
];

export function requestsByStatus(
  requests: AdminQueueRequest[]
): { status: TravelRequestStatus; count: number }[] {
  return ALL_STATUSES.map((status) => ({
    status,
    count: requests.filter((r) => r.status === status).length,
  }));
}

const ALL_TRIP_PURPOSES: TripPurpose[] = [
  "client_meeting",
  "conference",
  "internal_meeting",
  "training",
  "other",
];

export function tripPurposeBreakdown(
  requests: AdminQueueRequest[]
): { purpose: TripPurpose; count: number }[] {
  return ALL_TRIP_PURPOSES.map((purpose) => ({
    purpose,
    count: requests.filter((r) => r.corporate.trip_purpose === purpose).length,
  }));
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 13: Write failing tests for `avgApprovalTimeHours`**

Append to `src/lib/admin-analytics.test.ts`:

```ts
import { avgApprovalTimeHours } from "./admin-analytics";

describe("avgApprovalTimeHours", () => {
  it("averages hours between the created event and the earliest approved/rejected event", () => {
    const requests = [
      makeRequest({
        id: "a",
        events: [
          { at: "2026-07-01T00:00:00Z", kind: "created" },
          { at: "2026-07-02T00:00:00Z", kind: "approved" },
        ],
      }),
      makeRequest({
        id: "b",
        events: [
          { at: "2026-07-01T00:00:00Z", kind: "created" },
          { at: "2026-07-01T12:00:00Z", kind: "rejected" },
        ],
      }),
      makeRequest({
        id: "c",
        events: [{ at: "2026-07-01T00:00:00Z", kind: "created" }],
      }),
    ];
    expect(avgApprovalTimeHours(requests)).toBe(18);
  });

  it("returns 0 when no request has both a created and a resolution event", () => {
    const requests = [makeRequest({ events: [{ at: "2026-07-01T00:00:00Z", kind: "created" }] })];
    expect(avgApprovalTimeHours(requests)).toBe(0);
  });
});
```

- [ ] **Step 14: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `avgApprovalTimeHours` is not exported.

- [ ] **Step 15: Implement `avgApprovalTimeHours`**

Append to `src/lib/admin-analytics.ts`:

```ts
export function avgApprovalTimeHours(requests: AdminQueueRequest[]): number {
  const durationsHours: number[] = [];

  for (const request of requests) {
    const created = request.events.find((e) => e.kind === "created");
    const resolutions = request.events.filter((e) => e.kind === "approved" || e.kind === "rejected");
    if (!created || resolutions.length === 0) continue;

    const earliest = resolutions.reduce((min, event) =>
      new Date(event.at).getTime() < new Date(min.at).getTime() ? event : min
    );
    const hours = (new Date(earliest.at).getTime() - new Date(created.at).getTime()) / (1000 * 60 * 60);
    durationsHours.push(hours);
  }

  if (durationsHours.length === 0) return 0;
  return durationsHours.reduce((sum, h) => sum + h, 0) / durationsHours.length;
}
```

- [ ] **Step 16: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 17: Write failing tests for `recentOutOfPolicy`**

Append to `src/lib/admin-analytics.test.ts`:

```ts
import { recentOutOfPolicy } from "./admin-analytics";

describe("recentOutOfPolicy", () => {
  it("returns the N most recent non-compliant requests, newest first", () => {
    const compliant = makeRequest().policy_evaluation;
    const nonCompliant = { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } };
    const requests = [
      makeRequest({ id: "a", created_at: "2026-07-01T00:00:00Z", policy_evaluation: nonCompliant }),
      makeRequest({ id: "b", created_at: "2026-07-15T00:00:00Z", policy_evaluation: compliant }),
      makeRequest({ id: "c", created_at: "2026-07-10T00:00:00Z", policy_evaluation: nonCompliant }),
      makeRequest({ id: "d", created_at: "2026-07-05T00:00:00Z", policy_evaluation: nonCompliant }),
    ];
    expect(recentOutOfPolicy(requests, 2).map((r) => r.id)).toEqual(["c", "d"]);
  });

  it("defaults to a limit of 5", () => {
    const nonCompliant = { compliant: false, violations: [], flags: { international_travel: false, cost_above_threshold: true } };
    const requests = Array.from({ length: 8 }, (_, i) =>
      makeRequest({ id: `r${i}`, created_at: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00Z`, policy_evaluation: nonCompliant })
    );
    expect(recentOutOfPolicy(requests)).toHaveLength(5);
  });
});
```

- [ ] **Step 18: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `recentOutOfPolicy` is not exported.

- [ ] **Step 19: Implement `recentOutOfPolicy`**

Append to `src/lib/admin-analytics.ts`:

```ts
export function recentOutOfPolicy(
  requests: AdminQueueRequest[],
  limit = 5
): AdminQueueRequest[] {
  return [...requests]
    .filter((r) => !r.policy_evaluation.compliant)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
```

- [ ] **Step 20: Run the full test suite**

Run: `npm run test`
Expected: PASS — all 16 tests in `admin-analytics.test.ts` plus the pre-existing suite (51 tests before this task).

- [ ] **Step 21: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 22: Commit**

```bash
git add src/lib/admin-analytics.ts src/lib/admin-analytics.test.ts
git commit -m "feat: add pure aggregation functions for the admin analytics dashboard"
```

---

### Task 4: `admin/stat-cards.tsx`

**Files:**
- Create: `src/components/admin/stat-cards.tsx`

**Interfaces:**
- Consumes: `formatCurrency` from `@/lib/offer-format`; `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` from `@/components/ui/card`; `Badge` from `@/components/ui/badge`.
- Produces: `StatCards(props: { totalSpend: number; spendDeltaPct: number; complianceRatePct: number; avgApprovalTimeHours: number; totalRequests: number }): JSX.Element`, consumed by Task 8.

- [ ] **Step 1: Create the component**

Create `src/components/admin/stat-cards.tsx`:

```tsx
import { ArrowDown, ArrowUp, CheckCircle2, Clock, ListChecks, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/offer-format";

interface StatCardsProps {
  totalSpend: number;
  spendDeltaPct: number;
  complianceRatePct: number;
  avgApprovalTimeHours: number;
  totalRequests: number;
}

export function StatCards({
  totalSpend,
  spendDeltaPct,
  complianceRatePct,
  avgApprovalTimeHours,
  totalRequests,
}: StatCardsProps) {
  const isUp = spendDeltaPct >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Gasto total (mês atual)</CardDescription>
          <Wallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{formatCurrency(totalSpend, "BRL")}</CardTitle>
          <Badge variant={isUp ? "default" : "secondary"} className="w-fit gap-1">
            {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(spendDeltaPct).toFixed(1)}% vs. mês anterior
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Taxa de compliance</CardDescription>
          <CheckCircle2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{complianceRatePct.toFixed(1)}%</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Tempo médio de aprovação</CardDescription>
          <Clock className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{avgApprovalTimeHours.toFixed(1)}h</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Volume de solicitações</CardDescription>
          <ListChecks className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardTitle className="text-2xl">{totalRequests}</CardTitle>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/stat-cards.tsx
git commit -m "feat: add admin dashboard stat cards"
```

---

### Task 5: `admin/spend-chart.tsx`

**Files:**
- Create: `src/components/admin/spend-chart.tsx`

**Interfaces:**
- Consumes: `ChartConfig`, `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` from `@/components/ui/chart` (Task 2); `formatCurrency` from `@/lib/offer-format`; the exact shape produced by `monthlySpend` (Task 3): `{ month: string; total: number }[]`.
- Produces: `SpendChart(props: { data: { month: string; total: number }[]; title?: string; description?: string }): JSX.Element`, consumed by Task 8 (company-wide) and Task 9 (`employee-detail.tsx`, filtered data + custom title/description).

- [ ] **Step 1: Create the component**

Create `src/components/admin/spend-chart.tsx`:

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/offer-format";

const chartConfig: ChartConfig = {
  total: { label: "Gasto", color: "hsl(var(--chart-1))" },
};

function formatCompactBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value, "BRL");
}

interface SpendChartProps {
  data: { month: string; total: number }[];
  title?: string;
  description?: string;
}

export function SpendChart({ data, title = "Gasto mensal", description = "Últimos 6 meses" }: SpendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatCompactBRL} width={64} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), "BRL")} labelKey="month" />}
            />
            <Area dataKey="total" type="monotone" fill="url(#fillTotal)" stroke="var(--color-total)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/spend-chart.tsx
git commit -m "feat: add reusable monthly spend area chart"
```

---

### Task 6: `admin/out-of-policy-panel.tsx`

**Files:**
- Create: `src/components/admin/out-of-policy-panel.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` from `@/components/ui/card`; `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` from `@/components/ui/table` (Task 2); `Badge` from `@/components/ui/badge`; `EmptyState` from `@/components/ui/empty-state`; `getDuffelPolicyBadge`/`getDuffelFlagBadges` from `@/lib/badge-variants`; `formatCurrency`/`formatDate`/`getRouteLabel` from `@/lib/offer-format`; `AdminQueueRequest` from `@/lib/requests-mapper`; the shape produced by `recentOutOfPolicy` (Task 3).
- Produces: `OutOfPolicyPanel(props: { requests: AdminQueueRequest[] }): JSX.Element`, consumed by Task 8 (`requests` = `recentOutOfPolicy(allRequests)`).

Per the spec's Tier‑2 KPI list ("tabela de requests fora de política com `out_of_policy_justification`"), this table must surface `request.corporate.out_of_policy_justification` — it is the only place in the spec's component list where that field is displayed, so it belongs on this panel's table, not only on `employee-detail.tsx`.

- [ ] **Step 1: Create the component**

Create `src/components/admin/out-of-policy-panel.tsx`:

```tsx
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function OutOfPolicyPanel({ requests }: { requests: AdminQueueRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fora de política</CardTitle>
        <CardDescription>Solicitações não compliant mais recentes</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="Nenhuma solicitação fora de política" size="tiny" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const snapshot = request.selected_offer_snapshot;
                const { origin, destination } = getRouteLabel(snapshot.slices);
                const policyBadge = getDuffelPolicyBadge(request.policy_evaluation);
                const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
                return (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium text-foreground">{request.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {origin} → {destination}
                    </TableCell>
                    <TableCell>{formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
                        {flagBadges.map((badge) => (
                          <Badge key={badge.label} variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {request.corporate.out_of_policy_justification ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(request.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/out-of-policy-panel.tsx
git commit -m "feat: add out-of-policy side panel for the admin dashboard"
```

---

### Task 7: `admin/spend-breakdown-charts.tsx`

The spec's "Componentes por página" section describes three extra `/admin` visualizations (volume por status, ranking de cost centers, trip purpose) without listing dedicated files in its "Componentes de UI novos" bullet. Rather than inlining three separate Recharts configurations directly into the page's Server Component (which would mix data-fetching with three unrelated chart implementations in one file), this task gives them one small, focused file — consistent with the plan's "one clear responsibility per file" guidance.

**Files:**
- Create: `src/components/admin/spend-breakdown-charts.tsx`

**Interfaces:**
- Consumes: `ChartConfig`/`ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartLegend`/`ChartLegendContent` from `@/components/ui/chart`; `getTravelRequestStatusBadge` from `@/lib/badge-variants`; `formatCurrency` from `@/lib/offer-format`; `TravelRequestStatus`/`TripPurpose` from `@/lib/types`; the shapes produced by `requestsByStatus`, `spendByCostCenter`, `tripPurposeBreakdown` (Task 3).
- Produces: `StatusVolumeChart(props: { data: { status: TravelRequestStatus; count: number }[] })`, `CostCenterRankingChart(props: { data: { costCenter: string; total: number }[] })`, `TripPurposeChart(props: { data: { purpose: TripPurpose; count: number }[] })` — all consumed by Task 8.

- [ ] **Step 1: Create the component**

Create `src/components/admin/spend-breakdown-charts.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/spend-breakdown-charts.tsx
git commit -m "feat: add status volume, cost center, and trip purpose charts"
```

---

### Task 8: `src/app/admin/page.tsx` — wire the overview dashboard

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabase/server`; `toAdminQueueRequest`, `RequestRowWithEmployee` from `@/lib/requests-mapper`; all 10 functions from `@/lib/admin-analytics` (Task 3); `StatCards` (Task 4); `SpendChart` (Task 5); `OutOfPolicyPanel` (Task 6); `StatusVolumeChart`/`CostCenterRankingChart`/`TripPurposeChart` (Task 7); `EmptyState` from `@/components/ui/empty-state`.
- Produces: the `/admin` route.

- [ ] **Step 1: Replace the placeholder**

Replace the full contents of `src/app/admin/page.tsx`:

```tsx
import { BarChart3 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import {
  avgApprovalTimeHours,
  complianceRate,
  monthlySpend,
  recentOutOfPolicy,
  requestsByStatus,
  spendByCostCenter,
  spendVsPreviousMonth,
  tripPurposeBreakdown,
} from "@/lib/admin-analytics";
import { StatCards } from "@/components/admin/stat-cards";
import { SpendChart } from "@/components/admin/spend-chart";
import { OutOfPolicyPanel } from "@/components/admin/out-of-policy-panel";
import {
  CostCenterRankingChart,
  StatusVolumeChart,
  TripPurposeChart,
} from "@/components/admin/spend-breakdown-charts";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-foreground">Painel</h1>
        <EmptyState icon={BarChart3} title="Nenhuma solicitação registrada ainda" />
      </div>
    );
  }

  const monthly = monthlySpend(requests);
  const spendDelta = spendVsPreviousMonth(monthly);
  const compliance = complianceRate(requests);
  const avgApproval = avgApprovalTimeHours(requests);
  const statusVolume = requestsByStatus(requests);
  const costCenterRanking = spendByCostCenter(requests);
  const tripPurpose = tripPurposeBreakdown(requests);
  const outOfPolicy = recentOutOfPolicy(requests);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Painel</h1>

      <StatCards
        totalSpend={spendDelta.current}
        spendDeltaPct={spendDelta.deltaPct}
        complianceRatePct={compliance.ratePct}
        avgApprovalTimeHours={avgApproval}
        totalRequests={requests.length}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendChart data={monthly} />
        </div>
        <OutOfPolicyPanel requests={outOfPolicy} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusVolumeChart data={statusVolume} />
        <CostCenterRankingChart data={costCenterRanking} />
        <TripPurposeChart data={tripPurpose} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: wire the admin overview dashboard"
```

---

### Task 9: `admin/employee-detail.tsx` and `admin/employee-ranking-table.tsx`

These two are built together: `EmployeeRankingTable` owns the row-selection state and renders `EmployeeDetail` beneath itself, matching the spec's description ("clique na linha da tabela seleciona ... e renderiza `employee-detail.tsx` abaixo").

**Files:**
- Create: `src/components/admin/employee-detail.tsx`
- Create: `src/components/admin/employee-ranking-table.tsx`

**Interfaces:**
- Consumes: `monthlySpend`, `spendByEmployee`, `outOfPolicyByEmployee` from `@/lib/admin-analytics` (Task 3); `SpendChart` from `@/components/admin/spend-chart` (Task 5); `Avatar`/`AvatarFallback` from `@/components/ui/avatar`; `Table*` from `@/components/ui/table` (Task 2); `Card*` from `@/components/ui/card`; `Badge` from `@/components/ui/badge`; `EmptyState` from `@/components/ui/empty-state`; `getDuffelFlagBadges` from `@/lib/badge-variants`; `formatCurrency`/`formatDate`/`getRouteLabel` from `@/lib/offer-format`; `initialsFromName` from `@/lib/utils`; `AdminQueueRequest` from `@/lib/requests-mapper`.
- Produces: `EmployeeDetail(props: { employeeId: string; employeeName: string; requests: AdminQueueRequest[] }): JSX.Element`; `EmployeeRankingTable(props: { requests: AdminQueueRequest[] }): JSX.Element` (consumed by Task 10).

- [ ] **Step 1: Create `employee-detail.tsx`**

Create `src/components/admin/employee-detail.tsx`:

```tsx
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SpendChart } from "@/components/admin/spend-chart";
import { monthlySpend } from "@/lib/admin-analytics";
import { getDuffelFlagBadges } from "@/lib/badge-variants";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

interface EmployeeDetailProps {
  employeeId: string;
  employeeName: string;
  requests: AdminQueueRequest[];
}

export function EmployeeDetail({ employeeId, employeeName, requests }: EmployeeDetailProps) {
  const employeeRequests = requests.filter((request) => request.employee_id === employeeId);
  const monthly = monthlySpend(employeeRequests);
  const outOfPolicy = [...employeeRequests]
    .filter((request) => !request.policy_evaluation.compliant)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <SpendChart data={monthly} title="Gasto mensal" description={employeeName} />

      <Card>
        <CardHeader>
          <CardTitle>Desvios de política — {employeeName}</CardTitle>
        </CardHeader>
        <CardContent>
          {outOfPolicy.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhum desvio de política" size="tiny" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outOfPolicy.map((request) => {
                  const snapshot = request.selected_offer_snapshot;
                  const { origin, destination } = getRouteLabel(snapshot.slices);
                  const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>
                            {origin} → {destination}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {flagBadges.map((badge) => (
                              <Badge key={badge.label} variant={badge.variant}>
                                {badge.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}</TableCell>
                      <TableCell className="max-w-[220px] text-muted-foreground">
                        {request.corporate.out_of_policy_justification ?? "—"}
                      </TableCell>
                      <TableCell>{formatDate(request.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `employee-ranking-table.tsx`**

Create `src/components/admin/employee-ranking-table.tsx`:

```tsx
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
    return [...byEmployee.values()];
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
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/employee-detail.tsx src/components/admin/employee-ranking-table.tsx
git commit -m "feat: add employee ranking table with drill-down detail"
```

---

### Task 10: `src/app/admin/reports/page.tsx` — wire the reports page

**Files:**
- Modify: `src/app/admin/reports/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabase/server`; `toAdminQueueRequest`, `RequestRowWithEmployee` from `@/lib/requests-mapper`; `EmployeeRankingTable` from `@/components/admin/employee-ranking-table` (Task 9); `EmptyState` from `@/components/ui/empty-state`.
- Produces: the `/admin/reports` route.

- [ ] **Step 1: Replace the placeholder**

Replace the full contents of `src/app/admin/reports/page.tsx`:

```tsx
import { Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { EmployeeRankingTable } from "@/components/admin/employee-ranking-table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminReportsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
      {requests.length === 0 ? (
        <EmptyState icon={Users} title="Nenhuma solicitação registrada ainda" />
      ) : (
        <EmployeeRankingTable requests={requests} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/reports/page.tsx
git commit -m "feat: wire the admin reports page"
```

---

### Task 11: `scripts/seed-demo-data.ts`

**Files:**
- Create: `scripts/seed-demo-data.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js`'s `createClient` (standalone client with the service-role key — neither `createSupabaseServerClient()` nor `createSupabaseBrowserClient()` work outside a Next.js request/browser context); `fakerPT_BR` from `@faker-js/faker`; `TravelRequestStatus`, `TripPurpose` from `../src/lib/types`.
- Produces: a `npm run seed` command that populates 4 new `employee` profiles + ~60 historical `requests` for demo purposes. No other file imports this script.

- [ ] **Step 1: Create the script**

Create `scripts/seed-demo-data.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { fakerPT_BR as faker } from "@faker-js/faker";
import type { TravelRequestStatus, TripPurpose } from "../src/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o seed."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";
const REQUESTS_PER_EMPLOYEE = 12;

const COST_CENTERS = ["Engenharia", "Vendas", "Marketing", "Operações"];
const TRIP_PURPOSES: TripPurpose[] = ["client_meeting", "conference", "internal_meeting", "training", "other"];
const CARRIERS = [
  { iata_code: "LA", name: "LATAM" },
  { iata_code: "G3", name: "Gol" },
  { iata_code: "AD", name: "Azul" },
];
const ROUTES: Array<{ origin: string; destination: string; international: boolean }> = [
  { origin: "GRU", destination: "GIG", international: false },
  { origin: "GRU", destination: "BSB", international: false },
  { origin: "GRU", destination: "CNF", international: false },
  { origin: "GRU", destination: "SSA", international: false },
  { origin: "GRU", destination: "JFK", international: true },
  { origin: "GRU", destination: "MIA", international: true },
];

// Maioria confirmed/approved, com alguns pending_admin/rejected/cancelled — mistura realista.
const STATUS_POOL: TravelRequestStatus[] = [
  "confirmed", "confirmed", "confirmed",
  "approved", "approved", "approved",
  "pending_admin", "pending_admin",
  "rejected",
  "cancelled",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDateWithinLastMonths(months: number): Date {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

async function createEmployee(organizationId: string): Promise<{ id: string; fullName: string }> {
  const fullName = faker.person.fullName();
  const email = faker.internet
    .email({ firstName: fullName.split(" ")[0], provider: "demo-paggo.com" })
    .toLowerCase();

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: "Employee#Demo2026",
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(`Falha ao criar usuário ${email}: ${userError?.message}`);
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userData.user.id,
    organization_id: organizationId,
    role: "employee",
    full_name: fullName,
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile para ${email}: ${profileError.message}`);
  }

  console.log(`Criado employee: ${fullName} <${email}>`);
  return { id: userData.user.id, fullName };
}

function buildRequest(employeeId: string, organizationId: string) {
  const status = pick(STATUS_POOL);
  const route = pick(ROUTES);
  const carrier = pick(CARRIERS);
  const compliant = Math.random() > 0.25; // ~25% fora de política
  const basePrice = route.international ? 4500 + Math.random() * 6000 : 400 + Math.random() * 3200;
  const totalAmount = Number((compliant ? basePrice : basePrice + 3000 + Math.random() * 4000).toFixed(2));
  const createdAt = randomDateWithinLastMonths(6);
  const purpose = pick(TRIP_PURPOSES);
  const costCenter = pick(COST_CENTERS);
  const cap = route.international ? 12000 : 3500;

  const events: Array<{ at: string; kind: string }> = [{ at: createdAt.toISOString(), kind: "created" }];
  if (status !== "pending_admin") {
    const resolvedAt = new Date(createdAt.getTime() + (2 + Math.random() * 46) * 60 * 60 * 1000);
    const kind = status === "rejected" ? "rejected" : status === "cancelled" ? "cancelled" : "approved";
    events.push({ at: resolvedAt.toISOString(), kind });
    if (status === "confirmed") {
      events.push({ at: new Date(resolvedAt.getTime() + 60 * 60 * 1000).toISOString(), kind: "confirmed" });
    }
  }

  return {
    organization_id: organizationId,
    employee_id: employeeId,
    status,
    total_amount: totalAmount,
    total_currency: "BRL",
    created_at: createdAt.toISOString(),
    search_criteria: {
      slices: [{ origin: route.origin, destination: route.destination, departure_date: createdAt.toISOString().slice(0, 10) }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: `off_seed_${faker.string.alphanumeric(10)}`,
      total_amount: totalAmount.toFixed(2),
      total_currency: "BRL",
      owner: { iata_code: carrier.iata_code, name: carrier.name, logo_symbol_url: "" },
      slices: [
        {
          origin: route.origin,
          destination: route.destination,
          departure_datetime: createdAt.toISOString(),
          arrival_datetime: new Date(createdAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          duration: "PT3H00M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passenger_identity_documents_required: route.international,
      expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
    passengers: [],
    corporate: {
      trip_purpose: purpose,
      cost_center: costCenter,
      business_justification: faker.lorem.sentence(),
      ...(compliant ? {} : { out_of_policy_justification: faker.lorem.sentence() }),
    },
    policy_evaluation: {
      compliant,
      violations: compliant
        ? []
        : [
            {
              rule_id: "cost-cap",
              message: `Preço R$ ${totalAmount.toFixed(2)} excede o teto de R$ ${cap.toFixed(2)} para voos ${
                route.international ? "internacionais" : "domésticos"
              }.`,
              field: "totalAmount",
              expected: `<= ${cap}`,
              actual: String(totalAmount),
            },
          ],
      flags: {
        international_travel: route.international,
        cost_above_threshold: !compliant,
      },
    },
    events,
  };
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada — rode a migração 0001_init.sql primeiro.`);
  }

  const newEmployees = await Promise.all([
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
  ]);
  const employeeIds = [DEMO_EMPLOYEE_ID, ...newEmployees.map((e) => e.id)];

  const requests = employeeIds.flatMap((employeeId) =>
    Array.from({ length: REQUESTS_PER_EMPLOYEE }, () => buildRequest(employeeId, org.id))
  );

  const { error: insertError } = await supabase.from("requests").insert(requests);
  if (insertError) {
    throw new Error(`Falha ao inserir requests: ${insertError.message}`);
  }

  console.log(`Seed concluído: ${newEmployees.length} employees novos, ${requests.length} requests criadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check the script**

Run: `npx tsc --noEmit`
Expected: no errors (this checks `scripts/seed-demo-data.ts` alongside the rest of `src/**`, per the default `tsconfig.json` include).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: succeeds.

- [ ] **Step 4: Do NOT run the script yet**

`npm run seed` creates real `auth.users`/`profiles`/`requests` rows against whatever Supabase project `.env.local` points at. That's a state-changing action against a live (possibly shared) database — get explicit confirmation for which environment to seed before running it. Running the script and manually verifying `/admin`/`/admin/reports` against real seeded data is the last item of the "Testes" section's manual checklist, handled after this task is committed and reviewed, not as part of this task's automated verification.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-demo-data.ts
git commit -m "feat: add demo data seed script for the admin analytics dashboard"
```

---

## Manual checklist (after all tasks are committed)

Per the spec's "Testes" section, this replaces a missing component-test setup:

1. Confirm with the user which Supabase project `.env.local` points at, then run `npm run seed`.
2. Open `/admin` — confirm stat cards, spend chart, out-of-policy panel, and the three breakdown charts render with the seeded numbers (spot-check one KPI, e.g. compliance rate, by counting manually against the seed's ~25% non-compliant rate).
3. Open `/admin/reports` — confirm the ranking table sorts by both columns, and that clicking a row renders `EmployeeDetail` with that employee's own spend chart and out-of-policy list.
4. Confirm the empty-state path: temporarily point at an organization with zero `requests` (or filter one manually) and confirm both pages show `EmptyState` instead of crashing.
5. Run `npm run build`, `npm run lint`, and `npm run test` one final time on the full branch.
