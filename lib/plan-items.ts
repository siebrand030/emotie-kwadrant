import type { Database, PlanItem } from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor `plan_items`: braindump- (`status: 'unscheduled'`) en
 * tijdlijn-items (`status: 'scheduled'`) van één daily_plan.
 */

type Supabase = ReturnType<typeof createClient>;

// @supabase/ssr@0.5 en @supabase/supabase-js@2.110 hebben een incompatibele
// generic-layout, waardoor de ssr-client zijn tabeltypen op .from() verliest.
// We casten daarom binnen de datalaag naar een correct-getypte client (zoals
// supabase-js die zelf construeert). Dit is puur een type-cast — de
// runtime-client blijft ongewijzigd.
type TypedClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;
const typed = (supabase: Supabase): TypedClient =>
  supabase as unknown as TypedClient;

/** Velden voor het inplannen van een item op de tijdlijn. */
export interface ScheduleInput {
  planned_start_time: string; // HH:MM
  planned_duration_minutes: number;
}

/** Alle items van een daily_plan, braindump-volgorde eerst. */
export async function fetchPlanItems(
  supabase: Supabase,
  dailyPlanId: string,
): Promise<PlanItem[]> {
  const { data, error } = await typed(supabase)
    .from("plan_items")
    .select("*")
    .eq("daily_plan_id", dailyPlanId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Nieuw braindump-item (nog niet ingepland). Altijd source 'planned'. */
export async function createBraindumpItem(
  supabase: Supabase,
  userId: string,
  dailyPlanId: string,
  title: string,
  sortOrder: number,
): Promise<PlanItem> {
  const { data, error } = await typed(supabase)
    .from("plan_items")
    .insert({
      user_id: userId,
      daily_plan_id: dailyPlanId,
      title,
      status: "unscheduled",
      source: "planned",
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Nieuw, meteen ingepland item (tik-op-tijdstip-om-aan-te-maken). Altijd
 * source 'adhoc' — het komt niet uit de braindump-planning.
 */
export async function createScheduledItem(
  supabase: Supabase,
  userId: string,
  dailyPlanId: string,
  input: {
    title: string;
    notes: string | null;
    planned_start_time: string;
    planned_duration_minutes: number;
  },
): Promise<PlanItem> {
  const { data, error } = await typed(supabase)
    .from("plan_items")
    .insert({
      user_id: userId,
      daily_plan_id: dailyPlanId,
      status: "scheduled",
      source: "adhoc",
      ...input,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Plant een braindump-item in op de tijdlijn (status → scheduled). */
export async function scheduleItem(
  supabase: Supabase,
  id: string,
  input: ScheduleInput,
): Promise<PlanItem> {
  const { data, error } = await typed(supabase)
    .from("plan_items")
    .update({ status: "scheduled", ...input })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Verplaatst en/of herduurt een al ingepland item. */
export async function updateScheduledItem(
  supabase: Supabase,
  id: string,
  input: Partial<ScheduleInput>,
): Promise<void> {
  const { error } = await typed(supabase)
    .from("plan_items")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

/** Haalt een ingepland item terug naar de braindump-lijst (unscheduled). */
export async function unscheduleItem(
  supabase: Supabase,
  id: string,
): Promise<void> {
  const { error } = await typed(supabase)
    .from("plan_items")
    .update({
      status: "unscheduled",
      planned_start_time: null,
      planned_duration_minutes: null,
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Verplaatst een item (braindump of ingepland) naar een andere daily_plan
 * (bijv. "naar morgen verplaatsen"). Komt terecht in de braindump-lijst van
 * die dag: tijd/duur worden gewist, status → unscheduled.
 */
export async function moveItemToPlan(
  supabase: Supabase,
  id: string,
  targetDailyPlanId: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await typed(supabase)
    .from("plan_items")
    .update({
      daily_plan_id: targetDailyPlanId,
      status: "unscheduled",
      planned_start_time: null,
      planned_duration_minutes: null,
      sort_order: sortOrder,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Werkt titel en/of notitie van een item bij. */
export async function updatePlanItemDetails(
  supabase: Supabase,
  id: string,
  input: { title?: string; notes?: string | null },
): Promise<void> {
  const { error } = await typed(supabase)
    .from("plan_items")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

/** Vinkt een item af of uit. */
export async function setPlanItemCompleted(
  supabase: Supabase,
  id: string,
  completed: boolean,
): Promise<void> {
  const { error } = await typed(supabase)
    .from("plan_items")
    .update({ completed })
    .eq("id", id);
  if (error) throw error;
}

/** Verwijdert een plan-item. */
export async function deletePlanItem(
  supabase: Supabase,
  id: string,
): Promise<void> {
  const { error } = await typed(supabase).from("plan_items").delete().eq("id", id);
  if (error) throw error;
}
