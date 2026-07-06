"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit } from "@/lib/supabase/types";
import { createHabit, setHabitActive, updateHabit } from "@/lib/habits";
import { HabitSheet, type HabitSheetState } from "./habit-sheet";

interface HabitSettingsScreenProps {
  userId: string;
  initialHabits: Habit[];
}

const emptySheet = (): HabitSheetState => ({
  mode: "create",
  habitId: null,
  name: "",
  description: "",
  scheduleType: "daily",
  weeklyTarget: 2,
  trackMetric: false,
  metricLabel: "",
  metricPromptIntervalDays: 7,
});

const sheetFromHabit = (habit: Habit): HabitSheetState => ({
  mode: "edit",
  habitId: habit.id,
  name: habit.name,
  description: habit.description ?? "",
  scheduleType: habit.schedule_type,
  weeklyTarget: habit.weekly_target ?? 2,
  trackMetric: habit.track_metric,
  metricLabel: habit.metric_label ?? "",
  metricPromptIntervalDays: habit.metric_prompt_interval_days,
});

/** Habits aanmaken, bewerken en (de)activeren. Simpel gehouden — geen
 * volgorde-drag, geen verwijderen (alleen deactiveren, zodat historische
 * logs/metrics behouden blijven, zie feature-spec §8). */
export function HabitSettingsScreen({ userId, initialHabits }: HabitSettingsScreenProps) {
  const supabase = useMemo(() => createClient(), []);
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [sheet, setSheet] = useState<HabitSheetState | null>(null);
  const [saving, setSaving] = useState(false);

  const active = habits.filter((h) => h.is_active);
  const inactive = habits.filter((h) => !h.is_active);

  async function save() {
    if (!sheet || !sheet.name.trim()) return;
    setSaving(true);
    try {
      const input = {
        name: sheet.name.trim(),
        description: sheet.description.trim() || null,
        schedule_type: sheet.scheduleType,
        weekly_target: sheet.scheduleType === "weekly_count" ? sheet.weeklyTarget : null,
        track_metric: sheet.trackMetric,
        metric_label: sheet.trackMetric ? sheet.metricLabel.trim() || null : null,
        metric_prompt_interval_days: sheet.metricPromptIntervalDays,
      };
      if (sheet.mode === "edit" && sheet.habitId) {
        const row = await updateHabit(supabase, sheet.habitId, input);
        setHabits((cur) => cur.map((h) => (h.id === row.id ? row : h)));
      } else {
        const row = await createHabit(supabase, userId, {
          ...input,
          sort_order: habits.length,
        });
        setHabits((cur) => [...cur, row]);
      }
      setSheet(null);
    } catch (e) {
      console.error("Habit opslaan mislukt:", e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(habit: Habit) {
    const nextActive = !habit.is_active;
    setHabits((cur) =>
      cur.map((h) => (h.id === habit.id ? { ...h, is_active: nextActive } : h)),
    );
    try {
      await setHabitActive(supabase, habit.id, nextActive);
    } catch (e) {
      console.error("Habit (de)activeren mislukt:", e);
      setHabits((cur) =>
        cur.map((h) => (h.id === habit.id ? { ...h, is_active: habit.is_active } : h)),
      );
    }
  }

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        {active.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            onEdit={() => setSheet(sheetFromHabit(habit))}
            onToggle={() => toggleActive(habit)}
          />
        ))}
        <button
          onClick={() => setSheet(emptySheet())}
          className="font-plex-mono mt-1 rounded-2xl border border-dashed border-white/15 py-3 text-[13px] text-[#8A9094]"
        >
          + nieuwe habit
        </button>
      </div>

      {inactive.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-plex-mono text-[11px] text-[#565C60]">gedeactiveerd</span>
          {inactive.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onEdit={() => setSheet(sheetFromHabit(habit))}
              onToggle={() => toggleActive(habit)}
            />
          ))}
        </div>
      )}

      {sheet && (
        <HabitSheet
          sheet={sheet}
          onClose={() => !saving && setSheet(null)}
          onPatch={(patch) => setSheet((s) => (s ? { ...s, ...patch } : s))}
          onSave={save}
        />
      )}
    </div>
  );
}

function HabitRow({
  habit,
  onEdit,
  onToggle,
}: {
  habit: Habit;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <button onClick={onEdit} className="flex flex-1 flex-col items-start gap-0.5 text-left">
        <span className="text-[14px] font-medium text-[#E9EBEA]">{habit.name}</span>
        <span className="font-plex-mono text-[11px] text-[#6C7377]">
          {habit.schedule_type === "daily"
            ? "dagelijks"
            : `${habit.weekly_target ?? "?"}x per week`}
          {habit.track_metric ? " · meting" : ""}
        </span>
      </button>
      <button
        onClick={onToggle}
        className="font-plex-mono flex-none text-[11px] text-[#565C60]"
      >
        {habit.is_active ? "deactiveren" : "activeren"}
      </button>
    </div>
  );
}
