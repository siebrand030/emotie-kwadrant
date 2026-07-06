import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveHabits,
  fetchHabitLogs,
  lastNDays,
  startOfWeek,
  toDateKey,
} from "@/lib/habits";
import { HabitsToday } from "@/components/habits/habits-today";
import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * /habits — secundaire toegang tot "Habits vandaag" (los van de check-in
 * flow), bijv. om later op de dag alsnog een habit af te vinken.
 */
export default async function HabitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/habits");

  const today = new Date();
  const rangeStart = [startOfWeek(today), lastNDays(7, today)[0]].sort()[0];

  const [habits, habitLogs] = await Promise.all([
    fetchActiveHabits(supabase),
    fetchHabitLogs(supabase, rangeStart, toDateKey(today)),
  ]);

  return (
    <main className="font-plex mx-auto flex min-h-dvh max-w-md flex-col bg-[#0B0C0D] text-[#E9EBEA]">
      <div className="flex flex-1 flex-col items-center px-[22px] pt-[34px] pb-6">
        <h1 className="font-plex-mono mb-5 self-start text-[11.5px] text-[#565C60]">
          habits vandaag
        </h1>
        <HabitsToday userId={user.id} habits={habits} initialLogs={habitLogs} />
      </div>
      <BottomNav />
    </main>
  );
}
