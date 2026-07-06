import type { Database, InboxItem } from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor `inbox_items`: losse, datumloze gedachten. Los van de
 * dagplanning (`daily_plans`/`plan_items`) en de latere plan-vs-realiteit-
 * vergelijking.
 */

type Supabase = ReturnType<typeof createClient>;

// Zie lib/plan-items.ts voor de reden achter deze type-cast.
type TypedClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;
const typed = (supabase: Supabase): TypedClient =>
  supabase as unknown as TypedClient;

/** Alle inbox-items van de gebruiker, nieuwste eerst. */
export async function fetchInboxItems(supabase: Supabase): Promise<InboxItem[]> {
  const { data, error } = await typed(supabase)
    .from("inbox_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Nieuw inbox-item. */
export async function createInboxItem(
  supabase: Supabase,
  userId: string,
  content: string,
): Promise<InboxItem> {
  const { data, error } = await typed(supabase)
    .from("inbox_items")
    .insert({ user_id: userId, content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Verwijdert een inbox-item. */
export async function deleteInboxItem(
  supabase: Supabase,
  id: string,
): Promise<void> {
  const { error } = await typed(supabase).from("inbox_items").delete().eq("id", id);
  if (error) throw error;
}
