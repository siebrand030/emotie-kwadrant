import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTasks } from "@/lib/tasks";
import { PlannerApp } from "@/components/planner/planner-app";

/**
 * /planner — de dagplanner (tijdlijn + inbox). Beschermd via middleware; we
 * halen de taken server-side op en geven ze mee aan de client-app, die de
 * mutaties optimistisch afhandelt.
 */
export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/planner");

  const tasks = await fetchTasks(supabase);

  return <PlannerApp userId={user.id} initialTasks={tasks} />;
}
