"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitLog, HabitMetric, SkipReason } from "@/lib/supabase/types";
import {
  createHabitMetric,
  dailyConsistency,
  lastNDays,
  shouldPromptMetric,
  startOfWeek,
  toDateKey,
  upsertHabitLog,
  weeklyProgress,
} from "@/lib/habits";
import { HabitCard } from "./habit-card";
import { SkipReasonSheet } from "./skip-reason-sheet";
import { MetricPromptSheet } from "./metric-prompt-sheet";

interface HabitsTodayProps {
  userId: string;
  habits: Habit[];
  /** Logs over een venster dat zowel de laatste 7 dagen (daily-consistentie)
   * als deze week (weekly_count-voortgang) dekt — zie fetch in de pagina. */
  initialLogs: HabitLog[];
  /** Recente metingen van track_metric-habits, voor de metric-prompt-check. */
  initialMetrics?: HabitMetric[];
  /** Aanwezig wanneer dit scherm de vervolgstap is op de check-in flow; toont
   * een "klaar"-knop die de hele flow afsluit. */
  onDone?: () => void;
  /** Geeft de actuele logs/metrics terug aan de aanroeper — nodig wanneer een
   * volgende stap (zoals het afsluit-inzicht) erop moet kunnen rekenen. */
  onLogsChange?: (logs: HabitLog[]) => void;
  onMetricsChange?: (metrics: HabitMetric[]) => void;
}

/** "Habits vandaag" — kern van de habits-module. Wordt zowel getoond als
 * vervolgstap op de check-in (components/logger/emotion-logger.tsx) als via
 * de aparte "habits"-navigatietab (app/habits/page.tsx). */
export function HabitsToday({
  userId,
  habits,
  initialLogs,
  initialMetrics = [],
  onDone,
  onLogsChange,
  onMetricsChange,
}: HabitsTodayProps) {
  const supabase = useMemo(() => createClient(), []);
  const [logs, setLogs] = useState<HabitLog[]>(initialLogs);
  const [metrics, setMetrics] = useState<HabitMetric[]>(initialMetrics);
  const [skipTarget, setSkipTarget] = useState<Habit | null>(null);
  const [metricTarget, setMetricTarget] = useState<Habit | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const today = toDateKey(new Date());
  const weekStart = startOfWeek(new Date());
  const last7 = lastNDays(7);

  const todayLogByHabit = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const l of logs) {
      if (l.log_date === today) map.set(l.habit_id, l);
    }
    return map;
  }, [logs, today]);

  async function applyLog(
    habit: Habit,
    status: "done" | "skipped",
    skipReason?: SkipReason | null,
    note?: string | null,
  ) {
    setPending(habit.id);
    try {
      const row = await upsertHabitLog(supabase, userId, {
        habitId: habit.id,
        logDate: today,
        status,
        skipReason,
        note,
      });
      const nextLogs = [
        ...logs.filter((l) => !(l.habit_id === habit.id && l.log_date === today)),
        row,
      ];
      setLogs(nextLogs);
      onLogsChange?.(nextLogs);
      setEditingTarget(null);

      if (status === "done" && shouldPromptMetric(habit, metrics)) {
        setMetricTarget(habit);
      }
    } catch (e) {
      console.error("Habit-log opslaan mislukt:", e);
    } finally {
      setPending(null);
    }
  }

  async function submitMetric(habit: Habit, value: number) {
    try {
      const row = await createHabitMetric(supabase, userId, {
        habitId: habit.id,
        measuredOn: today,
        value,
      });
      const nextMetrics = [...metrics, row];
      setMetrics(nextMetrics);
      onMetricsChange?.(nextMetrics);
    } catch (e) {
      console.error("Metric opslaan mislukt:", e);
    } finally {
      setMetricTarget(null);
    }
  }

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3">
      {habits.map((habit) => {
        const log = editingTarget === habit.id ? undefined : todayLogByHabit.get(habit.id);
        const context =
          habit.schedule_type === "daily"
            ? dailyConsistency(logs, habit.id, last7)
            : {
                done: weeklyProgress(logs, habit.id, weekStart),
                total: habit.weekly_target ?? 0,
              };
        return (
          <HabitCard
            key={habit.id}
            habit={habit}
            log={log}
            context={context}
            pending={pending === habit.id}
            onDone={() => applyLog(habit, "done")}
            onSkip={() => setSkipTarget(habit)}
            onOverslaan={() => applyLog(habit, "skipped", "niet_van_toepassing")}
            onEditNote={(note) => {
              const existing = todayLogByHabit.get(habit.id);
              if (existing?.status === "done") applyLog(habit, "done", null, note);
            }}
            onChangeStatus={() => setEditingTarget(habit.id)}
          />
        );
      })}

      {onDone && (
        <button
          onClick={onDone}
          className="font-plex-mono mt-2 self-center rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px] text-[#E9EBEA]"
        >
          klaar
        </button>
      )}

      {skipTarget && (
        <SkipReasonSheet
          habit={skipTarget}
          onClose={() => setSkipTarget(null)}
          onSubmit={(reason, note) => {
            void applyLog(skipTarget, "skipped", reason, note);
            setSkipTarget(null);
          }}
        />
      )}

      {metricTarget && (
        <MetricPromptSheet
          habit={metricTarget}
          onClose={() => setMetricTarget(null)}
          onSubmit={(value) => void submitMetric(metricTarget, value)}
        />
      )}
    </div>
  );
}
