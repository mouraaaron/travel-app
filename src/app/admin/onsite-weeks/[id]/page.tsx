import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { OnsiteWeekDetail } from "@/components/admin/onsite-week-detail";
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

  return <OnsiteWeekDetail onsiteWeek={toOnsiteWeek(row as OnsiteWeekRow)} />;
}
