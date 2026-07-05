import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchCheckins } from "@/lib/checkins";
import { EmotionLogger } from "@/components/logger/emotion-logger";
import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * Home = het incheck-scherm ("nu"): de emotie-logger uit legacy/, nu op
 * Supabase. Beschermde route; we halen de check-ins server-side op en geven ze
 * mee aan de client-logger, die de flow + opslag afhandelt.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/");

  const checkins = await fetchCheckins(supabase);

  return (
    <main className="font-plex relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#0B0C0D] text-[#E9EBEA]">
      <EmotionLogger userId={user.id} initialCheckins={checkins} />
      <BottomNav />
    </main>
  );
}
