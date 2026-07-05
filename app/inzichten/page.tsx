import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchCheckins } from "@/lib/checkins";
import { Insights } from "@/components/logger/insights";
import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * /inzichten — het inzichten-scherm van de emotie-logger (weekverdeling,
 * dagdelen, tijdlijn), afgeleid uit de check-ins. Beschermde route.
 */
export default async function InzichtenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/inzichten");

  const checkins = await fetchCheckins(supabase);

  return (
    <main className="font-plex mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#0B0C0D] text-[#E9EBEA]">
      <Insights checkins={checkins} />
      <BottomNav />
    </main>
  );
}
