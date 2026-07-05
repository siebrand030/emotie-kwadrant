"use client";

import { useRef, useState } from "react";

/**
 * Factor-slider (laag 3): waarde 1–5, of null (= niet ingesteld). Sleep of tik
 * op de baan zet de waarde; helemaal naar links = 1 (nooit 0). 1-op-1 met de
 * slider uit legacy/app.js.
 */
interface FactorSliderProps {
  value: number | null;
  colorStr: string;
  onChange: (value: number) => void;
}

export function FactorSlider({ value, colorStr, onChange }: FactorSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function valueAt(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    let frac = (clientX - r.left) / r.width;
    frac = Math.max(0, Math.min(1, frac));
    return Math.max(1, Math.round(frac * 5)); // 1–5
  }

  const frac = value == null ? 0 : value / 5;

  return (
    <div className="px-[11px]">
      <div
        ref={trackRef}
        className="relative flex h-[22px] cursor-pointer touch-none items-center"
        onPointerDown={(e) => {
          setDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // setPointerCapture kan falen op sommige browsers; niet kritiek.
          }
          onChange(valueAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging) onChange(valueAt(e.clientX));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* baan */}
        <div className="pointer-events-none absolute inset-x-0 h-1 rounded-[2px] bg-white/10" />
        {/* 5 tikjes */}
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className="pointer-events-none absolute size-[3px] -translate-x-1/2 rounded-full bg-[rgba(255,255,255,0.22)]"
            style={{ left: `${(s / 5) * 100}%` }}
          />
        ))}
        {/* vulling */}
        <div
          className="pointer-events-none absolute left-0 h-1 rounded-[2px]"
          style={{
            width: `${frac * 100}%`,
            background: value == null ? "transparent" : colorStr,
          }}
        />
        {/* duim */}
        <div
          className="pointer-events-none absolute size-5 -translate-x-1/2 rounded-full shadow-[0_0_0_4px_#0B0C0D]"
          style={{
            left: `${frac * 100}%`,
            opacity: value == null ? 0 : 1,
            background: colorStr,
          }}
        />
      </div>
    </div>
  );
}
