"use client";

import { useState } from "react";
import type { Habit, HabitLog } from "@/lib/supabase/types";
import { SKIP_REASON_LABELS } from "@/lib/habits";

interface HabitCardProps {
  habit: Habit;
  log: HabitLog | undefined;
  /** Voortgang binnen het relevante venster: 7 dagen voor daily, deze week voor weekly_count. */
  context: { done: number; total: number };
  pending: boolean;
  onDone: () => void;
  onSkip: () => void; // opent de SkipReasonSheet ("niet gelukt")
  onOverslaan: () => void; // direct, geen reden nodig ("overslaan")
  onEditNote: (note: string | null) => void;
  onChangeStatus: () => void; // "wijzigen" — terug naar de drie acties
}

/** Eén habit met status en primaire acties. Toont ofwel de drie acties
 * (Gedaan / Niet gelukt / Overslaan) ofwel de geregistreerde status van
 * vandaag, met een "wijzigen"-optie voor het geval van dubbel afvinken. */
export function HabitCard({
  habit,
  log,
  context,
  pending,
  onDone,
  onSkip,
  onOverslaan,
  onEditNote,
  onChangeStatus,
}: HabitCardProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(log?.note ?? "");

  const contextLabel =
    habit.schedule_type === "daily"
      ? `${context.done} van de laatste ${context.total} dagen`
      : `${context.done} van ${context.total} deze week`;
  const weeklyMet = habit.schedule_type === "weekly_count" && context.done >= context.total;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-medium text-[#E9EBEA]">{habit.name}</span>
        {log && (
          <button
            onClick={onChangeStatus}
            className="font-plex-mono flex-none text-[11px] text-[#565C60]"
          >
            wijzigen
          </button>
        )}
      </div>
      <div
        className={`font-plex-mono mb-3 text-[11.5px] ${
          weeklyMet ? "text-[#8FBF8A]" : "text-[#6C7377]"
        }`}
      >
        {contextLabel}
        {weeklyMet ? " · doel gehaald" : ""}
      </div>

      {!log && (
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={onDone}
            className="font-plex-mono flex-1 rounded-[16px] border border-white/20 py-2 text-[12.5px] text-[#E9EBEA] disabled:opacity-40"
          >
            gedaan
          </button>
          <button
            disabled={pending}
            onClick={onSkip}
            className="font-plex-mono flex-1 rounded-[16px] border border-white/10 py-2 text-[12.5px] text-[#8A9094] disabled:opacity-40"
          >
            niet gelukt
          </button>
          <button
            disabled={pending}
            onClick={onOverslaan}
            className="font-plex-mono flex-1 rounded-[16px] border border-white/10 py-2 text-[12.5px] text-[#6C7377] disabled:opacity-40"
          >
            overslaan
          </button>
        </div>
      )}

      {log?.status === "done" && (
        <div className="flex flex-col gap-2">
          <span className="font-plex-mono text-[12px] text-[#8FBF8A]">✓ gedaan</span>
          {editingNote ? (
            <input
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                setEditingNote(false);
                onEditNote(noteDraft.trim() || null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="notitie (optioneel)"
              className="w-full border-b border-white/10 bg-transparent px-0.5 py-1.5 text-[13px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
            />
          ) : log.note ? (
            <button
              onClick={() => setEditingNote(true)}
              className="text-left text-[13px] text-[#C6CACB]"
            >
              {log.note}
            </button>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="font-plex-mono self-start text-[11px] text-[#565C60]"
            >
              + notitie toevoegen
            </button>
          )}
        </div>
      )}

      {log?.status === "skipped" && (
        <div className="flex flex-col gap-1">
          <span className="font-plex-mono text-[12px] text-[#6C7377]">
            {log.skip_reason === "niet_van_toepassing"
              ? "overgeslagen"
              : `niet gelukt · ${log.skip_reason ? SKIP_REASON_LABELS[log.skip_reason] : "onbekend"}`}
          </span>
          {log.note && <span className="text-[13px] text-[#8A9094]">{log.note}</span>}
        </div>
      )}
    </div>
  );
}
