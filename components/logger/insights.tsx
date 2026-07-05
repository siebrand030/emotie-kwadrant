import type { Checkin } from "@/lib/supabase/types";
import {
  QUADRANTS,
  colorForKey,
  factorSummary,
  quadrantColor,
  quadrantDef,
} from "@/lib/emotions";

/**
 * Inzichten-scherm van de emotie-logger: weekverdeling, dagdeel-matrix en
 * tijdlijn — alles afgeleid uit de check-ins (1-op-1 met legacy/app.js). Puur
 * read-only, dus een server-component.
 */

const DAY_NAMES = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAY_MS = 86400000;

const ms = (c: Checkin) => new Date(c.logged_at).getTime();
const fmtTime = (c: Checkin) =>
  new Date(c.logged_at).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

function dayLabel(t: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(t);
  dd.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dd.getTime()) / DAY_MS);
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Gisteren";
  return dd.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type TlItem = {
  time: string;
  color: string;
  label: string;
  detail: string;
  note: string;
  hasNote: boolean;
};
type TlDay = { k: string; label: string; items: TlItem[] };

export function Insights({ checkins }: { checkins: Checkin[] }) {
  // ---- deze week (gestapelde staven) ----
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(startOfToday.getDate() - i);
    const from = d.getTime();
    const to = from + DAY_MS;
    const counts: Record<string, number> = {};
    for (const c of checkins) {
      const t = ms(c);
      if (t >= from && t < to) counts[c.quadrant] = (counts[c.quadrant] || 0) + 1;
    }
    days.push({
      d: DAY_NAMES[d.getDay()],
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  }
  const maxTotal = Math.max(1, ...days.map((x) => x.total));
  const weekBars = days.map((x) => ({
    d: x.d,
    segs: QUADRANTS.filter((q) => x.counts[q.key]).map((q) => ({
      c: quadrantColor(q.hue),
      h: Math.max(5, Math.round((x.counts[q.key] / maxTotal) * 108)),
    })),
  }));

  // ---- per dagdeel (laatste 7 dagen) ----
  const weekStart = Date.now() - 7 * DAY_MS;
  const weekEntries = checkins.filter((c) => ms(c) >= weekStart);
  const parts = [
    { name: "Ochtend", from: 6, to: 12 },
    { name: "Middag", from: 12, to: 18 },
    { name: "Avond", from: 18, to: 24 },
    { name: "Nacht", from: 0, to: 6 },
  ];
  const dagdelen = parts.map((p) => ({
    name: p.name,
    cells: QUADRANTS.map((q) => {
      const n = weekEntries.filter((c) => {
        const hr = new Date(c.logged_at).getHours();
        return c.quadrant === q.key && hr >= p.from && hr < p.to;
      }).length;
      return {
        color: quadrantColor(q.hue),
        sz: n ? 8 + Math.min(n, 8) * 2 : 4,
        op: n ? 0.35 + Math.min(n / 6, 1) * 0.65 : 0.12,
      };
    }),
  }));

  // ---- tijdlijn (max ~7 dagen / 10 items per dag) ----
  const sorted = [...checkins].sort((a, b) => ms(b) - ms(a));
  const tlDays: TlDay[] = [];
  let cur: TlDay | null = null;
  for (const c of sorted) {
    const k = new Date(c.logged_at).toDateString();
    if (!cur || cur.k !== k) {
      if (tlDays.length >= 7) break;
      cur = { k, label: dayLabel(ms(c)), items: [] };
      tlDays.push(cur);
    }
    if (cur.items.length < 10) {
      cur.items.push({
        time: fmtTime(c),
        color: colorForKey(c.quadrant),
        label: c.emotion || quadrantDef(c.quadrant).label,
        detail: factorSummary(c),
        note: c.note || "",
        hasNote: !!(c.note && c.note.length),
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-7 pt-[34px] pb-6">
      {/* deze week */}
      <div className="font-plex-mono mb-6 text-[11.5px] text-[#565C60]">
        deze week
      </div>
      <div className="mb-2.5 flex h-[132px] max-w-[480px] items-end gap-2.5">
        {weekBars.map((wb, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end"
          >
            <div className="flex w-[14px] flex-col justify-end">
              {wb.segs.map((sg, j) => (
                <div
                  key={j}
                  className="mt-0.5 rounded-[3px]"
                  style={{ height: `${sg.h}px`, background: sg.c }}
                />
              ))}
            </div>
            <div className="font-plex-mono mt-[9px] text-[10px] text-[#565C60]">
              {wb.d}
            </div>
          </div>
        ))}
      </div>
      <div className="mb-[34px] flex flex-wrap gap-3">
        {QUADRANTS.map((q) => (
          <span
            key={q.key}
            className="flex items-center gap-1.5 text-[11px] text-[#8A9094]"
          >
            <span
              className="size-[7px] rounded-full"
              style={{ background: quadrantColor(q.hue) }}
            />
            {q.label}
          </span>
        ))}
      </div>

      {/* per dagdeel */}
      <div className="font-plex-mono mb-1 text-[11.5px] text-[#565C60]">
        per dagdeel
      </div>
      <div className="flex max-w-[480px] items-center gap-3 pt-2">
        <span className="w-[60px] flex-none" />
        {QUADRANTS.map((q) => (
          <span
            key={q.key}
            className="font-plex-mono flex-1 text-center text-[9.5px]"
            style={{ color: quadrantColor(q.hue) }}
          >
            {q.kort}
          </span>
        ))}
      </div>
      {dagdelen.map((dd) => (
        <div
          key={dd.name}
          className="flex max-w-[480px] items-center gap-3 border-b border-white/5 py-2.5"
        >
          <span className="font-plex-mono w-[60px] flex-none text-[10.5px] text-[#565C60]">
            {dd.name}
          </span>
          {dd.cells.map((cl, i) => (
            <span
              key={i}
              className="flex h-6 flex-1 items-center justify-center"
            >
              <span
                className="rounded-full"
                style={{
                  width: `${cl.sz}px`,
                  height: `${cl.sz}px`,
                  background: cl.color,
                  opacity: cl.op,
                }}
              />
            </span>
          ))}
        </div>
      ))}

      {/* tijdlijn */}
      <div className="font-plex-mono mt-[34px] mb-1.5 text-[11.5px] text-[#565C60]">
        tijdlijn
      </div>
      {checkins.length === 0 && (
        <div className="py-3.5 text-[13px] text-[#6C7377]">Nog geen logs.</div>
      )}
      {tlDays.map((day) => (
        <div key={day.k}>
          <div className="font-plex-mono mt-3.5 mb-0.5 text-[10.5px] uppercase tracking-[0.09em] text-[#565C60]">
            {day.label}
          </div>
          {day.items.map((it, i) => (
            <div
              key={i}
              className="max-w-[480px] border-b border-white/[0.04] py-2"
            >
              <div className="flex items-center gap-3">
                <span className="font-plex-mono w-[38px] flex-none text-[11px] text-[#6C7377]">
                  {it.time}
                </span>
                <span
                  className="size-[7px] flex-none rounded-full"
                  style={{ background: it.color }}
                />
                <span className="flex-1 text-[13px] text-[#C6CACB]">
                  {it.label}
                </span>
              </div>
              {it.detail && (
                <div className="font-plex-mono mt-[5px] ml-[50px] text-[11px] text-[#6C7377]">
                  {it.detail}
                </div>
              )}
              {it.hasNote && (
                <div className="mt-[5px] ml-[50px] text-[12px] italic leading-[1.45] text-[#8A9094]">
                  {it.note}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
