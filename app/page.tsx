import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchCheckins } from "@/lib/checkins";
import { findDailyPlan } from "@/lib/daily-plans";
import { isoDate } from "@/lib/planner-time";
import {
  fetchActiveHabits,
  fetchHabitLogs,
  fetchHabitMetricsForHabits,
  lastNDays,
  startOfWeek,
  toDateKey,
} from "@/lib/habits";
import { EmotionLogger } from "@/components/logger/emotion-logger";
import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * Home = het incheck-scherm ("nu"): de emotie-logger uit legacy/, nu op
 * Supabase. Beschermde route; we halen de check-ins server-side op en geven ze
 * mee aan de client-logger, die de flow + opslag afhandelt.
 *
 * Check-in is de drager van de habits-module: na de check-in flow toont
 * EmotionLogger het "Habits vandaag"-scherm, gevoed met dezelfde
 * server-side-opgehaalde habits + logs.
 *
 * Ochtendroutine: zolang er nog geen dagplanning voor vandaag bestaat,
 * verspringt dit scherm meteen naar /planner. Die rij wordt aangemaakt bij
 * het eerste bezoek aan /planner, dus deze redirect vervalt voor de rest van
 * de dag zodra de ochtendplanning gestart is.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/");

  const today = new Date();

  const dailyPlan = await findDailyPlan(supabase, isoDate(today));
  if (!dailyPlan) redirect("/planner");

  // Venster dat zowel de laatste 7 dagen (daily-consistentie) als deze week
  // sinds maandag (weekly_count-voortgang) dekt.
  const rangeStart = [startOfWeek(today), lastNDays(7, today)[0]].sort()[0];

  const [checkins, habits, habitLogs] = await Promise.all([
    fetchCheckins(supabase),
    fetchActiveHabits(supabase),
    fetchHabitLogs(supabase, rangeStart, toDateKey(today)),
  ]);
  const metricHabitIds = habits.filter((h) => h.track_metric).map((h) => h.id);
  const habitMetrics = await fetchHabitMetricsForHabits(supabase, metricHabitIds);

  return (
    <main className="font-plex relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#0B0C0D] text-[#E9EBEA]">
      <EmotionLogger
        userId={user.id}
        initialCheckins={checkins}
        habits={habits}
        habitLogs={habitLogs}
        habitMetrics={habitMetrics}
      />
      <BottomNav />
    </main>
  );
}
