import type {
  Checkin,
  CheckinInsert,
  Database,
  FactorKey,
  Quadrant,
} from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor de emotie-logger. Werkt op de `checkins`-tabel. RLS filtert op
 * de ingelogde gebruiker; user_id is alleen nodig bij insert.
 */

// De app gebruikt @supabase/ssr-clients (browser + server, zelfde vorm).
type Supabase = ReturnType<typeof createClient>;

// Zelfde cast als lib/tasks.ts: @supabase/ssr@0.5 en @supabase/supabase-js@2.110
// hebben een generic-mismatch waardoor .from() zijn tabeltypen verliest. We
// casten binnen de datalaag naar een correct-getypte client. Puur type-niveau.
type TypedClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;
const typed = (supabase: Supabase): TypedClient =>
  supabase as unknown as TypedClient;

/** Factoren als domein-object; wordt gemapt naar de factor_<key>-kolommen. */
export type FactorValues = Record<FactorKey, number | null>;

/** Velden voor het aanmaken van een check-in. */
export interface CheckinInput {
  quadrant: Quadrant;
  emotion: string;
  logged_at: string; // ISO
  factors: FactorValues;
  note: string | null;
}

/** factoren-object → factor_<key>-kolommen. */
function factorColumns(factors: FactorValues) {
  return {
    factor_slaap: factors.slaap,
    factor_stress: factors.stress,
    factor_eten: factors.eten,
    factor_wiet: factors.wiet,
    factor_alcohol: factors.alcohol,
    factor_planning: factors.planning,
  };
}

/** Alle check-ins van de gebruiker, nieuwste eerst. */
export async function fetchCheckins(supabase: Supabase): Promise<Checkin[]> {
  const { data, error } = await typed(supabase)
    .from("checkins")
    .select("*")
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Nieuwe check-in. */
export async function createCheckin(
  supabase: Supabase,
  userId: string,
  input: CheckinInput,
): Promise<Checkin> {
  const row: CheckinInsert & { user_id: string } = {
    user_id: userId,
    quadrant: input.quadrant,
    emotion: input.emotion,
    logged_at: input.logged_at,
    note: input.note,
    ...factorColumns(input.factors),
  };
  const { data, error } = await typed(supabase)
    .from("checkins")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Werkt factoren + notitie van een bestaande check-in bij. Gebruikt wanneer je
 * binnen dezelfde flow terug/vooruit navigeert (zoals legacy's savedId), zodat
 * dezelfde rij wordt bijgewerkt i.p.v. dubbel gelogd.
 */
export async function updateCheckin(
  supabase: Supabase,
  id: string,
  patch: { factors: FactorValues; note: string | null },
): Promise<Checkin> {
  const { data, error } = await typed(supabase)
    .from("checkins")
    .update({ note: patch.note, ...factorColumns(patch.factors) })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
