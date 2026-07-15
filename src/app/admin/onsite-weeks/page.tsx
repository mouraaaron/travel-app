import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { OnsiteWeeksList } from "@/components/admin/onsite-weeks-list";

export default async function AdminOnsiteWeeksPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("onsite_weeks")
    .select("*")
    .order("created_at", { ascending: false });

  const onsiteWeeks = ((rows ?? []) as OnsiteWeekRow[]).map(toOnsiteWeek);

  return <OnsiteWeeksList onsiteWeeks={onsiteWeeks} />;
}
