"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Checkin, FactorKey, Quadrant } from "@/lib/supabase/types";
import {
  EMOTIONS,
  FACTORS,
  PRINCIPES,
  QUADRANTS,
  TOOLS,
  colorForKey,
  quadrantBg,
  quadrantColor,
  quadrantDef,
  quadrantLine,
} from "@/lib/emotions";
import {
  createCheckin,
  updateCheckin,
  type FactorValues,
} from "@/lib/checkins";
import { FactorSlider } from "./factor-slider";
import { HabitsToday } from "@/components/habits/habits-today";
import { HabitInsight } from "@/components/habits/habit-insight";
import { pickInsight } from "@/lib/habits";
import type { Habit, HabitLog, HabitMetric } from "@/lib/supabase/types";

type Step = "pick" | "factors" | "tools" | "habits" | "insight";

interface Flow {
  step: Step;
  quadrant: Quadrant;
  emotion: string | null;
  ts: number; // epoch ms — moment van de kwadrant-tik
  factors: FactorValues;
  note: string;
  savedId: string | null;
}

const emptyFactors = (): FactorValues => ({
  slaap: null,
  stress: null,
  eten: null,
  wiet: null,
  alcohol: null,
  planning: null,
});

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

interface EmotionLoggerProps {
  userId: string;
  initialCheckins: Checkin[];
  habits: Habit[];
  habitLogs: HabitLog[];
  habitMetrics: HabitMetric[];
}

export function EmotionLogger({
  userId,
  initialCheckins,
  habits,
  habitLogs,
  habitMetrics,
}: EmotionLoggerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [flow, setFlow] = useState<Flow | null>(null);
  // Gespiegelde habit-state: HabitsToday muteert dit onder de motorkap zodat
  // het afsluit-inzicht (stap "insight") met de actuele logs/metrics kan
  // rekenen i.p.v. de verouderde server-props.
  const [liveHabitLogs, setLiveHabitLogs] = useState<HabitLog[]>(habitLogs);
  const [liveHabitMetrics, setLiveHabitMetrics] = useState<HabitMetric[]>(habitMetrics);

  const today = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = checkins.filter(
    (c) => new Date(c.logged_at).getTime() >= startOfDay.getTime(),
  ).length;
  const todayCountStr =
    todayCount === 0
      ? "nog niets gelogd"
      : todayCount === 1
        ? "1 log vandaag"
        : `${todayCount} logs vandaag`;

  // ---- flow-navigatie ----
  function startFlow(quadrant: Quadrant) {
    setFlow({
      step: "pick",
      quadrant,
      emotion: null,
      ts: Date.now(),
      factors: emptyFactors(),
      note: "",
      savedId: null,
    });
  }
  function pickEmotion(name: string) {
    setFlow((f) => (f ? { ...f, emotion: name, step: "factors" } : f));
  }
  function back() {
    setFlow((f) => {
      if (!f) return f;
      if (f.step === "insight") return { ...f, step: "habits" };
      if (f.step === "habits") return { ...f, step: "tools" };
      if (f.step === "tools") return { ...f, step: "factors" };
      if (f.step === "factors") return { ...f, step: "pick" };
      return null;
    });
  }
  // Check-in is de drager: na de tools-stap gaat de flow door naar de
  // habits-stap in plaats van meteen af te sluiten (tenzij er geen actieve
  // habits zijn — dan is er niets te tonen).
  function advanceToHabitsOrFinish() {
    setFlow((f) => {
      if (!f) return f;
      return habits.length > 0 ? { ...f, step: "habits" } : null;
    });
  }
  // Na de habits-stap: precies één inzicht tonen (afsluitscherm), gebaseerd op
  // de actuele (gespiegelde) logs/metrics.
  function advanceToInsight() {
    setFlow((f) => (f ? { ...f, step: "insight" } : f));
  }
  function setFactor(key: FactorKey, value: number) {
    setFlow((f) => (f ? { ...f, factors: { ...f.factors, [key]: value } } : f));
  }

  // Factoren → tools: sla de check-in op (of werk 'm bij bij terug/vooruit) en
  // ga door. Optimistisch: we tonen tools meteen; opslaan gebeurt op de
  // achtergrond en de check-in verschijnt direct in de lijst (inzichten).
  async function saveAndAdvance(saveNote: boolean) {
    const f = flow;
    if (!f || !f.emotion) return;
    const note = saveNote ? f.note.trim() : "";
    setFlow({ ...f, note, step: "tools" });

    try {
      if (f.savedId) {
        const row = await updateCheckin(supabase, f.savedId, {
          factors: f.factors,
          note: note || null,
        });
        setCheckins((cs) => cs.map((c) => (c.id === row.id ? row : c)));
      } else {
        const row = await createCheckin(supabase, userId, {
          quadrant: f.quadrant,
          emotion: f.emotion,
          logged_at: new Date(f.ts).toISOString(),
          factors: f.factors,
          note: note || null,
        });
        setCheckins((cs) => [row, ...cs]);
        setFlow((cur) => (cur ? { ...cur, savedId: row.id } : cur));
      }
    } catch (e) {
      console.error("Check-in opslaan mislukt:", e);
    }
  }
  function finishFlow() {
    setFlow(null);
  }

  return (
    <>
      {/* ---------- Laag 1: kwadrant-rooster ---------- */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10 p-5">
        <div className="flex flex-col items-center gap-[7px]">
          <div className="font-plex-mono text-[11.5px] text-[#565C60]">{today}</div>
          <div className="font-plex-mono text-[10.5px] text-[#3E4448]">
            {todayCountStr}
          </div>
        </div>
        <div
          className="grid gap-[18px]"
          style={{
            gridTemplateColumns: "min(160px, 42vw) min(160px, 42vw)",
            gridTemplateRows: "min(160px, 42vw) min(160px, 42vw)",
          }}
        >
          {QUADRANTS.map((q) => (
            <button
              key={q.key}
              onClick={() => startFlow(q.key)}
              className="flex size-full flex-col items-center justify-center gap-1.5 rounded-full px-[18px] transition active:scale-[0.96]"
              style={{
                background: quadrantBg(q.hue, 0.09),
                border: `1px solid ${quadrantLine(q.hue)}`,
              }}
            >
              <span
                className="text-[17px] font-medium"
                style={{ color: quadrantColor(q.hue) }}
              >
                {q.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Flow-overlays ---------- */}
      {flow && flow.step === "pick" && (
        <Overlay onBack={back}>
          <OverlayHead
            color={colorForKey(flow.quadrant)}
            title={quadrantDef(flow.quadrant).label}
            sub="waar zit je nu?"
          />
          <div
            className="mt-[34px] grid gap-4"
            style={{
              gridTemplateColumns: "min(160px, 42vw) min(160px, 42vw)",
              gridTemplateRows: "min(120px, 34vw) min(120px, 34vw)",
            }}
          >
            {EMOTIONS[flow.quadrant].map((name) => (
              <button
                key={name}
                onClick={() => pickEmotion(name)}
                className="flex size-full items-center justify-center rounded-[22px] p-3 text-center text-[15px] font-medium leading-[1.25] transition active:scale-[0.97]"
                style={{
                  background: quadrantBg(quadrantDef(flow.quadrant).hue, 0.09),
                  border: `1px solid ${quadrantLine(quadrantDef(flow.quadrant).hue)}`,
                  color: colorForKey(flow.quadrant),
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {flow && flow.step === "factors" && (
        <Overlay onBack={back}>
          <OverlayHead
            color={colorForKey(flow.quadrant)}
            title={flow.emotion ?? quadrantDef(flow.quadrant).label}
            sub={`${quadrantDef(flow.quadrant).label.toLowerCase()} · ${fmtTime(flow.ts)}`}
          />
          <div className="mt-[30px] flex w-full max-w-[340px] flex-col gap-[22px]">
            {FACTORS.map((f) => (
              <div key={f.key} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-[#C6CACB]">
                    {f.label}
                  </span>
                  <span className="font-plex-mono min-w-4 text-right text-[13px] text-[#8A9094]">
                    {flow.factors[f.key] ?? "–"}
                  </span>
                </div>
                <FactorSlider
                  value={flow.factors[f.key]}
                  colorStr={colorForKey(flow.quadrant)}
                  onChange={(v) => setFactor(f.key, v)}
                />
              </div>
            ))}
          </div>
          <input
            value={flow.note}
            onChange={(e) =>
              setFlow((cur) => (cur ? { ...cur, note: e.target.value } : cur))
            }
            placeholder="notitie (optioneel)"
            className="my-[34px] w-full max-w-[340px] border-b border-white/10 bg-transparent px-0.5 py-2.5 text-center text-[14px] text-[#E9EBEA] outline-none placeholder:text-[#565C60]"
          />
          <div className="flex gap-[30px]">
            <button
              onClick={() => saveAndAdvance(false)}
              className="font-plex-mono p-2.5 text-[13px] text-[#6C7377]"
            >
              overslaan
            </button>
            <button
              onClick={() => saveAndAdvance(true)}
              className="font-plex-mono rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px] text-[#E9EBEA]"
            >
              opslaan
            </button>
          </div>
        </Overlay>
      )}

      {flow && flow.step === "tools" && (
        <Overlay onBack={back}>
          <OverlayHead
            color={colorForKey(flow.quadrant)}
            title={flow.emotion ?? quadrantDef(flow.quadrant).label}
            sub="wat past bij deze staat"
          />
          <div className="mt-[30px] w-full max-w-[340px]">
            <div className="font-plex-mono mb-3.5 text-[11.5px] text-[#565C60]">
              principes
            </div>
            {PRINCIPES.map((p) => (
              <div key={p} className="flex items-start gap-[11px] py-2">
                <span
                  className="mt-[7px] size-1.5 flex-none rounded-full"
                  style={{ background: colorForKey(flow.quadrant) }}
                />
                <span className="text-[14px] leading-[1.45] text-[#C6CACB]">
                  {p}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-[30px] w-full max-w-[340px]">
            <div className="font-plex-mono mb-3.5 text-[11.5px] text-[#565C60]">
              tools
            </div>
            <div className="flex flex-col gap-3">
              {TOOLS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left transition active:scale-[0.985]"
                >
                  <span
                    className="flex size-10 flex-none items-center justify-center rounded-xl text-[20px]"
                    style={{ background: quadrantBg(quadrantDef(flow.quadrant).hue, 0.14) }}
                  >
                    {t.icon}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-medium text-[#E9EBEA]">
                      {t.label}
                    </span>
                    <span className="font-plex-mono text-[11px] text-[#6C7377]">
                      {t.sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-9 flex gap-[30px]">
            <button
              onClick={advanceToHabitsOrFinish}
              className="font-plex-mono p-2.5 text-[13px] text-[#6C7377]"
            >
              overslaan
            </button>
            <button
              onClick={advanceToHabitsOrFinish}
              className="font-plex-mono rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px] text-[#E9EBEA]"
            >
              klaar
            </button>
          </div>
        </Overlay>
      )}

      {flow && flow.step === "habits" && (
        <Overlay onBack={back}>
          <OverlayHead
            color="#8FBF8A"
            title="Habits vandaag"
            sub="registreren is de motivator"
          />
          <div className="mt-[30px] w-full flex flex-1 flex-col items-center">
            <HabitsToday
              userId={userId}
              habits={habits}
              initialLogs={liveHabitLogs}
              initialMetrics={liveHabitMetrics}
              onDone={advanceToInsight}
              onLogsChange={setLiveHabitLogs}
              onMetricsChange={setLiveHabitMetrics}
            />
          </div>
        </Overlay>
      )}

      {flow && flow.step === "insight" && (
        <Overlay onBack={back}>
          <OverlayHead color="#8FBF8A" title="Klaar" sub="tot morgen" />
          <div className="mt-[30px] w-full max-w-[340px]">
            <HabitInsight
              insight={pickInsight(habits, liveHabitLogs, liveHabitMetrics)}
            />
          </div>
          <button
            onClick={finishFlow}
            className="font-plex-mono mt-9 rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px] text-[#E9EBEA]"
          >
            klaar
          </button>
        </Overlay>
      )}
    </>
  );
}

/** Fullscreen-overlay met terug-knop (gedeeld door de flow-schermen). */
function Overlay({
  onBack,
  children,
}: {
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[5] flex flex-col items-center overflow-y-auto bg-[#0B0C0D] px-7 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+28px)] [animation:stilfade_0.35s_ease-out]">
      <button
        onClick={onBack}
        className="font-plex-mono self-start px-0 py-2 pr-2 text-[13px] text-[#6C7377]"
      >
        ‹ terug
      </button>
      {children}
    </div>
  );
}

/** Kop met gekleurde dot + titel + subtitel (gedeeld door de flow-schermen). */
function OverlayHead({
  color,
  title,
  sub,
}: {
  color: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="mb-[18px] size-[14px] rounded-full"
        style={{ background: color }}
      />
      <div className="mb-1.5 text-[24px] font-medium" style={{ color }}>
        {title}
      </div>
      <div className="font-plex-mono text-[12px] text-[#6C7377]">{sub}</div>
    </div>
  );
}
