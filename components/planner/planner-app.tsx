"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TASK_COLORS, type Task, type TaskColor } from "@/lib/supabase/types";
import { taskColor, taskColorMix } from "@/lib/task-colors";
import {
  addMin,
  defaultStart,
  isoDate,
  minToTime,
  normalizeTime,
  toMin,
} from "@/lib/planner-time";
import { BottomNav } from "@/components/nav/bottom-nav";
import { TaskSheet, type SheetState } from "./task-sheet";
import {
  createInboxTask,
  createScheduledTask,
  deleteTask,
  scheduleTask,
  setTaskCompleted,
  type ScheduledTaskInput,
} from "@/lib/tasks";

type PlanTab = "tijdlijn" | "inbox" | "instellingen";

// 1px per minuut (zoals het prototype); 24u = 1440px hoge scroll-grid.
const MINUTE_PX = 1;
const GRID_HEIGHT = 1440;
const DAY_LETTERS = ["z", "m", "d", "w", "d", "v", "z"];

interface PlannerAppProps {
  userId: string;
  initialTasks: Task[];
}

export function PlannerApp({ userId, initialTasks }: PlannerAppProps) {
  const supabase = useMemo(() => createClient(), []);
  const todayIso = useMemo(() => isoDate(new Date()), []);

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selDate, setSelDate] = useState<string>(todayIso);
  const [planTab, setPlanTab] = useState<PlanTab>("tijdlijn");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [newThought, setNewThought] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);

  // ---- afgeleide data ----
  const scheduled = tasks.filter((t) => t.status === "scheduled");
  const inbox = tasks.filter((t) => t.status === "inbox");

  const tasksForDate = (iso: string) =>
    scheduled
      .filter((t) => t.date === iso)
      .sort((a, b) => (a.start_time ?? "") < (b.start_time ?? "") ? -1 : 1);

  const dayTasks = tasksForDate(selDate);

  const sel = new Date(selDate + "T00:00:00");
  const weekStart = new Date(sel);
  weekStart.setDate(sel.getDate() - sel.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = isoDate(d);
    return {
      iso,
      letter: DAY_LETTERS[i],
      num: d.getDate(),
      isSelected: iso === selDate,
      isToday: iso === todayIso,
      dots: tasksForDate(iso).slice(0, 4),
    };
  });
  const monthLabel = sel.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = selDate === todayIso;

  // Bij openen van de tijdlijn eenmalig naar "nu" scrollen.
  useEffect(() => {
    if (planTab !== "tijdlijn" || didScrollRef.current) return;
    const el = scrollRef.current;
    if (el) {
      didScrollRef.current = true;
      el.scrollTop = Math.max(0, nowMin * MINUTE_PX - 160);
    }
  }, [planTab, nowMin]);

  // ---- sheet openen ----
  function openCreate(pref?: {
    time?: string;
    title?: string;
    color?: TaskColor;
    taskId?: string;
  }) {
    setSheet({
      mode: "create",
      taskId: pref?.taskId ?? null,
      title: pref?.title ?? "",
      date: selDate,
      start: pref?.time ?? defaultStart(),
      dur: 30,
      color: pref?.color ?? "coral",
      note: "",
    });
  }

  function openEdit(task: Task) {
    setSheet({
      mode: "edit",
      taskId: task.id,
      title: task.title,
      date: task.date ?? todayIso,
      start: normalizeTime(task.start_time) ?? defaultStart(),
      dur: task.duration_minutes ?? 30,
      color: task.color,
      note: task.notes ?? "",
    });
  }

  const patchSheet = (patch: Partial<SheetState>) =>
    setSheet((s) => (s ? { ...s, ...patch } : s));

  // ---- mutaties (optimistisch; revert bij fout) ----
  async function saveSheet() {
    if (!sheet || !sheet.title.trim()) return;
    const s = sheet;
    const input: ScheduledTaskInput = {
      title: s.title.trim(),
      date: s.date,
      start_time: s.start,
      duration_minutes: s.dur,
      color: s.color,
      notes: s.note.trim() || null,
    };

    setSheet(null);
    setPlanTab("tijdlijn");
    setSelDate(s.date);

    if (s.taskId) {
      // Bestaande rij: bewerken, of een inbox-item inplannen (status → scheduled).
      const prev = tasks;
      setTasks((ts) =>
        ts.map((t) =>
          t.id === s.taskId ? { ...t, ...input, status: "scheduled" } : t,
        ),
      );
      try {
        await scheduleTask(supabase, s.taskId, input);
      } catch (e) {
        console.error("Inplannen mislukt:", e);
        setTasks(prev);
      }
    } else {
      // Nieuwe ingeplande taak.
      const tempId = "temp-" + Date.now();
      const optimistic: Task = {
        id: tempId,
        user_id: userId,
        status: "scheduled",
        completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
      setTasks((ts) => [...ts, optimistic]);
      try {
        const row = await createScheduledTask(supabase, userId, input);
        setTasks((ts) => ts.map((t) => (t.id === tempId ? row : t)));
      } catch (e) {
        console.error("Taak aanmaken mislukt:", e);
        setTasks((ts) => ts.filter((t) => t.id !== tempId));
      }
    }
  }

  async function deleteFromSheet() {
    if (!sheet?.taskId) return;
    const id = sheet.taskId;
    setSheet(null);
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await deleteTask(supabase, id);
    } catch (e) {
      console.error("Verwijderen mislukt:", e);
      setTasks(prev);
    }
  }

  async function toggleComplete(task: Task) {
    const next = !task.completed;
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t.id === task.id ? { ...t, completed: next } : t)),
    );
    try {
      await setTaskCompleted(supabase, task.id, next);
    } catch (e) {
      console.error("Afvinken mislukt:", e);
      setTasks(prev);
    }
  }

  async function addThought() {
    const title = newThought.trim();
    if (!title) return;
    const color = TASK_COLORS[inbox.length % TASK_COLORS.length];
    setNewThought("");
    const tempId = "temp-" + Date.now();
    const optimistic: Task = {
      id: tempId,
      user_id: userId,
      title,
      notes: null,
      status: "inbox",
      date: null,
      start_time: null,
      duration_minutes: null,
      color,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((ts) => [...ts, optimistic]);
    try {
      const row = await createInboxTask(supabase, userId, title, color);
      setTasks((ts) => ts.map((t) => (t.id === tempId ? row : t)));
    } catch (e) {
      console.error("Toevoegen mislukt:", e);
      setTasks((ts) => ts.filter((t) => t.id !== tempId));
      setNewThought(title);
    }
  }

  const hourMarks = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    top: h * 60 * MINUTE_PX,
    label: String(h).padStart(2, "0") + ":00",
  }));

  return (
    <main className="font-plex relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#0B0C0D] text-[#E9EBEA]">
      {/* Kop: terug naar Tools */}
      <div className="flex flex-none items-center gap-2 px-5 pt-5 pb-0.5">
        <Link
          href="/tools"
          className="font-plex-mono px-2.5 py-1 text-xl text-[#6C7377]"
          aria-label="Terug naar Tools"
        >
          ‹
        </Link>
        <span className="text-[15px] font-medium text-[#D7DADA]">Planner</span>
      </div>

      {/* Inbox-knop */}
      <div className="flex-none px-5 pt-3.5 pb-0.5">
        <button
          type="button"
          onClick={() => setPlanTab("inbox")}
          className="flex w-full items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left transition active:scale-[0.98]"
          style={{
            background:
              planTab === "inbox" ? taskColorMix("coral", 13) : "#15171A",
            borderColor:
              planTab === "inbox"
                ? taskColorMix("coral", 32)
                : "rgba(255,255,255,.08)",
          }}
        >
          <span
            className="size-2 flex-none rounded-full"
            style={{ background: taskColor("coral") }}
          />
          <span className="flex-1 text-sm font-medium text-[#E9EBEA]">Inbox</span>
          {inbox.length > 0 && (
            <span
              className="font-plex-mono text-[11px]"
              style={{ color: taskColor("coral") }}
            >
              {inbox.length}
            </span>
          )}
          <span className="text-base text-[#565C60]">›</span>
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-none justify-center gap-6 pt-3.5 pb-1.5">
        <button
          type="button"
          onClick={() => setPlanTab("tijdlijn")}
          className="font-plex-mono px-0.5 py-2 text-[11.5px]"
          style={{ color: planTab === "tijdlijn" ? "#E9EBEA" : "#6C7377" }}
        >
          tijdlijn
        </button>
        <button
          type="button"
          onClick={() => setPlanTab("instellingen")}
          className="font-plex-mono px-0.5 py-2 text-[11.5px]"
          style={{ color: planTab === "instellingen" ? "#E9EBEA" : "#6C7377" }}
        >
          instellingen
        </button>
      </div>

      {/* --- Tijdlijn --- */}
      {planTab === "tijdlijn" && (
        <>
          <div className="flex flex-none items-center justify-between px-5 pt-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => shiftWeek(-7)}
              className="font-plex-mono px-3.5 py-1.5 text-xl text-[#6C7377]"
              aria-label="Vorige week"
            >
              ‹
            </button>
            <span className="font-plex-mono text-xs text-[#9AA0A3]">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftWeek(7)}
              className="font-plex-mono px-3.5 py-1.5 text-xl text-[#6C7377]"
              aria-label="Volgende week"
            >
              ›
            </button>
          </div>

          {/* Week-strip */}
          <div className="flex flex-none gap-1 border-b border-white/5 px-4 pt-1.5 pb-3.5">
            {weekDays.map((wd) => (
              <button
                key={wd.iso}
                type="button"
                onClick={() => setSelDate(wd.iso)}
                className="flex flex-1 flex-col items-center gap-[5px] py-1"
              >
                <span className="font-plex-mono text-[9.5px] uppercase text-[#565C60]">
                  {wd.letter}
                </span>
                <span
                  className="font-plex-mono flex size-8 items-center justify-center rounded-full text-[13px] font-medium"
                  style={{
                    background: wd.isSelected ? taskColor("coral") : "transparent",
                    color: wd.isSelected
                      ? "#0B0C0D"
                      : wd.isToday
                        ? taskColor("coral")
                        : "#9AA0A3",
                  }}
                >
                  {wd.num}
                </span>
                <span className="flex h-[5px] gap-[3px]">
                  {wd.dots.map((t) => (
                    <span
                      key={t.id}
                      className="size-1 rounded-full"
                      style={{ background: taskColor(t.color) }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>

          {/* Uur-grid met taakblokken */}
          <div
            ref={scrollRef}
            className="relative flex-1 overflow-y-auto overflow-x-hidden"
          >
            {dayTasks.length === 0 && (
              <div className="absolute inset-x-0 top-[60px] z-[2] px-[22px] text-center text-[13px] text-[#6C7377]">
                Nog geen taken voor deze dag.
              </div>
            )}
            <div
              onClick={onGridClick}
              className="relative cursor-pointer"
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
                    style={{
                      top: `${nowMin * MINUTE_PX}px`,
                      background: taskColor("coral"),
                    }}
                  />
                  <div
                    className="font-plex-mono absolute left-[14px] z-[4] w-[38px] text-right text-[10px] font-semibold"
                    style={{
                      top: `${nowMin * MINUTE_PX - 6}px`,
                      color: taskColor("coral"),
                    }}
                  >
                    {minToTime(nowMin)}
                  </div>
                </>
              )}

              {dayTasks.map((t) => {
                const start = normalizeTime(t.start_time) ?? "00:00";
                const dur = t.duration_minutes ?? 30;
                const top = toMin(start) * MINUTE_PX;
                const height = Math.max(dur * MINUTE_PX, 44);
                const done = t.completed;
                return (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(t);
                    }}
                    className="absolute right-[14px] left-[52px] z-[2] flex cursor-pointer flex-col justify-center gap-0.5 rounded-[10px] border border-l-[3px] px-2.5 py-1.5 pr-[34px]"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      background: taskColorMix(t.color, 14),
                      borderColor: taskColorMix(t.color, 32),
                      borderLeftColor: taskColor(t.color),
                    }}
                  >
                    <span className="font-plex-mono text-[10.5px] text-[#9AA0A3]">
                      {start} – {addMin(start, dur)}
                    </span>
                    <span
                      className="truncate text-sm font-semibold"
                      style={{
                        color: done ? "#565C60" : "#E9EBEA",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {t.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(t);
                      }}
                      aria-label={done ? "Afvinken ongedaan maken" : "Afvinken"}
                      className="absolute top-[7px] right-[7px] flex size-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold text-[#0B0C0D] transition-colors"
                      style={{
                        borderColor: taskColor(t.color),
                        background: done ? taskColor(t.color) : "transparent",
                      }}
                    >
                      {done ? "✓" : ""}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAB */}
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Nieuwe taak"
            className="absolute right-[22px] bottom-[88px] z-10 flex size-14 items-center justify-center rounded-full text-[28px] font-light text-[#0B0C0D] shadow-[0_6px_20px_rgba(0,0,0,.45)] transition active:scale-95"
            style={{ background: taskColor("coral") }}
          >
            +
          </button>
        </>
      )}

      {/* --- Inbox --- */}
      {planTab === "inbox" && (
        <div className="flex-1 overflow-y-auto px-[22px] pt-3.5 pb-6">
          <div className="flex gap-2.5">
            <input
              value={newThought}
              onChange={(e) => setNewThought(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addThought()}
              placeholder="Nieuwe gedachte..."
              className="flex-1 rounded-xl border border-white/10 bg-[#0F1112] px-3.5 py-3 text-[13.5px] text-[#E9EBEA] outline-none placeholder:text-[#565C60] focus:border-white/25"
            />
            <button
              type="button"
              onClick={addThought}
              aria-label="Toevoegen"
              className="size-11 flex-none rounded-full border border-white/15 bg-transparent text-[22px] font-light text-[#9AA0A3] transition active:scale-90"
            >
              +
            </button>
          </div>

          {inbox.length === 0 ? (
            <div className="mt-20 flex flex-col items-center gap-4 px-5">
              <span
                className="flex size-[76px] items-center justify-center gap-[5px] rounded-full border"
                style={{
                  background: taskColorMix("coral", 9),
                  borderColor: taskColorMix("coral", 30),
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: taskColor("coral") }}
                />
                <span
                  className="size-1.5 rounded-full opacity-60"
                  style={{ background: taskColor("coral") }}
                />
                <span
                  className="size-1.5 rounded-full opacity-30"
                  style={{ background: taskColor("coral") }}
                />
              </span>
              <span className="text-[15px] font-medium text-[#D7DADA]">
                Ongestructureerde gedachten
              </span>
              <span className="max-w-[260px] text-center text-[12.5px] leading-[1.55] text-[#6C7377]">
                Vang taken en gedachten zodra ze opkomen. Verplaats ze naar je
                tijdlijn wanneer je klaar bent om te plannen.
              </span>
            </div>
          ) : (
            <div className="mt-2.5">
              {inbox.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-white/5 px-0.5 py-3"
                >
                  <span
                    className="size-2 flex-none rounded-full"
                    style={{ background: taskColor(item.color) }}
                  />
                  <span className="flex-1 text-sm text-[#D7DADA]">
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openCreate({
                        taskId: item.id,
                        title: item.title,
                        color: item.color,
                      })
                    }
                    className="font-plex-mono rounded-2xl border border-white/15 bg-transparent px-3.5 py-[7px] text-[11px] text-[#9AA0A3] transition active:scale-95"
                  >
                    inplannen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Instellingen (placeholder) --- */}
      {planTab === "instellingen" && (
        <div className="flex flex-1 items-center justify-center">
          <span className="font-plex-mono text-xs text-[#3E4448]">
            instellingen — volgt later
          </span>
        </div>
      )}

      <BottomNav />

      {sheet && (
        <TaskSheet
          sheet={sheet}
          today={todayIso}
          onClose={() => setSheet(null)}
          onPatch={patchSheet}
          onSave={saveSheet}
          onDelete={deleteFromSheet}
        />
      )}
    </main>
  );

  function shiftWeek(days: number) {
    const d = new Date(sel);
    d.setDate(d.getDate() + days);
    setSelDate(isoDate(d));
  }

  function onGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = Math.round(y / MINUTE_PX / 15) * 15;
    const clamped = Math.max(0, Math.min(1425, raw));
    const p = (n: number) => String(n).padStart(2, "0");
    openCreate({ time: `${p(Math.floor(clamped / 60))}:${p(clamped % 60)}` });
  }
}
