import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/daily-plans";
import { fetchPlanItems } from "@/lib/plan-items";
import { fetchInboxItems } from "@/lib/inbox";
import { isoDate } from "@/lib/planner-time";
import { PlannerApp } from "@/components/planner/planner-app";

/**
 * /planner — de dagplanner (braindump + tijdlijn + inbox-strook). Beschermd
 * via middleware. Het eerste bezoek van de dag maakt meteen de daily_plan-rij
 * aan: dat markeert "vandaag is de dagplanning gestart" voor de auto-redirect
 * op de startpagina (zie app/page.tsx).
 */
export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/planner");

  const today = isoDate(new Date());
  const dailyPlan = await getOrCreateDailyPlan(supabase, user.id, today);

  const [planItems, inboxItems] = await Promise.all([
    fetchPlanItems(supabase, dailyPlan.id),
    fetchInboxItems(supabase),
  ]);

  return (
    <PlannerApp
      userId={user.id}
      dailyPlan={dailyPlan}
      initialPlanItems={planItems}
      initialInboxItems={inboxItems}
    />
  );
}
