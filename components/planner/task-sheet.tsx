"use client";

import { taskColor, taskColorMix } from "@/lib/task-colors";
import { addMin, fmtDur } from "@/lib/planner-time";
import type { TaskColor } from "@/lib/supabase/types";

/** Bewerk-staat van een al ingepland item (aanmaken gebeurt via de braindump + sleep-naar-tijdlijn flow). */
export interface SheetState {
  itemId: string;
  title: string;
  start: string; // HH:MM
  dur: number; // minuten
  note: string;
  color: TaskColor;
}

const DURATION_CHIPS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1u", minutes: 60 },
  { label: "1u30", minutes: 90 },
  { label: "2u", minutes: 120 },
];

interface TaskSheetProps {
  sheet: SheetState;
  onClose: () => void;
  onPatch: (patch: Partial<SheetState>) => void;
  onSave: () => void;
  onDelete: () => void;
}

export function TaskSheet({ sheet, onClose, onPatch, onSave, onDelete }: TaskSheetProps) {
  const accent = taskColor(sheet.color);
  const end = addMin(sheet.start, sheet.dur);
  const canSave = sheet.title.trim().length > 0;

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-20 flex flex-col justify-end bg-[rgba(4,5,6,0.55)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#15171A] px-5 pt-[18px] pb-[30px] [animation:sheetup_0.3s_ease-out]"
      >
        {/* Live preview: tijdspanne + titel, in de taakkleur */}
        <div
          className="mb-5 flex flex-col gap-1.5 rounded-2xl border p-4"
          style={{
            background: taskColorMix(sheet.color, 13),
            borderColor: taskColorMix(sheet.color, 30),
          }}
        >
          <span className="font-plex-mono text-[11px]" style={{ color: accent }}>
            vandaag · {sheet.start} – {end} ({fmtDur(sheet.dur)})
          </span>
          <input
            value={sheet.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Structureer je dag"
            autoFocus
            className="w-full border-none bg-transparent p-0 text-xl font-medium text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
          />
        </div>

        {/* Tijd: starttijd + berekende eindtijd + duur-presets */}
        <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">tijd</div>
        <div className="mb-2.5 flex items-center gap-2.5">
          <input
            type="time"
            value={sheet.start}
            onChange={(e) => e.target.value && onPatch({ start: e.target.value })}
            className="font-plex-mono rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-2.5 text-[13px] text-[#E9EBEA] outline-none [color-scheme:dark]"
          />
          <span className="font-plex-mono text-[11.5px] text-[#6C7377]">tot {end}</span>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {DURATION_CHIPS.map((chip) => {
            const active = sheet.dur === chip.minutes;
            return (
              <button
                key={chip.minutes}
                type="button"
                onClick={() => onPatch({ dur: chip.minutes })}
                className="font-plex-mono rounded-2xl border px-[13px] py-2 text-[11.5px]"
                style={
                  active
                    ? { background: accent, borderColor: accent, color: "#0B0C0D" }
                    : {
                        background: "transparent",
                        borderColor: "rgba(255,255,255,.16)",
                        color: "#9AA0A3",
                      }
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Notitie */}
        <div className="font-plex-mono mb-2 text-[11px] text-[#565C60]">notitie</div>
        <input
          value={sheet.note}
          onChange={(e) => onPatch({ note: e.target.value })}
          placeholder="Notities, links of telefoonnummers..."
          className="mb-[22px] w-full rounded-[10px] border border-white/10 bg-[#0F1112] px-3 py-[11px] text-[13px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
        />

        {/* Acties: verwijderen + terug naar braindump + opslaan */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Item verwijderen"
            className="flex size-[50px] flex-none items-center justify-center rounded-[14px] border border-white/10 bg-transparent text-[#9AA0A3]"
          >
            <svg width="16" height="17" viewBox="0 0 16 17" fill="none">
              <path
                d="M2 4h12M6 4V2.5h4V4M4 4l.8 11h6.4L12 4M6.5 7v5M9.5 7v5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="h-[50px] flex-1 rounded-[14px] border-none bg-[#E9EBEA] text-sm font-medium text-[#0B0C0D] disabled:pointer-events-none disabled:opacity-35"
          >
            Bijwerken
          </button>
        </div>
      </div>
    </div>
  );
}
