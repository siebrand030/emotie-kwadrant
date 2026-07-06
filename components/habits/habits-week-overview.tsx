import type { Habit, HabitLog, HabitMetric } from "@/lib/supabase/types";
import {
  SKIP_REASON_LABELS,
  aggregateSkipReasons,
  lastNDays,
  startOfMonth,
  weekDotStatuses,
} from "@/lib/habits";
import { HabitMetricChart } from "./habit-metric-chart";

interface HabitsWeekOverviewProps {
  habits: Habit[];
  logs: HabitLog[]; // minstens de laatste 7 dagen + huidige kalendermaand
  metrics: HabitMetric[];
}

const DOT_STYLE: Record<"done" | "skipped" | "empty", string> = {
  done: "bg-[#8FBF8A]",
  skipped: "bg-[#565C60]",
  empty: "border border-white/15",
};

/** Weekoverzicht: per habit de laatste 7 dagen als dots, plus voor
 * track_metric-habits de lijngrafiek en (globaal) de meest voorkomende
 * skip-reden deze maand (§6). */
export function HabitsWeekOverview({ habits, logs, metrics }: HabitsWeekOverviewProps) {
  const today = new Date();
  const last7 = lastNDays(7, today);
  const monthStart = startOfMonth(today);
  const skipReasons = aggregateSkipReasons(logs, monthStart);
  const topReason = skipReasons[0];

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-5">
      {habits.map((habit) => {
        const dots = weekDotStatuses(logs, habit.id, last7);
        return (
          <div key={habit.id} className="flex flex-col gap-2">
            <span className="text-[13.5px] font-medium text-[#E9EBEA]">{habit.name}</span>
            <div className="flex gap-2">
              {dots.map((status, i) => (
                <span
                  key={i}
                  className={`size-2.5 rounded-full ${DOT_STYLE[status]}`}
                  title={last7[i]}
                />
              ))}
            </div>
            {habit.track_metric && (
              <HabitMetricChart
                metrics={metrics.filter((m) => m.habit_id === habit.id)}
              />
            )}
          </div>
        );
      })}

      {topReason && (
        <p className="font-plex-mono text-[11.5px] text-[#6C7377]">
          Meest voorkomende reden bij niet gelukt:{" "}
          {SKIP_REASON_LABELS[topReason.reason]} ({topReason.count}x deze maand)
        </p>
      )}
    </div>
  );
}
