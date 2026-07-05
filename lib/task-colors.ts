import type { TaskColor } from "./supabase/types";

/**
 * Rendering-helpers voor de 8 taakkleuren. De basiskleuren staan als CSS-vars
 * in app/globals.css (--task-<naam>); tints/lijnen worden hier met color-mix
 * afgeleid, zodat we per taak een alpha-variant krijgen zonder de hue te
 * hardcoden. Spiegelt col()/colA() uit het Claude Design-prototype.
 */
export function taskColor(color: TaskColor): string {
  return `var(--task-${color})`;
}

/** Taakkleur op een percentage dekking (rest transparant). */
export function taskColorMix(color: TaskColor, percent: number): string {
  return `color-mix(in oklab, var(--task-${color}) ${percent}%, transparent)`;
}
