/** Tijd-helpers voor de dagplanner. Tijden zijn "HH:MM"-strings, duur in minuten. */

/** "HH:MM" → minuten sinds middernacht. */
export function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minuten sinds middernacht → "HH:MM" (wrapt netjes over 24u). */
export function minToTime(min: number): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return p(Math.floor(v / 60)) + ":" + p(v % 60);
}

/** Starttijd + duur → eindtijd. */
export function addMin(time: string, minutes: number): string {
  return minToTime(toMin(time) + minutes);
}

/** Duur in minuten → "30 min" / "1 uur" / "1 uur 30". */
export function fmtDur(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  if (r) return `${h} uur ${r}`;
  return h === 1 ? "1 uur" : `${h} uur`;
}

/** Postgres `time` ("HH:MM:SS") → "HH:MM". */
export function normalizeTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : time;
}

/** Datum → "YYYY-MM-DD" (lokale tijd). */
export function isoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Volgende kwartier vanaf nu, als "HH:MM" (default starttijd voor nieuwe taken). */
export function defaultStart(): string {
  const now = new Date();
  let m = now.getHours() * 60 + Math.ceil(now.getMinutes() / 15) * 15;
  if (m >= 1440) m = 1425;
  return minToTime(m);
}
