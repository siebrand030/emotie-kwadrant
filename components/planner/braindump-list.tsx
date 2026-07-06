"use client";

import { taskColor } from "@/lib/task-colors";
import type { PlanItem } from "@/lib/supabase/types";

/**
 * Lijst van niet-ingeplande braindump-items. Elke rij is sleepbaar (pointer
 * events) naar de tijdlijn; de drag-logica zelf zit in planner-app.tsx (die
 * de tijdlijn-grid-ref nodig heeft om de drop-tijd te berekenen).
 */
interface BraindumpListProps {
  items: PlanItem[];
  draggingItemId: string | null;
  onPointerDown: (e: React.PointerEvent, item: PlanItem) => void;
  onPointerMove: (e: React.PointerEvent, item: PlanItem) => void;
  onPointerUp: (e: React.PointerEvent, item: PlanItem) => void;
}

export function BraindumpList({
  items,
  draggingItemId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BraindumpListProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 max-h-[132px] overflow-y-auto rounded-xl border border-white/5">
      {items.map((item) => (
        <div
          key={item.id}
          onPointerDown={(e) => onPointerDown(e, item)}
          onPointerMove={(e) => onPointerMove(e, item)}
          onPointerUp={(e) => onPointerUp(e, item)}
          onPointerCancel={(e) => onPointerUp(e, item)}
          style={{
            touchAction: "none",
            opacity: draggingItemId === item.id ? 0.35 : 1,
          }}
          className="flex cursor-grab items-center gap-2.5 border-b border-white/5 px-3 py-2.5 active:cursor-grabbing last:border-0"
        >
          <span className="font-plex-mono text-[13px] text-[#565C60]">⠿</span>
          <span
            className="size-2 flex-none rounded-full"
            style={{ background: taskColor(item.color) }}
          />
          <span className="flex-1 truncate text-[13.5px] text-[#D7DADA]">
            {item.title}
          </span>
        </div>
      ))}
    </div>
  );
}
