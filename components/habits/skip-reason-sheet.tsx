"use client";

import { useState } from "react";
import type { Habit, SkipReason } from "@/lib/supabase/types";

/** Vaste redenen voor "niet gelukt" (exclusief 'niet_van_toepassing', dat is
 * gereserveerd voor de aparte "overslaan"-actie — één tap, geen reden nodig). */
const REASONS: { key: SkipReason; label: string }[] = [
  { key: "geen_tijd", label: "geen tijd" },
  { key: "vergeten", label: "vergeten" },
  { key: "pijn_of_moe", label: "pijn of moe" },
  { key: "geen_zin", label: "geen zin" },
  { key: "anders", label: "anders" },
];

interface SkipReasonSheetProps {
  habit: Habit;
  onClose: () => void;
  onSubmit: (reason: SkipReason, note: string | null) => void;
}

/** Kleine bottom sheet voor "niet gelukt": reden kiezen + optioneel vrij
 * tekstveld. Onderdeel van de check-in-driven habit-flow (zie components/habits/habits-today.tsx). */
export function SkipReasonSheet({ habit, onClose, onSubmit }: SkipReasonSheetProps) {
  const [reason, setReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-[#141516] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+22px)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-medium text-[#E9EBEA]">
            {habit.name} — niet gelukt
          </span>
          <button
            onClick={onClose}
            className="font-plex-mono text-[13px] text-[#6C7377]"
          >
            annuleren
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={`font-plex-mono rounded-full border px-3.5 py-2 text-[12.5px] transition ${
                reason === r.key
                  ? "border-white/40 bg-white/[0.08] text-[#E9EBEA]"
                  : "border-white/10 text-[#8A9094]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="notitie (optioneel)"
          className="mb-5 w-full border-b border-white/10 bg-transparent px-0.5 py-2.5 text-[14px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
        />
        <button
          disabled={!reason}
          onClick={() => reason && onSubmit(reason, note.trim() || null)}
          className="font-plex-mono w-full rounded-[22px] border border-white/20 py-2.5 text-[13px] text-[#E9EBEA] disabled:opacity-30"
        >
          opslaan
        </button>
      </div>
    </div>
  );
}
