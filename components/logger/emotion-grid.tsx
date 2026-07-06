"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
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
// het midden zonder doorschieten.
const LOCK_SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;

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
  const planeRef = useRef<HTMLDivElement>(null);
  // Gecachete cel-nodes in CELLS-volgorde (DOM-volgorde == render-volgorde).
  const cellNodes = useRef<HTMLElement[] | null>(null);

  const [size, setSize] = useState(() => ({ w: frameRect.width, h: frameRect.height }));
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
  // Metrics via ref zodat de meet-functie stabiel blijft (geen re-creatie →
  // geen effect-loops).
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

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
  const focusName = useRef(initialCell.name);
  // Pas meten zodra de intro-zoom klaar is. Tijdens de zoom staat het rooster
  // klein én verschoven (groeit vanuit de knop), dus een meting zou daar de
  // verkeerde "gecentreerde" cel vinden én met een re-render de animatie
  // kunnen verstoren.
  const ready = useRef(false);

  // Per-cel schaal/opaciteit als losse motion values (één keer aangemaakt).
  // Worden imperatief gezet vanuit de meet-lus, dus geen React re-render/frame.
  const cellMV = useMemo(
    () => CELLS.map(() => ({ scale: motionValue(1), opacity: motionValue(1) })),
    [],
  );

  // DE KERN: meet uit de DOM welke cel écht het dichtst bij het scherm-midden
  // staat, en zet daar focus + schaal/opaciteit op. Puur wat op het scherm
  // staat — geen size/x/y-wiskunde, kan dus niet desyncen met wat je ziet.
  // Stabiel (leest alles uit refs), zodat het geen render-loops veroorzaakt.
  const measure = useCallback(() => {
    if (!ready.current) return;
    const wrap = wrapperRef.current;
    const plane = planeRef.current;
    if (!wrap || !plane) return;
    if (!cellNodes.current) {
      cellNodes.current = Array.from(
        plane.querySelectorAll<HTMLElement>("[data-name]"),
      );
    }
    const nodes = cellNodes.current;
    if (nodes.length !== CELLS.length) return;

    const wr = wrap.getBoundingClientRect();
    const wcx = wr.left + wr.width / 2;
    const wcy = wr.top + wr.height / 2;
    const m = metricsRef.current;
    const falloff = Math.max(m.pitchX, m.pitchY);

    let bestI = 0;
    let bestD = Infinity;
    const dists = new Array<number>(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      const d = Math.hypot(
        r.left + r.width / 2 - wcx,
        r.top + r.height / 2 - wcy,
      );
      dists[i] = d;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const t = Math.min(1, dists[i] / falloff);
      cellMV[i].scale.set(1 - t * 0.28);
      cellMV[i].opacity.set(1 - t * 0.65);
    }
    const name = CELLS[bestI].name;
    if (name !== focusName.current) {
      focusName.current = name;
      setSelected(name);
    }
  }, [cellMV]);

  // Meet mee terwijl het rooster beweegt (drag + snap-animatie).
  useMotionValueEvent(x, "change", measure);
  useMotionValueEvent(y, "change", measure);

  // Zet "ready" en doe de eerste meting zodra de intro-zoom klaar is. De
  // primaire trigger is onAnimationComplete; de timeout is een vangnet mocht
  // die ooit niet vuren.
  const markReady = useCallback(() => {
    if (ready.current) return;
    ready.current = true;
    measure();
  }, [measure]);

  useEffect(() => {
    const id = setTimeout(markReady, 420);
    return () => clearTimeout(id);
  }, [markReady]);

  // Effectieve schaal van het rooster op het scherm (intro-zoom zet 'm even
  // op < 1; daarna 1). Nodig om een gemeten visuele verschuiving terug te
  // rekenen naar de translate-eenheid van het vlak.
  const planeScale = useCallback(() => {
    const w = wrapperRef.current;
    if (!w || typeof window === "undefined") return 1;
    try {
      return new DOMMatrixReadOnly(getComputedStyle(w).transform).a || 1;
    } catch {
      return 1;
    }
  }, []);

  const snapNodeToCenter = useCallback(
    (node: HTMLElement) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      const s = planeScale();
      const dvx = wr.left + wr.width / 2 - (r.left + r.width / 2);
      const dvy = wr.top + wr.height / 2 - (r.top + r.height / 2);
      animate(x, x.get() + dvx / s, LOCK_SPRING);
      animate(y, y.get() + dvy / s, LOCK_SPRING);
    },
    [planeScale, x, y],
  );

  const nodeFor = useCallback((name: string) => {
    const idx = CELLS.findIndex((c) => c.name === name);
    return cellNodes.current?.[idx] ?? null;
  }, []);

  // Loslaten: land op de cel die op dat moment in het midden staat (DOM).
  const snapToFocused = useCallback(() => {
    interacting.current = false;
    const node = nodeFor(focusName.current);
    if (node) snapNodeToCenter(node);
  }, [nodeFor, snapNodeToCenter]);

  // Directe tik op een vakje: pak precies dát vakje (elementFromPoint) en
  // centreer het.
  const handleTap = useCallback(
    (_event: unknown, info: { point: { x: number; y: number } }) => {
      const target = document
        .elementFromPoint(info.point.x, info.point.y)
        ?.closest<HTMLElement>("[data-name]");
      if (!target) return;
      const name = target.getAttribute("data-name")!;
      focusName.current = name;
      setSelected(name);
      snapNodeToCenter(target);
    },
    [snapNodeToCenter],
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

  const introOrigin = useMemo(() => {
    if (!originRect) {
      return { originXPct: 50, originYPct: 40, initialScale: 0.2 };
    }
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
    <div
      ref={wrapperRef}
      className="absolute inset-0 z-[5] overflow-hidden bg-[#0B0C0D]"
      style={{
        transformOrigin: `${introOrigin.originXPct}% ${introOrigin.originYPct}%`,
        overscrollBehavior: "contain",
        // Pure-CSS inzoom (zie @keyframes introZoom) — immuun voor React
        // re-renders die een Framer-animatie zouden onderbreken.
        ["--intro-s" as string]: introOrigin.initialScale,
        animation: "introZoom 0.36s cubic-bezier(0.19,1,0.22,1) both",
      }}
      onAnimationEnd={markReady}
    >
      <button
        onClick={onBack}
        className="font-plex-mono absolute left-7 top-[calc(env(safe-area-inset-top)+14px)] z-10 px-0 py-2 pr-2 text-[13px] text-[#6C7377]"
      >
        ‹ terug
      </button>

      <motion.div
        ref={planeRef}
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
        dragMomentum={false}
        dragElastic={0.06}
        dragConstraints={dragConstraints}
        onDragStart={() => {
          interacting.current = true;
          markReady();
        }}
        onDragEnd={snapToFocused}
        onTap={handleTap}
      >
        {CELLS.map((cell, i) => {
          const hue = quadrantDef(cell.quadrant).hue;
          return (
            <motion.div
              key={cell.name}
              data-name={cell.name}
              className="absolute flex items-center justify-center rounded-[22px] p-3 text-center text-[15px] font-medium leading-[1.25]"
              style={{
                left: CONTENT_OFFSET + cell.col * metrics.pitchX,
                top: CONTENT_OFFSET + cell.row * metrics.pitchY,
                width: metrics.cellW,
                height: metrics.cellH,
                scale: cellMV[i].scale,
                opacity: cellMV[i].opacity,
                background: quadrantBg(hue, 0.09),
                border: `1px solid ${quadrantLine(hue)}`,
                color: colorForKey(cell.quadrant),
              }}
            >
              {cell.name}
            </motion.div>
          );
        })}
      </motion.div>

      <button
        onClick={() => onSelect(selected)}
        className="font-plex-mono absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] left-1/2 z-10 -translate-x-1/2 rounded-[22px] border border-white/20 px-[26px] py-2.5 text-[13px]"
        style={{ color: colorForKey(selectedQuadrant) }}
      >
        {selected} · verder
      </button>
    </div>
  );
}
