"use client";

import { useRef, useState } from "react";

/**
 * Factor-slider (laag 3): waarde 1–5, of null (= niet ingesteld). 5 gelijke
 * vakjes, elk over de volle breedte klikbaar; slepen erover werkt ook.
 */
interface FactorSliderProps {
  value: number | null;
  colorStr: string;
  onChange: (value: number) => void;
}

const STEPS = [1, 2, 3, 4, 5];

export function FactorSlider({ value, colorStr, onChange }: FactorSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function valueAt(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.min(5, Math.floor(frac * 5) + 1);
  }

  return (
    <div
      ref={trackRef}
      className="flex h-[22px] touch-none gap-[3px]"
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
      {STEPS.map((s) => {
        const active = value != null && s <= value;
        return (
          <div
            key={s}
            className="h-full flex-1 cursor-pointer rounded-[4px] transition-colors"
            style={{ background: active ? colorStr : "rgba(255,255,255,0.10)" }}
          />
        );
      })}
    </div>
  );
}
