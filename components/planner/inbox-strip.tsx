"use client";

import type { InboxItem } from "@/lib/supabase/types";

/**
 * Vaste strook onderin de planner voor ongestructureerde gedachten (los van
 * de dagplanning). Snel toevoegen zonder de planning-flow te onderbreken;
 * de volledige lijst is optioneel uitklapbaar.
 */
interface InboxStripProps {
  items: InboxItem[];
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDelete: (id: string) => void;
}

export function InboxStrip({
  items,
  value,
  onValueChange,
  onSubmit,
  expanded,
  onToggleExpanded,
  onDelete,
}: InboxStripProps) {
  return (
    <div className="flex-none border-t border-white/5 bg-[#0F1112] px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Snelle gedachte..."
          className="flex-1 rounded-full border border-white/10 bg-[#15171A] px-3.5 py-2 text-[13px] text-[#E9EBEA] outline-none placeholder:text-[#565C60] focus:border-white/25"
        />
        <button
          type="button"
          onClick={onSubmit}
          aria-label="Toevoegen aan inbox"
          className="flex size-9 flex-none items-center justify-center rounded-full border border-white/15 bg-transparent text-[18px] font-light text-[#9AA0A3] transition active:scale-90"
        >
          +
        </button>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label="Inbox tonen/verbergen"
            className="font-plex-mono flex size-9 flex-none items-center justify-center rounded-full border border-white/15 text-[11px] text-[#9AA0A3]"
          >
            {items.length}
          </button>
        )}
      </div>

      {expanded && items.length > 0 && (
        <div className="mt-2.5 max-h-[34vh] overflow-y-auto rounded-xl border border-white/5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2.5 last:border-0"
            >
              <span className="flex-1 text-[13px] text-[#D7DADA]">{item.content}</span>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                aria-label="Verwijderen"
                className="px-1 text-base text-[#565C60]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
