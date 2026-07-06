"use client";

import type { HabitScheduleType } from "@/lib/supabase/types";

/** Concept-habit in de sheet. `habitId` gezet = bestaande rij bewerken; null =
 *  nieuwe habit. Simpel gehouden (§9 fase 3: "simpel houden"). */
export interface HabitSheetState {
  mode: "create" | "edit";
  habitId: string | null;
  name: string;
  description: string;
  scheduleType: HabitScheduleType;
  weeklyTarget: number;
  trackMetric: boolean;
  metricLabel: string;
  metricPromptIntervalDays: number;
}

interface HabitSheetProps {
  sheet: HabitSheetState;
  onClose: () => void;
  onPatch: (patch: Partial<HabitSheetState>) => void;
  onSave: () => void;
}

export function HabitSheet({ sheet, onClose, onPatch, onSave }: HabitSheetProps) {
  const canSave = sheet.name.trim().length > 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-20 flex flex-col justify-end bg-[rgba(4,5,6,0.55)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#15171A] px-5 pt-[18px] pb-[calc(env(safe-area-inset-bottom)+30px)]"
      >
        <input
          value={sheet.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Naam van de habit"
          autoFocus
          className="mb-4 w-full border-none bg-transparent p-0 text-xl font-medium text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
        />
        <input
          value={sheet.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="omschrijving (optioneel)"
          className="mb-5 w-full rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-[11px] text-[13px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
        />

        <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">schema</div>
        <div className="mb-5 flex gap-2">
          <button
            type="button"
            onClick={() => onPatch({ scheduleType: "daily" })}
            className={`font-plex-mono flex-1 rounded-2xl border px-3 py-2.5 text-[12.5px] ${
              sheet.scheduleType === "daily"
                ? "border-white/40 bg-white/[0.08] text-[#E9EBEA]"
                : "border-white/10 text-[#8A9094]"
            }`}
          >
            dagelijks
          </button>
          <button
            type="button"
            onClick={() => onPatch({ scheduleType: "weekly_count" })}
            className={`font-plex-mono flex-1 rounded-2xl border px-3 py-2.5 text-[12.5px] ${
              sheet.scheduleType === "weekly_count"
                ? "border-white/40 bg-white/[0.08] text-[#E9EBEA]"
                : "border-white/10 text-[#8A9094]"
            }`}
          >
            x per week
          </button>
        </div>

        {sheet.scheduleType === "weekly_count" && (
          <>
            <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">
              doel per week
            </div>
            <input
              type="number"
              min={1}
              value={sheet.weeklyTarget}
              onChange={(e) => onPatch({ weeklyTarget: Number(e.target.value) || 1 })}
              className="font-plex-mono mb-5 w-full rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-2.5 text-[13px] text-[#E9EBEA] outline-none"
            />
          </>
        )}

        <label className="mb-4 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={sheet.trackMetric}
            onChange={(e) => onPatch({ trackMetric: e.target.checked })}
            className="size-4 accent-[#8FBF8A]"
          />
          <span className="text-[13.5px] text-[#C6CACB]">
            periodieke meting (bijv. graden, gewicht)
          </span>
        </label>

        {sheet.trackMetric && (
          <>
            <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">
              label van de meting
            </div>
            <input
              value={sheet.metricLabel}
              onChange={(e) => onPatch({ metricLabel: e.target.value })}
              placeholder="bijv. Externe rotatie rechts (graden)"
              className="mb-5 w-full rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-[11px] text-[13px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
            />
            <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">
              vraag elke (dagen)
            </div>
            <input
              type="number"
              min={1}
              value={sheet.metricPromptIntervalDays}
              onChange={(e) =>
                onPatch({ metricPromptIntervalDays: Number(e.target.value) || 7 })
              }
              className="font-plex-mono mb-5 w-full rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-2.5 text-[13px] text-[#E9EBEA] outline-none"
            />
          </>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="h-[50px] w-full rounded-[14px] border-none bg-[#E9EBEA] text-sm font-medium text-[#0B0C0D] disabled:pointer-events-none disabled:opacity-35"
        >
          {sheet.mode === "edit" ? "Bijwerken" : "Habit aanmaken"}
        </button>
      </div>
    </div>
  );
}
