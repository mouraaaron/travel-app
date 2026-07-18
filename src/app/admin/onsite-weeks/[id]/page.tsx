import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnsiteWeek } from "@/lib/onsite-weeks";
import { OnsiteWeekDetail, type RequestCost } from "@/components/admin/onsite-week-detail";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function OnsiteWeekDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("onsite_weeks").select("*").eq("id", params.id).single();

  if (!row) {
    return (
      <NotFoundState
        title="Semana presencial não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/admin/onsite-weeks"
        backLabel="Semanas Presenciais"
      />
    );
  }

  const { data: requestRows } = await supabase
    .from("requests")
    .select("id, total_amount, total_currency")
    .eq("onsite_week_id", params.id);

  const requestCosts: Record<string, RequestCost> = {};
  for (const request of requestRows ?? []) {
    requestCosts[request.id] = { amount: request.total_amount, currency: request.total_currency };
  }

  return <OnsiteWeekDetail onsiteWeek={row as OnsiteWeek} requestCosts={requestCosts} />;
}
