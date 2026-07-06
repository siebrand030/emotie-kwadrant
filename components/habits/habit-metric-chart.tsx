import type { HabitMetric } from "@/lib/supabase/types";

interface HabitMetricChartProps {
  metrics: HabitMetric[]; // oplopend op measured_on
  color?: string;
}

const WIDTH = 296;
const HEIGHT = 80;
const PAD = 10;

/** Lichte lijngrafiek van metric-metingen over tijd (bijv. graden externe
 * rotatie) — de belangrijkste motivator van de habits-module (§6). Geen
 * charting-library nodig voor één simpele lijn; puur inline SVG. */
export function HabitMetricChart({ metrics, color = "#8FBF8A" }: HabitMetricChartProps) {
  if (metrics.length === 0) {
    return (
      <p className="font-plex-mono text-[11.5px] text-[#565C60]">
        nog geen metingen
      </p>
    );
  }
  if (metrics.length === 1) {
    return (
      <p className="font-plex-mono text-[11.5px] text-[#8A9094]">
        eerste meting: {metrics[0].value}
      </p>
    );
  }

  const values = metrics.map((m) => m.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = metrics.map((m, i) => {
    const x = PAD + (i / (metrics.length - 1)) * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - ((m.value - min) / range) * (HEIGHT - PAD * 2);
    return { x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
      >
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
        ))}
      </svg>
      <div className="font-plex-mono flex justify-between text-[10.5px] text-[#565C60]">
        <span>{metrics[0].value}</span>
        <span>{metrics[metrics.length - 1].value}</span>
      </div>
    </div>
  );
}
