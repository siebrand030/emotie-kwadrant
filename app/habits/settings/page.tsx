import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllHabits } from "@/lib/habits";
import { HabitSettingsScreen } from "@/components/habits/habit-settings-screen";
import { BottomNav } from "@/components/nav/bottom-nav";

/** /habits/settings — habits aanmaken, bewerken en (de)activeren (fase 3). */
export default async function HabitSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/habits/settings");

  const habits = await fetchAllHabits(supabase);

  return (
    <main className="font-plex mx-auto flex min-h-dvh max-w-md flex-col bg-[#0B0C0D] text-[#E9EBEA]">
      <div className="flex flex-1 flex-col items-center px-[22px] pt-[34px] pb-6">
        <div className="mb-5 flex w-full max-w-[340px] items-center justify-between">
          <h1 className="font-plex-mono text-[11.5px] text-[#565C60]">habits beheren</h1>
          <Link href="/habits" className="font-plex-mono text-[11.5px] text-[#6C7377]">
            ‹ terug
          </Link>
        </div>
        <HabitSettingsScreen userId={user.id} initialHabits={habits} />
      </div>
      <BottomNav />
    </main>
  );
}
