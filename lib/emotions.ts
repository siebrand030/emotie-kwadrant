import type { Checkin, FactorKey, Quadrant } from "./supabase/types";

/**
 * Domein-constanten van de emotie-logger, 1-op-1 overgenomen uit legacy/app.js.
 * De kwadrant-hues (25/150/290/220) komen overeen met --hue-* in
 * app/globals.css; kleuren zijn oklch(72% 0.085 <hue>).
 */

export interface QuadrantDef {
  key: Quadrant;
  label: string;
  kort: string;
  hue: number;
}

// Volgorde = rooster links→rechts, boven→onder (as verticaal aan/uit,
// horizontaal duw/trek).
export const QUADRANTS: QuadrantDef[] = [
  { key: "forceren", label: "Beuken", kort: "BEU", hue: 25 }, // aan + duw
  { key: "bouwen", label: "Bouwen", kort: "BOU", hue: 150 }, // aan + trek
  { key: "wegzakken", label: "Wegkwijnen", kort: "WEG", hue: 290 }, // uit + duw
  { key: "opladen", label: "Ontspannen", kort: "ONT", hue: 220 }, // uit + trek
];

const BY_KEY: Record<Quadrant, QuadrantDef> = Object.fromEntries(
  QUADRANTS.map((q) => [q.key, q]),
) as Record<Quadrant, QuadrantDef>;

export function quadrantDef(key: Quadrant): QuadrantDef {
  return BY_KEY[key];
}

// Laag 2: specifieke emoties per kwadrant. Elk kwadrant is zelf óók een
// mini-kwadrant: [linksboven, rechtsboven, linksonder, rechtsonder].
export const EMOTIONS: Record<Quadrant, string[]> = {
  forceren: ["Forceren", "Doorzetten", "Chaotisch", "Werkmodus"],
  bouwen: ["Actieve modus", "Flow", "Excited zacht", "Excited hard"],
  opladen: ["Volwaardig", "Actieve zelfwaardering", "Actieve ontspanning", "Opladen"],
  wegzakken: ["Zelfafwijzing", "Zelf struggle", "Verdoven", "Fantaseren"],
};

// Laag 3: factoren die de staat kunnen beïnvloeden. Schaal 1–5; null = niet ingesteld.
export const FACTORS: { key: FactorKey; label: string }[] = [
  { key: "slaap", label: "Slaap" },
  { key: "stress", label: "Stress" },
  { key: "eten", label: "Eten" },
  { key: "wiet", label: "Wiet" },
  { key: "alcohol", label: "Alcohol" },
  { key: "planning", label: "Planning" },
];

// Laag 4: principes + tools per staat (statisch/informatief, placeholders).
export const PRINCIPES: string[] = [
  "Erken de staat waar je in zit — hij geeft informatie.",
  "Je gedrag volgt uit je staat, niet andersom.",
  "Eén kleine, passende actie kan de staat verschuiven.",
];

export const TOOLS: { icon: string; label: string; sub: string }[] = [
  { icon: "📝", label: "Emotieregulatie-vragenlijst", sub: "kort invullen" },
  { icon: "📅", label: "Dagplanning maken", sub: "structuur aanbrengen" },
  { icon: "🧩", label: "Flow-structuur uitdenken", sub: "stap voor stap" },
  { icon: "⏱️", label: "Pauze-timer 20 min", sub: "even eruit" },
];

// ---- Kleur-helpers (oklch, alleen hue verschilt) ----
export function quadrantColor(hue: number): string {
  return `oklch(72% 0.085 ${hue})`;
}
export function quadrantBg(hue: number, alpha: number): string {
  return `oklch(72% 0.085 ${hue} / ${alpha})`;
}
export function quadrantLine(hue: number): string {
  return `oklch(72% 0.085 ${hue} / 0.3)`;
}
export function colorForKey(key: Quadrant): string {
  return quadrantColor(BY_KEY[key].hue);
}

// ---- Factoren op een check-in-rij uitlezen (factor_<key>-kolommen) ----
export function factorValue(checkin: Checkin, key: FactorKey): number | null {
  return checkin[`factor_${key}` as keyof Checkin] as number | null;
}

/** "slaap 4 · stress 2" — de ingevulde factoren als samenvatting (voor de tijdlijn). */
export function factorSummary(checkin: Checkin): string {
  return FACTORS.map((f) => {
    const v = factorValue(checkin, f.key);
    return v ? `${f.label.toLowerCase()} ${v}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}
