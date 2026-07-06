import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveHabits,
  fetchHabitLogs,
  fetchHabitMetricsForHabits,
  lastNDays,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/habits";
import { HabitsToday } from "@/components/habits/habits-today";
import { HabitsWeekOverview } from "@/components/habits/habits-week-overview";
import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * /habits — secundaire toegang tot "Habits vandaag" (los van de check-in
 * flow), plus het weekoverzicht (dots, metric-grafiek, skip-redenen).
 */
export default async function HabitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/habits");

  const today = new Date();
  // Venster dat de laatste 7 dagen, deze week én de huidige kalendermaand dekt
  // (nodig voor resp. daily-consistentie, weekly_count-voortgang en de
  // skip-redenen-aggregatie in het weekoverzicht).
  const rangeStart = [startOfMonth(today), startOfWeek(today), lastNDays(7, today)[0]].sort()[0];

  const [habits, habitLogs] = await Promise.all([
    fetchActiveHabits(supabase),
    fetchHabitLogs(supabase, rangeStart, toDateKey(today)),
  ]);
  const metricHabitIds = habits.filter((h) => h.track_metric).map((h) => h.id);
  const habitMetrics = await fetchHabitMetricsForHabits(supabase, metricHabitIds);

  return (
    <main className="font-plex mx-auto flex min-h-dvh max-w-md flex-col bg-[#0B0C0D] text-[#E9EBEA]">
      <div className="flex flex-1 flex-col items-center gap-9 px-[22px] pt-[34px] pb-6">
        <div className="flex w-full max-w-[340px] flex-col items-center gap-9">
          <div className="w-full">
            <h1 className="font-plex-mono mb-5 text-[11.5px] text-[#565C60]">
              habits vandaag
            </h1>
            <HabitsToday
              userId={user.id}
              habits={habits}
              initialLogs={habitLogs}
              initialMetrics={habitMetrics}
            />
          </div>
          <div className="w-full">
            <h2 className="font-plex-mono mb-5 text-[11.5px] text-[#565C60]">
              weekoverzicht
            </h2>
            <HabitsWeekOverview habits={habits} logs={habitLogs} metrics={habitMetrics} />
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
