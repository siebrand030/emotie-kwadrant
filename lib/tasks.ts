import type { Database, Task, TaskColor } from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor de dagplanner. Werkt op de `tasks`-tabel; inbox en tijdlijn
 * delen die tabel via het `status`-veld (zie CLAUDE.md):
 *   - status 'inbox'     → ongepland (date/start_time null)
 *   - status 'scheduled' → ingepland (date + start_time gevuld)
 * Inplannen is dus een status-update naar 'scheduled', geen nieuwe rij.
 *
 * RLS filtert automatisch op de ingelogde gebruiker; user_id is alleen nodig
 * bij insert.
 */

// De app gebruikt @supabase/ssr-clients (browser + server, zelfde vorm).
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

/** Velden voor het aanmaken/bijwerken van een ingeplande taak. */
export interface ScheduledTaskInput {
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  duration_minutes: number;
  color: TaskColor;
  notes: string | null;
}

/** Alle taken van de gebruiker (inbox + ingepland), oplopend op starttijd. */
export async function fetchTasks(supabase: Supabase): Promise<Task[]> {
  const { data, error } = await typed(supabase)
    .from("tasks")
    .select("*")
    .order("start_time", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

/** Nieuwe ongeplande taak (inbox). */
export async function createInboxTask(
  supabase: Supabase,
  userId: string,
  title: string,
  color: TaskColor,
): Promise<Task> {
  const { data, error } = await typed(supabase)
    .from("tasks")
    .insert({ user_id: userId, title, status: "inbox", color })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Nieuwe ingeplande taak (tijdlijn). */
export async function createScheduledTask(
  supabase: Supabase,
  userId: string,
  input: ScheduledTaskInput,
): Promise<Task> {
  const { data, error } = await typed(supabase)
    .from("tasks")
    .insert({ user_id: userId, status: "scheduled", ...input })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Werkt een bestaande taak bij naar ingepland. Gebruikt zowel voor het
 * bewerken van een taak als voor het inplannen van een inbox-item (dezelfde
 * rij, status wordt 'scheduled').
 */
export async function scheduleTask(
  supabase: Supabase,
  id: string,
  input: ScheduledTaskInput,
): Promise<Task> {
  const { data, error } = await typed(supabase)
    .from("tasks")
    .update({ status: "scheduled", ...input })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Vinkt een taak af of uit. */
export async function setTaskCompleted(
  supabase: Supabase,
  id: string,
  completed: boolean,
): Promise<void> {
  const { error } = await typed(supabase)
    .from("tasks")
    .update({ completed })
    .eq("id", id);
  if (error) throw error;
}

/** Verwijdert een taak. */
export async function deleteTask(supabase: Supabase, id: string): Promise<void> {
  const { error } = await typed(supabase).from("tasks").delete().eq("id", id);
  if (error) throw error;
}
