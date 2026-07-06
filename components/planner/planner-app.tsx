"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyPlan, InboxItem, PlanItem } from "@/lib/supabase/types";
import { sourceColor, taskColor, taskColorMix } from "@/lib/task-colors";
import {
  clampMinutesOfDay,
  defaultStart,
  isoDate,
  minToTime,
  normalizeTime,
  snap,
  toMin,
} from "@/lib/planner-time";
import { getOrCreateDailyPlan } from "@/lib/daily-plans";
import { BottomNav } from "@/components/nav/bottom-nav";
import { TaskSheet, type SheetState } from "./task-sheet";
import { BraindumpList } from "./braindump-list";
import { InboxStrip } from "./inbox-strip";
import {
  createBraindumpItem,
  createScheduledItem,
  deletePlanItem,
  moveItemToPlan,
  scheduleItem,
  setPlanItemCompleted,
  updatePlanItemDetails,
  updateScheduledItem,
} from "@/lib/plan-items";
import { createInboxItem, deleteInboxItem } from "@/lib/inbox";

// 1.4px per minuut (i.p.v. 1px): zo past een half-uur-blok nog net het
// compacte layout (zie COMPACT_HEIGHT) zonder over de buur heen te vallen.
// Bloktop/-hoogte volgen hierdoor altijd exact de echte duur — geen
// afgedwongen minimumhoogte meer, die veroorzaakte overlap tussen twee
// aaneensluitende korte blokken.
const MINUTE_PX = 1.4;
const GRID_HEIGHT = 24 * 60 * MINUTE_PX;
const DEFAULT_DURATION = 30;
const TAP_THRESHOLD_MIN = 6; // kleiner verschil dan dit tijdens een block-drag = tik (opent sheet)
// Blokken korter dan dit tonen alleen de titel (geen tijdspanne): daaronder
// past de volledige twee-regel-layout niet meer zonder overlap te riskeren.
const COMPACT_HEIGHT = 44;
const LONG_PRESS_MS = 900; // ruim de tijd om tijdens het verplaatsen even te pauzeren zonder dat het actiemenu opent
const LONG_PRESS_CANCEL_PX = 8; // meer beweging dan dit tijdens het indrukken = geen long-press meer

interface PlannerAppProps {
  userId: string;
  dailyPlan: DailyPlan;
  initialPlanItems: PlanItem[];
  initialInboxItems: InboxItem[];
}

/** Drag-state voor de drie sleep-interacties: braindump→tijdlijn, verplaatsen, herduren. */
type DragState =
  | {
      kind: "braindump";
      itemId: string;
      pointerId: number;
      title: string;
      source: PlanItem["source"];
      x: number;
      y: number;
      overGrid: boolean;
      previewMin: number | null;
    }
  | {
      kind: "move";
      itemId: string;
      pointerId: number;
      startY: number;
      baseStartMin: number;
      deltaMin: number;
    }
  | {
      kind: "resize";
      itemId: string;
      pointerId: number;
      startY: number;
      baseDuration: number;
      deltaMin: number;
    };

export function PlannerApp({
  userId,
  dailyPlan,
  initialPlanItems,
  initialInboxItems,
}: PlannerAppProps) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<PlanItem[]>(initialPlanItems);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(initialInboxItems);
  const [braindumpText, setBraindumpText] = useState("");
  const [inboxValue, setInboxValue] = useState("");
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [actionMenuItem, setActionMenuItem] = useState<PlanItem | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);
  const gridPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  // ---- long-press (elk sleepbaar item): opent het verwijderen/verplaatsen-menu ----
  function startLongPress(item: PlanItem, x: number, y: number) {
    pressStartRef.current = { x, y };
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setDrag(null);
      setActionMenuItem(item);
    }, LONG_PRESS_MS);
  }
  function checkLongPressCancel(x: number, y: number) {
    const start = pressStartRef.current;
    if (!start || !longPressTimerRef.current) return;
    if (Math.hypot(x - start.x, y - start.y) > LONG_PRESS_CANCEL_PX) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function clearLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  }

  const unscheduled = items
    .filter((i) => i.status === "unscheduled")
    .sort((a, b) => a.sort_order - b.sort_order);
  const scheduled = items
    .filter((i) => i.status === "scheduled")
    .sort((a, b) =>
      (a.planned_start_time ?? "") < (b.planned_start_time ?? "") ? -1 : 1,
    );

  const dayLabel = new Date(dailyPlan.date + "T00:00:00").toLocaleDateString(
    "nl-NL",
    { weekday: "long", day: "numeric", month: "long" },
  );

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = dailyPlan.date === new Date().toISOString().slice(0, 10);

  // Bij openen eenmalig naar "nu" scrollen.
  useEffect(() => {
    if (didScrollRef.current) return;
    const el = scrollRef.current;
    if (el) {
      didScrollRef.current = true;
      el.scrollTop = Math.max(0, nowMin * MINUTE_PX - 160);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hourMarks = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    top: h * 60 * MINUTE_PX,
    label: String(h).padStart(2, "0") + ":00",
  }));

  // ---- braindump: aanmaken (altijd source 'planned') ----
  async function addBraindumpLine() {
    const title = braindumpText.trim();
    if (!title) return;
    setBraindumpText("");
    const sortOrder = unscheduled.length;
    const tempId = "temp-" + Date.now();
    const optimistic: PlanItem = {
      id: tempId,
      daily_plan_id: dailyPlan.id,
      user_id: userId,
      title,
      notes: null,
      status: "unscheduled",
      planned_start_time: null,
      planned_duration_minutes: null,
      sort_order: sortOrder,
      source: "planned",
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((cur) => [...cur, optimistic]);
    try {
      const row = await createBraindumpItem(supabase, userId, dailyPlan.id, title, sortOrder);
      setItems((cur) => cur.map((i) => (i.id === tempId ? row : i)));
    } catch (e) {
      console.error("Braindump-item toevoegen mislukt:", e);
      setItems((cur) => cur.filter((i) => i.id !== tempId));
      setBraindumpText(title);
    }
  }

  // ---- drag: braindump-item naar tijdlijn slepen (+ long-press voor het actiemenu) ----
  function onBraindumpPointerDown(e: React.PointerEvent, item: PlanItem) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      kind: "braindump",
      itemId: item.id,
      pointerId: e.pointerId,
      title: item.title,
      source: item.source,
      x: e.clientX,
      y: e.clientY,
      overGrid: false,
      previewMin: null,
    });
    startLongPress(item, e.clientX, e.clientY);
  }

  function onBraindumpPointerMove(e: React.PointerEvent, item: PlanItem) {
    checkLongPressCancel(e.clientX, e.clientY);
    setDrag((d) => {
      if (!d || d.kind !== "braindump" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return d;
      const rect = gridRef.current?.getBoundingClientRect();
      let overGrid = false;
      let previewMin: number | null = null;
      if (
        rect &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right
      ) {
        overGrid = true;
        previewMin = clampMinutesOfDay(snap((e.clientY - rect.top) / MINUTE_PX));
      }
      return { ...d, x: e.clientX, y: e.clientY, overGrid, previewMin };
    });
  }

  function onBraindumpPointerUp(e: React.PointerEvent, item: PlanItem) {
    const pressStart = pressStartRef.current;
    clearLongPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      setDrag(null);
      return;
    }
    const isTap =
      pressStart != null &&
      Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) < LONG_PRESS_CANCEL_PX;
    setDrag((d) => {
      if (!d || d.kind !== "braindump" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return null;
      if (isTap) {
        openSchedule(item);
      } else if (d.overGrid && d.previewMin != null) {
        void handleScheduleDrop(item, d.previewMin);
      }
      return null;
    });
  }

  async function handleScheduleDrop(item: PlanItem, startMin: number) {
    const start = minToTime(startMin);
    const prev = item;
    setItems((cur) =>
      cur.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "scheduled",
              planned_start_time: start,
              planned_duration_minutes: DEFAULT_DURATION,
            }
          : i,
      ),
    );
    try {
      await scheduleItem(supabase, item.id, {
        planned_start_time: start,
        planned_duration_minutes: DEFAULT_DURATION,
      });
    } catch (e) {
      console.error("Inplannen mislukt:", e);
      setItems((cur) => cur.map((i) => (i.id === item.id ? prev : i)));
    }
  }

  // ---- drag: ingepland blok verplaatsen (+ long-press voor het actiemenu) ----
  function onBlockPointerDown(e: React.PointerEvent, item: PlanItem) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const baseStartMin = toMin(normalizeTime(item.planned_start_time) ?? "00:00");
    setDrag({
      kind: "move",
      itemId: item.id,
      pointerId: e.pointerId,
      startY: e.clientY,
      baseStartMin,
      deltaMin: 0,
    });
    startLongPress(item, e.clientX, e.clientY);
  }

  function onBlockPointerMove(e: React.PointerEvent, item: PlanItem) {
    checkLongPressCancel(e.clientX, e.clientY);
    setDrag((d) => {
      if (!d || d.kind !== "move" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return d;
      return { ...d, deltaMin: (e.clientY - d.startY) / MINUTE_PX };
    });
  }

  function onBlockPointerUp(e: React.PointerEvent, item: PlanItem) {
    clearLongPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      setDrag(null);
      return;
    }
    setDrag((d) => {
      if (!d || d.kind !== "move" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return null;
      if (Math.abs(d.deltaMin) < TAP_THRESHOLD_MIN) {
        openEdit(item);
      } else {
        const newStartMin = clampMinutesOfDay(snap(d.baseStartMin + d.deltaMin));
        void handleMove(item, newStartMin);
      }
      return null;
    });
  }

  async function handleMove(item: PlanItem, newStartMin: number) {
    const start = minToTime(newStartMin);
    const prevStart = item.planned_start_time;
    setItems((cur) =>
      cur.map((i) => (i.id === item.id ? { ...i, planned_start_time: start } : i)),
    );
    try {
      await updateScheduledItem(supabase, item.id, { planned_start_time: start });
    } catch (e) {
      console.error("Verplaatsen mislukt:", e);
      setItems((cur) =>
        cur.map((i) => (i.id === item.id ? { ...i, planned_start_time: prevStart } : i)),
      );
    }
  }

  // ---- drag: blok herduren (onderkant slepen) ----
  function onResizePointerDown(e: React.PointerEvent, item: PlanItem) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      kind: "resize",
      itemId: item.id,
      pointerId: e.pointerId,
      startY: e.clientY,
      baseDuration: item.planned_duration_minutes ?? DEFAULT_DURATION,
      deltaMin: 0,
    });
  }

  function onResizePointerMove(e: React.PointerEvent, item: PlanItem) {
    setDrag((d) => {
      if (!d || d.kind !== "resize" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return d;
      return { ...d, deltaMin: (e.clientY - d.startY) / MINUTE_PX };
    });
  }

  function onResizePointerUp(e: React.PointerEvent, item: PlanItem) {
    setDrag((d) => {
      if (!d || d.kind !== "resize" || d.itemId !== item.id || d.pointerId !== e.pointerId)
        return null;
      const newDuration = Math.max(15, snap(d.baseDuration + d.deltaMin));
      void handleResize(item, newDuration);
      return null;
    });
  }

  async function handleResize(item: PlanItem, newDuration: number) {
    const prevDuration = item.planned_duration_minutes;
    setItems((cur) =>
      cur.map((i) =>
        i.id === item.id ? { ...i, planned_duration_minutes: newDuration } : i,
      ),
    );
    try {
      await updateScheduledItem(supabase, item.id, {
        planned_duration_minutes: newDuration,
      });
    } catch (e) {
      console.error("Herduren mislukt:", e);
      setItems((cur) =>
        cur.map((i) =>
          i.id === item.id ? { ...i, planned_duration_minutes: prevDuration } : i,
        ),
      );
    }
  }

  function blockGeometry(item: PlanItem) {
    const baseStart = toMin(normalizeTime(item.planned_start_time) ?? "00:00");
    const baseDur = item.planned_duration_minutes ?? DEFAULT_DURATION;
    let top = baseStart;
    let dur = baseDur;
    if (drag && drag.itemId === item.id) {
      if (drag.kind === "move") top = clampMinutesOfDay(snap(drag.baseStartMin + drag.deltaMin));
      if (drag.kind === "resize") dur = Math.max(15, snap(drag.baseDuration + drag.deltaMin));
    }
    return { top, dur };
  }

  // ---- sheet: bewerken van een bestaand item, of aanmaken op een leeg tijdstip ----
  function openEdit(item: PlanItem) {
    setSheet({
      mode: "edit",
      itemId: item.id,
      title: item.title,
      start: normalizeTime(item.planned_start_time) ?? "09:00",
      dur: item.planned_duration_minutes ?? DEFAULT_DURATION,
      note: item.notes ?? "",
      source: item.source,
    });
  }

  function openCreate(startMin: number) {
    setSheet({
      mode: "create",
      itemId: null,
      title: "",
      start: minToTime(startMin),
      dur: DEFAULT_DURATION,
      note: "",
      source: "adhoc",
    });
  }

  /** Tik op een braindump-item: zelfde tijd/duur-flow als een bestaand blok, maar plant meteen in. */
  function openSchedule(item: PlanItem) {
    setSheet({
      mode: "edit",
      itemId: item.id,
      title: item.title,
      start: defaultStart(),
      dur: DEFAULT_DURATION,
      note: item.notes ?? "",
      source: item.source,
    });
  }

  const patchSheet = (patch: Partial<SheetState>) =>
    setSheet((s) => (s ? { ...s, ...patch } : s));

  async function saveSheet() {
    if (!sheet || !sheet.title.trim()) return;
    const s = sheet;

    if (s.mode === "create") {
      setSheet(null);
      const tempId = "temp-" + Date.now();
      const optimistic: PlanItem = {
        id: tempId,
        daily_plan_id: dailyPlan.id,
        user_id: userId,
        title: s.title.trim(),
        notes: s.note.trim() || null,
        status: "scheduled",
        planned_start_time: s.start,
        planned_duration_minutes: s.dur,
        sort_order: 0,
        source: "adhoc",
        completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setItems((cur) => [...cur, optimistic]);
      try {
        const row = await createScheduledItem(supabase, userId, dailyPlan.id, {
          title: optimistic.title,
          notes: optimistic.notes,
          planned_start_time: s.start,
          planned_duration_minutes: s.dur,
        });
        setItems((cur) => cur.map((i) => (i.id === tempId ? row : i)));
      } catch (e) {
        console.error("Taak aanmaken mislukt:", e);
        setItems((cur) => cur.filter((i) => i.id !== tempId));
      }
      return;
    }

    if (!s.itemId) return;
    const itemId = s.itemId;
    const prev = items.find((i) => i.id === itemId) ?? null;
    // Vanuit de braindump-lijst getikt: dit item was nog 'unscheduled' en
    // moet nu ook echt de status 'scheduled' krijgen (niet alleen tijd/duur).
    const wasUnscheduled = prev?.status === "unscheduled";
    setSheet(null);
    setItems((cur) =>
      cur.map((i) =>
        i.id === itemId
          ? {
              ...i,
              title: s.title.trim(),
              notes: s.note.trim() || null,
              status: "scheduled",
              planned_start_time: s.start,
              planned_duration_minutes: s.dur,
            }
          : i,
      ),
    );
    try {
      await Promise.all([
        wasUnscheduled
          ? scheduleItem(supabase, itemId, {
              planned_start_time: s.start,
              planned_duration_minutes: s.dur,
            })
          : updateScheduledItem(supabase, itemId, {
              planned_start_time: s.start,
              planned_duration_minutes: s.dur,
            }),
        updatePlanItemDetails(supabase, itemId, {
          title: s.title.trim(),
          notes: s.note.trim() || null,
        }),
      ]);
    } catch (e) {
      console.error("Bijwerken mislukt:", e);
      if (prev) setItems((cur) => cur.map((i) => (i.id === itemId ? prev : i)));
    }
  }

  async function deleteFromSheet() {
    if (!sheet || !sheet.itemId) return;
    const id = sheet.itemId;
    setSheet(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      await deletePlanItem(supabase, id);
    } catch (e) {
      console.error("Verwijderen mislukt:", e);
      setItems(prev);
    }
  }

  // ---- actiemenu (long-press): verwijderen of naar morgen verplaatsen ----
  async function deleteItemDirect(item: PlanItem) {
    setActionMenuItem(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    try {
      await deletePlanItem(supabase, item.id);
    } catch (e) {
      console.error("Verwijderen mislukt:", e);
      setItems(prev);
    }
  }

  async function moveToTomorrow(item: PlanItem) {
    setActionMenuItem(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowPlan = await getOrCreateDailyPlan(supabase, userId, isoDate(tomorrow));
      await moveItemToPlan(supabase, item.id, tomorrowPlan.id, 0);
    } catch (e) {
      console.error("Verplaatsen naar morgen mislukt:", e);
      setItems(prev);
    }
  }

  async function toggleComplete(item: PlanItem) {
    const next = !item.completed;
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, completed: next } : i)));
    try {
      await setPlanItemCompleted(supabase, item.id, next);
    } catch (e) {
      console.error("Afvinken mislukt:", e);
      setItems(prev);
    }
  }

  // ---- inbox-strook (los van de dagplanning) ----
  async function addInboxItem() {
    const content = inboxValue.trim();
    if (!content) return;
    setInboxValue("");
    const tempId = "temp-" + Date.now();
    const optimistic: InboxItem = {
      id: tempId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    };
    setInboxItems((cur) => [optimistic, ...cur]);
    try {
      const row = await createInboxItem(supabase, userId, content);
      setInboxItems((cur) => cur.map((i) => (i.id === tempId ? row : i)));
    } catch (e) {
      console.error("Inbox-item toevoegen mislukt:", e);
      setInboxItems((cur) => cur.filter((i) => i.id !== tempId));
      setInboxValue(content);
    }
  }

  async function removeInboxItem(id: string) {
    const prev = inboxItems;
    setInboxItems((cur) => cur.filter((i) => i.id !== id));
    try {
      await deleteInboxItem(supabase, id);
    } catch (e) {
      console.error("Inbox-item verwijderen mislukt:", e);
      setInboxItems(prev);
    }
  }

  // ---- tijdlijn: tik op een leeg tijdstip = meteen een nieuw item aanmaken ----
  function onGridPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    gridPressStartRef.current = { x: e.clientX, y: e.clientY };
  }
  function onGridPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = gridPressStartRef.current;
    gridPressStartRef.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    openCreate(clampMinutesOfDay(snap((e.clientY - rect.top) / MINUTE_PX)));
  }

  const draggingBraindumpId = drag?.kind === "braindump" ? drag.itemId : null;

  return (
    <main className="font-plex relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#0B0C0D] text-[#E9EBEA] select-none">
      {/* Kop: alleen de datum, geen instellingen/inbox meer bovenaan */}
      <div className="flex flex-none items-baseline justify-between px-5 pt-5 pb-1">
        <span className="text-[15px] font-medium text-[#D7DADA] capitalize">
          {dayLabel}
        </span>
        {unscheduled.length > 0 && (
          <span className="font-plex-mono text-[11px] text-[#565C60]">
            {unscheduled.length} te plannen
          </span>
        )}
      </div>

      {/* Braindump: direct typen, Enter = nieuw item */}
      <div className="flex-none px-5 pb-2">
        <input
          value={braindumpText}
          onChange={(e) => setBraindumpText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addBraindumpLine();
            }
          }}
          placeholder="Typ je lijstje, Enter voor elk item..."
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-[#15171A] px-3.5 py-3 text-[13.5px] text-[#E9EBEA] outline-none placeholder:text-[#565C60] focus:border-white/25"
        />
        <BraindumpList
          items={unscheduled}
          draggingItemId={draggingBraindumpId}
          onPointerDown={onBraindumpPointerDown}
          onPointerMove={onBraindumpPointerMove}
          onPointerUp={onBraindumpPointerUp}
        />
      </div>

      {/* Tijdlijn */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <div
          ref={gridRef}
          onPointerDown={onGridPointerDown}
          onPointerUp={onGridPointerUp}
          className="relative"
          style={{ height: `${GRID_HEIGHT}px` }}
        >
          {hourMarks.map((hm) => (
            <div key={hm.hour}>
              <div
                className="absolute right-[14px] left-[52px] h-px bg-white/5"
                style={{ top: `${hm.top}px` }}
              />
              <div
                className="font-plex-mono absolute left-[14px] w-[38px] text-right text-[10px] text-[#4A4F52]"
                style={{ top: `${hm.top - 6}px` }}
              >
                {hm.label}
              </div>
            </div>
          ))}

          {showNow && (
            <>
              <div
                className="absolute right-[14px] left-[52px] z-[4] h-0.5 rounded-[1px]"
                style={{ top: `${nowMin * MINUTE_PX}px`, background: taskColor("coral") }}
              />
              <div
                className="font-plex-mono absolute left-[14px] z-[4] w-[38px] text-right text-[10px] font-semibold"
                style={{ top: `${nowMin * MINUTE_PX - 6}px`, color: taskColor("coral") }}
              >
                {minToTime(nowMin)}
              </div>
            </>
          )}

          {/* Drop-preview tijdens het slepen van een braindump-item */}
          {drag?.kind === "braindump" && drag.overGrid && drag.previewMin != null && (
            <div
              className="absolute right-[14px] left-[52px] z-[5]"
              style={{ top: `${drag.previewMin * MINUTE_PX}px` }}
            >
              <div
                className="border-t-2 border-dashed"
                style={{ borderColor: taskColor(sourceColor(drag.source)) }}
              />
              <span
                className="font-plex-mono absolute top-1 left-0 text-[10px]"
                style={{ color: taskColor(sourceColor(drag.source)) }}
              >
                {minToTime(drag.previewMin)} · {drag.title}
              </span>
            </div>
          )}

          {scheduled.length === 0 && unscheduled.length === 0 && (
            <div className="absolute inset-x-0 top-[60px] z-[2] px-[22px] text-center text-[13px] text-[#6C7377]">
              Begin met typen om je dag te plannen.
            </div>
          )}

          {scheduled.map((t) => {
            const { top, dur } = blockGeometry(t);
            // Geen afgedwongen minimumhoogte: de hoogte volgt altijd exact de
            // duur, anders overlapt een kort blok met de buur eronder.
            const height = dur * MINUTE_PX;
            const compact = height < COMPACT_HEIGHT;
            const done = t.completed;
            const color = sourceColor(t.source);
            const isDragging =
              drag != null && drag.kind !== "braindump" && drag.itemId === t.id;
            const titleStyle: React.CSSProperties = {
              color: done ? "#565C60" : "#E9EBEA",
              textDecoration: done ? "line-through" : "none",
            };
            return (
              <div
                key={t.id}
                onPointerDown={(e) => onBlockPointerDown(e, t)}
                onPointerMove={(e) => onBlockPointerMove(e, t)}
                onPointerUp={(e) => onBlockPointerUp(e, t)}
                onPointerCancel={(e) => onBlockPointerUp(e, t)}
                className={
                  "absolute right-[14px] left-[52px] cursor-grab rounded-[10px] border border-l-[3px] active:cursor-grabbing " +
                  (compact
                    ? "flex items-center gap-1.5 px-2 py-0"
                    : "flex flex-col justify-center gap-0.5 px-2.5 py-1.5 pr-[34px]")
                }
                style={{
                  top: `${top * MINUTE_PX}px`,
                  height: `${height}px`,
                  background: taskColorMix(color, 14),
                  borderColor: taskColorMix(color, 32),
                  borderLeftColor: taskColor(color),
                  touchAction: "none",
                  opacity: isDragging ? 0.85 : 1,
                  zIndex: isDragging ? 6 : 2,
                }}
              >
                {compact ? (
                  <>
                    <span
                      className="flex-1 truncate text-[11.5px] font-semibold"
                      style={titleStyle}
                    >
                      {t.title}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleComplete(t);
                      }}
                      aria-label={done ? "Afvinken ongedaan maken" : "Afvinken"}
                      className="flex size-[15px] flex-none items-center justify-center rounded-full border-[1.5px] text-[8px] font-semibold text-[#0B0C0D] transition-colors"
                      style={{
                        borderColor: taskColor(color),
                        background: done ? taskColor(color) : "transparent",
                      }}
                    >
                      {done ? "✓" : ""}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-plex-mono text-[10.5px] text-[#9AA0A3]">
                      {minToTime(top)} – {minToTime(top + dur)}
                    </span>
                    <span className="truncate text-sm font-semibold" style={titleStyle}>
                      {t.title}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleComplete(t);
                      }}
                      aria-label={done ? "Afvinken ongedaan maken" : "Afvinken"}
                      className="absolute top-[7px] right-[7px] flex size-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold text-[#0B0C0D] transition-colors"
                      style={{
                        borderColor: taskColor(color),
                        background: done ? taskColor(color) : "transparent",
                      }}
                    >
                      {done ? "✓" : ""}
                    </button>
                  </>
                )}
                {/* Resize-handle: onderkant slepen om de duur aan te passen */}
                <div
                  onPointerDown={(e) => onResizePointerDown(e, t)}
                  onPointerMove={(e) => onResizePointerMove(e, t)}
                  onPointerUp={(e) => onResizePointerUp(e, t)}
                  onPointerCancel={(e) => onResizePointerUp(e, t)}
                  style={{ touchAction: "none" }}
                  className={
                    "absolute inset-x-0 bottom-0 flex cursor-row-resize items-end justify-center " +
                    (compact ? "h-[6px] pb-px" : "h-3.5 pb-[3px]")
                  }
                >
                  <span className="h-[3px] w-6 rounded-full bg-white/25" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inbox-strook: ongestructureerde gedachten, los van de dagplanning */}
      <InboxStrip
        items={inboxItems}
        value={inboxValue}
        onValueChange={setInboxValue}
        onSubmit={() => void addInboxItem()}
        expanded={inboxExpanded}
        onToggleExpanded={() => setInboxExpanded((v) => !v)}
        onDelete={(id) => void removeInboxItem(id)}
      />

      <BottomNav />

      {sheet && (
        <TaskSheet
          sheet={sheet}
          onClose={() => setSheet(null)}
          onPatch={patchSheet}
          onSave={() => void saveSheet()}
          onDelete={() => void deleteFromSheet()}
        />
      )}

      {/* Actiemenu (long-press): verwijderen of naar morgen verplaatsen */}
      {actionMenuItem && (
        <div
          onClick={() => setActionMenuItem(null)}
          className="absolute inset-0 z-30 bg-[rgba(4,5,6,0.55)]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-5 mt-16 overflow-hidden rounded-2xl border border-white/10 bg-[#15171A]"
          >
            <div className="truncate border-b border-white/5 px-4 py-3 text-[13px] text-[#9AA0A3]">
              {actionMenuItem.title}
            </div>
            <button
              type="button"
              onClick={() => void moveToTomorrow(actionMenuItem)}
              className="block w-full border-b border-white/5 px-4 py-3.5 text-left text-[14px] text-[#E9EBEA]"
            >
              Naar morgen verplaatsen
            </button>
            <button
              type="button"
              onClick={() => void deleteItemDirect(actionMenuItem)}
              className="block w-full px-4 py-3.5 text-left text-[14px] text-[#FF6B6B]"
            >
              Verwijderen
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
