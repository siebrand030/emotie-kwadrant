"use client";

import { useState } from "react";
import type { Habit } from "@/lib/supabase/types";

interface MetricPromptSheetProps {
  habit: Habit;
  onClose: () => void;
  onSubmit: (value: number) => void;
}

/** Niet-blokkerende bottom sheet voor de periodieke metric-vraag (fysio:
 * graden externe rotatie). Wordt getoond na het afvinken van een
 * track_metric-habit, alleen wanneer het interval verstreken is (zie
 * shouldPromptMetric in lib/habits.ts). Weg te tikken zonder in te vullen. */
export function MetricPromptSheet({ habit, onClose, onSubmit }: MetricPromptSheetProps) {
  const [value, setValue] = useState("");
  const parsed = Number(value);
  const isValid = value.trim() !== "" && Number.isFinite(parsed);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-[#141516] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+22px)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-medium text-[#E9EBEA]">
            {habit.metric_label ?? "Meting"}
          </span>
          <button
            onClick={onClose}
            className="font-plex-mono text-[13px] text-[#6C7377]"
          >
            overslaan
          </button>
        </div>
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="waarde"
          className="mb-5 w-full border-b border-white/10 bg-transparent px-0.5 py-2.5 text-center text-[20px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
        />
        <button
          disabled={!isValid}
          onClick={() => isValid && onSubmit(parsed)}
          className="font-plex-mono w-full rounded-[22px] border border-white/20 py-2.5 text-[13px] text-[#E9EBEA] disabled:opacity-30"
        >
          opslaan
        </button>
      </div>
    </div>
  );
}
