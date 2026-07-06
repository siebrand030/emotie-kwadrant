import type {
  Database,
  Habit,
  HabitLog,
  HabitLogStatus,
  HabitMetric,
  SkipReason,
} from "./supabase/types";
import type { createClient } from "./supabase/client";

/**
 * Datalaag voor de habits-module. Werkt op `habits`, `habit_logs` en
 * `habit_metrics`. RLS filtert op de ingelogde gebruiker; user_id is alleen
 * nodig bij insert.
 *
 * 'missed' bestaat niet als opgeslagen status: een dag zonder log voor een
 * dagelijkse habit telt achteraf als gemist. Dat wordt hier berekend bij
 * lezen (zie `isMissedDay` / consistentie-helpers), niet gematerialiseerd.
 */

type Supabase = ReturnType<typeof createClient>;

// Zelfde cast als lib/checkins.ts en lib/tasks.ts: @supabase/ssr@0.5 en
// @supabase/supabase-js@2.110 hebben een generic-mismatch waardoor .from()
// zijn tabeltypen verliest. We casten binnen de datalaag naar een
// correct-getypte client. Puur type-niveau.
type TypedClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;
const typed = (supabase: Supabase): TypedClient =>
  supabase as unknown as TypedClient;

/** Actieve habits van de gebruiker, in weergavevolgorde. */
export async function fetchActiveHabits(supabase: Supabase): Promise<Habit[]> {
  const { data, error } = await typed(supabase)
    .from("habits")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Alle habit-logs van de gebruiker binnen een datumbereik (inclusief). */
export async function fetchHabitLogs(
  supabase: Supabase,
  fromDate: string,
  toDate: string,
): Promise<HabitLog[]> {
  const { data, error } = await typed(supabase)
    .from("habit_logs")
    .select("*")
    .gte("log_date", fromDate)
    .lte("log_date", toDate);
  if (error) throw error;
  return data ?? [];
}

/** Legt een registratie vast (done/skipped) voor een habit op een dag.
 * Bestaat er al een log voor die dag, dan wordt hij bijgewerkt (upsert op de
 * unique constraint (habit_id, log_date)) — dubbel afvinken overschrijft dus
 * de vorige status i.p.v. te falen. */
export async function upsertHabitLog(
  supabase: Supabase,
  userId: string,
  input: {
    habitId: string;
    logDate: string; // YYYY-MM-DD
    status: HabitLogStatus;
    skipReason?: SkipReason | null;
    note?: string | null;
  },
): Promise<HabitLog> {
  const { data, error } = await typed(supabase)
    .from("habit_logs")
    .upsert(
      {
        user_id: userId,
        habit_id: input.habitId,
        log_date: input.logDate,
        status: input.status,
        skip_reason: input.status === "skipped" ? (input.skipReason ?? null) : null,
        note: input.note ?? null,
      },
      { onConflict: "habit_id,log_date" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Nieuwe metric-meting (bijv. graden externe rotatie) voor een habit. */
export async function createHabitMetric(
  supabase: Supabase,
  userId: string,
  input: { habitId: string; measuredOn: string; value: number },
): Promise<HabitMetric> {
  const { data, error } = await typed(supabase)
    .from("habit_metrics")
    .insert({
      user_id: userId,
      habit_id: input.habitId,
      measured_on: input.measuredOn,
      value: input.value,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Metric-metingen voor een habit, oplopend op datum. */
export async function fetchHabitMetrics(
  supabase: Supabase,
  habitId: string,
): Promise<HabitMetric[]> {
  const { data, error } = await typed(supabase)
    .from("habit_metrics")
    .select("*")
    .eq("habit_id", habitId)
    .order("measured_on", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Metric-metingen voor meerdere habits ineens (bijv. alle track_metric-habits
 * van de gebruiker), oplopend op datum. */
export async function fetchHabitMetricsForHabits(
  supabase: Supabase,
  habitIds: string[],
): Promise<HabitMetric[]> {
  if (habitIds.length === 0) return [];
  const { data, error } = await typed(supabase)
    .from("habit_metrics")
    .select("*")
    .in("habit_id", habitIds)
    .order("measured_on", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---- Datumhelpers (lokale tijd, niet UTC — de gebruiker denkt in kalenderdagen) ----

/** YYYY-MM-DD voor een Date, in lokale tijd. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Maandag van de week waarin `date` valt, als YYYY-MM-DD. */
export function startOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = zondag
  const diff = day === 0 ? -6 : 1 - day; // terug naar maandag
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

/** Laatste N dagen als YYYY-MM-DD, inclusief vandaag, oudste eerst. */
export function lastNDays(n: number, today: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(toDateKey(d));
  }
  return days;
}

/** Consistentie van een dagelijkse habit: aantal 'done' in de laatste N dagen. */
export function dailyConsistency(
  logs: HabitLog[],
  habitId: string,
  days: string[],
): { done: number; total: number } {
  const daySet = new Set(days);
  const done = logs.filter(
    (l) => l.habit_id === habitId && l.status === "done" && daySet.has(l.log_date),
  ).length;
  return { done, total: days.length };
}

/** Weekvoortgang van een weekly_count habit: aantal 'done' sinds maandag. */
export function weeklyProgress(
  logs: HabitLog[],
  habitId: string,
  weekStart: string,
): number {
  return logs.filter(
    (l) => l.habit_id === habitId && l.status === "done" && l.log_date >= weekStart,
  ).length;
}

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  geen_tijd: "geen tijd",
  vergeten: "vergeten",
  pijn_of_moe: "pijn of moe",
  geen_zin: "geen zin",
  niet_van_toepassing: "niet van toepassing",
  anders: "anders",
};

// ---- Fase 2: metric-prompt, afsluit-inzicht, weekoverzicht ----

/** Is het tijd om de gebruiker (na het afvinken van een track_metric-habit)
 * om een nieuwe meting te vragen? Ja als er nog nooit gemeten is, of als de
 * laatste meting langer geleden is dan `metric_prompt_interval_days`. */
export function shouldPromptMetric(
  habit: Habit,
  metrics: HabitMetric[],
  today: Date = new Date(),
): boolean {
  if (!habit.track_metric) return false;
  const habitMetrics = metrics.filter((m) => m.habit_id === habit.id);
  if (habitMetrics.length === 0) return true;
  const lastMeasuredOn = habitMetrics.reduce(
    (latest, m) => (m.measured_on > latest ? m.measured_on : latest),
    habitMetrics[0].measured_on,
  );
  const lastDate = new Date(`${lastMeasuredOn}T00:00:00`);
  const diffDays = Math.round(
    (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= habit.metric_prompt_interval_days;
}

export type Insight =
  | { kind: "metric"; habit: Habit; value: number; previous: number | null }
  | { kind: "daily"; habit: Habit; done: number; total: number }
  | { kind: "weekly"; habit: Habit; done: number; target: number }
  | null;

/**
 * Selecteert precies één inzicht voor het afsluitscherm, op prioriteit (zie
 * feature-spec §6):
 *   1. Vandaag een metric gelogd → verandering t.o.v. de vorige meting
 *   2. Anders → consistentie van de (eerste) dagelijkse habit
 *   3. Anders → weekvoortgang van de (eerste) weekly_count-habit
 */
export function pickInsight(
  habits: Habit[],
  logs: HabitLog[],
  metrics: HabitMetric[],
  today: Date = new Date(),
): Insight {
  const todayKey = toDateKey(today);

  for (const habit of habits) {
    if (!habit.track_metric) continue;
    const habitMetrics = metrics
      .filter((m) => m.habit_id === habit.id)
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on));
    const todays = habitMetrics.filter((m) => m.measured_on === todayKey);
    if (todays.length === 0) continue;
    const value = todays[todays.length - 1].value;
    const earlier = habitMetrics.filter((m) => m.measured_on < todayKey);
    const previous = earlier.length ? earlier[earlier.length - 1].value : null;
    return { kind: "metric", habit, value, previous };
  }

  const dailyHabit = habits.find((h) => h.schedule_type === "daily");
  if (dailyHabit) {
    const { done, total } = dailyConsistency(logs, dailyHabit.id, lastNDays(7, today));
    return { kind: "daily", habit: dailyHabit, done, total };
  }

  const weeklyHabit = habits.find((h) => h.schedule_type === "weekly_count");
  if (weeklyHabit) {
    const done = weeklyProgress(logs, weeklyHabit.id, startOfWeek(today));
    return { kind: "weekly", habit: weeklyHabit, done, target: weeklyHabit.weekly_target ?? 0 };
  }

  return null;
}

export type DotStatus = "done" | "skipped" | "empty";

/** Status per dag voor het weekoverzicht (dots), oudste eerst. */
export function weekDotStatuses(
  logs: HabitLog[],
  habitId: string,
  days: string[],
): DotStatus[] {
  return days.map((day) => {
    const log = logs.find((l) => l.habit_id === habitId && l.log_date === day);
    return log ? log.status : "empty";
  });
}

/** Geaggregeerde skip-redenen (exclusief bewust "overslaan"), meest
 * voorkomende eerst — input voor latere patroonanalyse (§6). */
export function aggregateSkipReasons(
  logs: HabitLog[],
  sinceDate: string,
): { reason: SkipReason; count: number }[] {
  const counts = new Map<SkipReason, number>();
  for (const l of logs) {
    if (l.status !== "skipped") continue;
    if (l.log_date < sinceDate) continue;
    if (!l.skip_reason || l.skip_reason === "niet_van_toepassing") continue;
    counts.set(l.skip_reason, (counts.get(l.skip_reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/** Eerste dag (YYYY-MM-DD) van de kalendermaand waarin `date` valt. */
export function startOfMonth(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}
