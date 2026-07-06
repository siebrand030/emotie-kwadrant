"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { Quadrant } from "@/lib/supabase/types";
import {
  colorForKey,
  emotionGridPositions,
  quadrantBg,
  quadrantDef,
  quadrantLine,
  type EmotionCellPos,
} from "@/lib/emotions";

// Alle 16 emoties op hun vaste plek in het doorlopende 4x4-rooster (laag 2).
// Zuivere/statische data — één keer berekend, niet per instance.
const CELLS = emotionGridPositions();

const GAP = 14;
const CONTENT_OFFSET = 900; // overscan van de drag-hit-catcher; valt algebraïsch weg
// Zachte, kritisch gedempte veer (damping ≈ 2·√stiffness) — landt vloeiend op
// het midden zonder doorschieten of "yank".
const LOCK_SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

interface Metrics {
  cellW: number;
  cellH: number;
  pitchX: number;
  pitchY: number;
}

function computeMetrics(containerW: number): Metrics {
  const cellW = Math.max(132, Math.min(176, containerW * 0.4));
  const cellH = cellW * 0.75; // zelfde 4:3-verhouding als het oude tegeltje
  return { cellW, cellH, pitchX: cellW + GAP, pitchY: cellH + GAP };
}

function findCell(quadrant: Quadrant, name: string | null): EmotionCellPos {
  return (
    CELLS.find((c) => c.name === name) ??
    CELLS.find((c) => c.quadrant === quadrant)!
  );
}

interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface EmotionGridProps {
  initialQuadrant: Quadrant;
  initialEmotion: string | null;
  originRect: OriginRect | null;
  frameRect: OriginRect;
  onBack: () => void;
  onSelect: (name: string) => void;
}

export function EmotionGrid({
  initialQuadrant,
  initialEmotion,
  originRect,
  frameRect,
  onBack,
  onSelect,
}: EmotionGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // frameRect is de rect van <main> (het app-frame), niet het browservenster
  // — op desktop staat dat frame gecentreerd en smaller (mx-auto max-w-md).
  const [size, setSize] = useState(() => ({ w: frameRect.width, h: frameRect.height }));
  // Terwijl er actief gesleept wordt geen resize-reflow doorlaten: op mobiel
  // klapt de adresbalk soms in/uit → de wrapper verandert van hoogte → de
  // drag-constraints zouden herberekend worden en het rooster met een ruk in
  // de nieuwe grenzen worden getrokken (voelde aan als willekeurig "slurpen").
  const interacting = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (interacting.current) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = useMemo(() => computeMetrics(size.w), [size.w]);

  const centerOffsetFor = useCallback(
    (col: number, row: number) => {
      const cellCenterX = col * metrics.pitchX + metrics.cellW / 2;
      const cellCenterY = row * metrics.pitchY + metrics.cellH / 2;
      return { x: size.w / 2 - cellCenterX, y: size.h / 2 - cellCenterY };
    },
    [metrics, size.w, size.h],
  );

  const initialCell = findCell(initialQuadrant, initialEmotion);
  const [initialOffset] = useState(() => {
    const m = computeMetrics(frameRect.width);
    const cellCenterX = initialCell.col * m.pitchX + m.cellW / 2;
    const cellCenterY = initialCell.row * m.pitchY + m.cellH / 2;
    return { x: frameRect.width / 2 - cellCenterX, y: frameRect.height / 2 - cellCenterY };
  });

  const x = useMotionValue(initialOffset.x);
  const y = useMotionValue(initialOffset.y);
  const [selected, setSelected] = useState(initialCell.name);

  // Welke cel ligt op dit moment het dichtst bij het midden van het viewport?
  // (Puur uit de huidige x/y afgeleid — geen momentum, dus dit ís waar je nu
  // staat, niet waar een fling je heen gooit.)
  const nearestCell = useCallback((): EmotionCellPos | undefined => {
    const targetContentX = size.w / 2 - x.get();
    const targetContentY = size.h / 2 - y.get();
    const col = clamp(
      Math.round((targetContentX - metrics.cellW / 2) / metrics.pitchX),
      0,
      3,
    );
    const row = clamp(
      Math.round((targetContentY - metrics.cellH / 2) / metrics.pitchY),
      0,
      3,
    );
    return CELLS.find((c) => c.col === col && c.row === row);
  }, [metrics, size, x, y]);

  // Zet de selectie + snapt exact naar het midden (gedeeld door tik + loslaten).
  const lockCell = useCallback(
    (cell: EmotionCellPos) => {
      setSelected(cell.name);
      const target = centerOffsetFor(cell.col, cell.row);
      animate(x, target.x, LOCK_SPRING);
      animate(y, target.y, LOCK_SPRING);
    },
    [centerOffsetFor, x, y],
  );

  // Tijdens het slepen: laat het label meelopen met de cel die nu het dichtst
  // bij het midden ligt — puur visueel, verplaatst het rooster niet.
  const trackNearest = useCallback(() => {
    const cell = nearestCell();
    if (cell) setSelected((prev) => (prev === cell.name ? prev : cell.name));
  }, [nearestCell]);

  // Bij loslaten: land netjes op de cel die op dát moment voor je neus staat.
  const snapToNearest = useCallback(() => {
    interacting.current = false;
    const cell = nearestCell();
    if (cell) lockCell(cell);
  }, [nearestCell, lockCell]);

  // Direct tikken op een vakje selecteert + centreert het meteen. Zit op de
  // drag-hit-catcher zelf (niet op losse cellen) omdat Framer tap+drag alleen
  // betrouwbaar op hetzelfde element arbitreert.
  const handleGridTap = useCallback(
    (_event: unknown, info: { point: { x: number; y: number } }) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const contentX = info.point.x - rect.left - x.get();
      const contentY = info.point.y - rect.top - y.get();
      const col = clamp(
        Math.round((contentX - metrics.cellW / 2) / metrics.pitchX),
        0,
        3,
      );
      const row = clamp(
        Math.round((contentY - metrics.cellH / 2) / metrics.pitchY),
        0,
        3,
      );
      const cell = CELLS.find((c) => c.col === col && c.row === row);
      if (cell) lockCell(cell);
    },
    [lockCell, metrics, x, y],
  );

  const dragConstraints = useMemo(
    () => ({
      right: centerOffsetFor(0, 0).x,
      left: centerOffsetFor(3, 0).x,
      bottom: centerOffsetFor(0, 0).y,
      top: centerOffsetFor(0, 3).y,
    }),
    [centerOffsetFor],
  );

  const falloffRadius = Math.max(metrics.pitchX, metrics.pitchY);

  const introOrigin = useMemo(() => {
    if (!originRect) {
      return { originXPct: 50, originYPct: 40, initialScale: 0.2 };
    }
    // transform-origin is relatief aan de eigen box van de wrapper (== het
    // app-frame), dus tegen frameRect afzetten — niet tegen het venster.
    const cx = originRect.left + originRect.width / 2 - frameRect.left;
    const cy = originRect.top + originRect.height / 2 - frameRect.top;
    const rawScale = Math.max(
      originRect.width / frameRect.width,
      originRect.height / frameRect.height,
    );
    return {
      originXPct: (cx / frameRect.width) * 100,
      originYPct: (cy / frameRect.height) * 100,
      initialScale: Math.min(0.5, Math.max(0.15, rawScale)),
    };
  }, [originRect, frameRect]);

  const selectedQuadrant =
    CELLS.find((c) => c.name === selected)?.quadrant ?? initialQuadrant;

  return (
    <motion.div
      ref={wrapperRef}
      className="absolute inset-0 z-[5] overflow-hidden bg-[#0B0C0D]"
      style={{
        transformOrigin: `${introOrigin.originXPct}% ${introOrigin.originYPct}%`,
        overscrollBehavior: "contain",
      }}
      initial={{ scale: introOrigin.initialScale, opacity: 0, borderRadius: 9999 }}
      animate={{ scale: 1, opacity: 1, borderRadius: 0 }}
      transition={{ duration: 0.36, ease: [0.19, 1, 0.22, 1] }}
    >
      <button
        onClick={onBack}
        className="font-plex-mono absolute left-7 top-[calc(env(safe-area-inset-top)+14px)] z-10 px-0 py-2 pr-2 text-[13px] text-[#6C7377]"
      >
        ‹ terug
      </button>

      <motion.div
        className="absolute"
        style={{
          left: -CONTENT_OFFSET,
          top: -CONTENT_OFFSET,
          right: -CONTENT_OFFSET,
          bottom: -CONTENT_OFFSET,
          x,
          y,
          touchAction: "none",
        }}
        drag
        // Geen momentum: het rooster volgt de vinger 1-op-1 en stopt waar je
        // loslaat — daarna landt snapToNearest netjes op de dichtstbijzijnde
        // cel. Momentum gooide het rooster eerder meerdere cellen door.
        dragMomentum={false}
        dragElastic={0.06}
        dragConstraints={dragConstraints}
        onDragStart={() => {
          interacting.current = true;
        }}
        onDrag={trackNearest}
        onDragEnd={snapToNearest}
        onTap={handleGridTap}
      >
        {CELLS.map((cell) => (
          <EmotionCell
            key={cell.name}
            cell={cell}
            metrics={metrics}
            containerW={size.w}
            containerH={size.h}
            x={x}
            y={y}
            falloffRadius={falloffRadius}
            contentOffset={CONTENT_OFFSET}
          />
        ))}
      </motion.div>

      <button
        onClick={() => onSelect(selected)}
        className="font-plex-mono absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] left-1/2 z-10 -translate-x-1/2 rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px]"
        style={{ color: colorForKey(selectedQuadrant) }}
      >
        {selected} · verder
      </button>
    </motion.div>
  );
}

interface EmotionCellProps {
  cell: EmotionCellPos;
  metrics: Metrics;
  containerW: number;
  containerH: number;
  x: MotionValue<number>;
  y: MotionValue<number>;
  falloffRadius: number;
  contentOffset: number;
}

function EmotionCell({
  cell,
  metrics,
  containerW,
  containerH,
  x,
  y,
  falloffRadius,
  contentOffset,
}: EmotionCellProps) {
  const cellCenterX = cell.col * metrics.pitchX + metrics.cellW / 2;
  const cellCenterY = cell.row * metrics.pitchY + metrics.cellH / 2;

  const distance = useCallback(
    (xv: number, yv: number) =>
      Math.hypot(xv + cellCenterX - containerW / 2, yv + cellCenterY - containerH / 2),
    [cellCenterX, cellCenterY, containerW, containerH],
  );

  const scale = useTransform([x, y], ([xv, yv]: number[]) => {
    const t = Math.min(1, distance(xv, yv) / falloffRadius);
    return 1 - t * 0.28;
  });
  const opacity = useTransform([x, y], ([xv, yv]: number[]) => {
    const t = Math.min(1, distance(xv, yv) / falloffRadius);
    return 1 - t * 0.65;
  });

  const hue = quadrantDef(cell.quadrant).hue;

  return (
    <motion.div
      className="absolute flex items-center justify-center rounded-[22px] p-3 text-center text-[15px] font-medium leading-[1.25]"
      style={{
        left: contentOffset + cell.col * metrics.pitchX,
        top: contentOffset + cell.row * metrics.pitchY,
        width: metrics.cellW,
        height: metrics.cellH,
        scale,
        opacity,
        background: quadrantBg(hue, 0.09),
        border: `1px solid ${quadrantLine(hue)}`,
        color: colorForKey(cell.quadrant),
      }}
    >
      {cell.name}
    </motion.div>
  );
}
