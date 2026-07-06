import type { Insight } from "@/lib/habits";

interface HabitInsightProps {
  insight: Insight;
}

/** Precies één inzicht op het afsluitscherm na de check-in + habits-flow (zie
 * feature-spec §6). Geen inzicht (geen data) toont een neutrale placeholder. */
export function HabitInsight({ insight }: HabitInsightProps) {
  if (!insight) {
    return (
      <p className="text-center text-[14px] text-[#6C7377]">
        Nog geen habit-data om te tonen.
      </p>
    );
  }

  if (insight.kind === "metric") {
    const delta =
      insight.previous === null ? null : insight.value - insight.previous;
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[22px] font-medium text-[#E9EBEA]">
          {insight.habit.metric_label ?? insight.habit.name}: {insight.value}
        </span>
        <span className="font-plex-mono text-[12.5px] text-[#8A9094]">
          {insight.previous === null
            ? "eerste meting"
            : `vorige keer ${insight.previous}${
                delta !== null && delta !== 0
                  ? ` (${delta > 0 ? "+" : ""}${delta})`
                  : ""
              }`}
        </span>
      </div>
    );
  }

  if (insight.kind === "daily") {
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[22px] font-medium text-[#E9EBEA]">
          {insight.habit.name}
        </span>
        <span className="font-plex-mono text-[12.5px] text-[#8A9094]">
          {insight.done} van de laatste {insight.total} dagen
        </span>
      </div>
    );
  }

  const met = insight.done >= insight.target;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-[22px] font-medium text-[#E9EBEA]">
        {insight.habit.name}
      </span>
      <span
        className={`font-plex-mono text-[12.5px] ${met ? "text-[#8FBF8A]" : "text-[#8A9094]"}`}
      >
        {insight.done} van {insight.target} deze week
        {met ? " · doel gehaald" : ""}
      </span>
    </div>
  );
}
