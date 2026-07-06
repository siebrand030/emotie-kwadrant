import type { Database, DailyPlan } from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor `daily_plans`. Het bestaan van een rij voor een datum
 * markeert dat de dagplanning voor die dag is gestart — dat stuurt de
 * auto-redirect naar /planner op de startpagina (zie app/page.tsx).
 */

type Supabase = ReturnType<typeof createClient>;

// Zie lib/plan-items.ts voor de reden achter deze type-cast.
type TypedClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;
const typed = (supabase: Supabase): TypedClient =>
  supabase as unknown as TypedClient;

/** Haalt de dagplanning voor een datum op, of `null` als die nog niet bestaat. */
export async function findDailyPlan(
  supabase: Supabase,
  date: string,
): Promise<DailyPlan | null> {
  const { data, error } = await typed(supabase)
    .from("daily_plans")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Haalt de dagplanning voor een datum op, of maakt er één aan als die nog
 * niet bestaat. Idempotent bij gelijktijdige aanroepen dankzij de
 * unique-constraint op (user_id, date): bij een conflict wordt de bestaande
 * rij opnieuw opgehaald.
 */
export async function getOrCreateDailyPlan(
  supabase: Supabase,
  userId: string,
  date: string,
): Promise<DailyPlan> {
  const existing = await findDailyPlan(supabase, date);
  if (existing) return existing;

  const { data, error } = await typed(supabase)
    .from("daily_plans")
    .insert({ user_id: userId, date })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const retried = await findDailyPlan(supabase, date);
      if (retried) return retried;
    }
    throw error;
  }
  return data;
}
