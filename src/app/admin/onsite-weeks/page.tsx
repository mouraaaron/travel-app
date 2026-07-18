import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnsiteWeek } from "@/lib/onsite-weeks";
import { OnsiteWeeksList } from "@/components/admin/onsite-weeks-list";

export default async function AdminOnsiteWeeksPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("onsite_weeks")
    .select("*")
    .order("created_at", { ascending: false });

  const onsiteWeeks = (rows ?? []) as OnsiteWeek[];

  return <OnsiteWeeksList onsiteWeeks={onsiteWeeks} />;
}
