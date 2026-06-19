// Helfer rund um Monatsnavigation. Monat als String "YYYY-MM".

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Aktueller Monat als "YYYY-MM" (lokale Zeit). */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Prüft das Format "YYYY-MM" mit gültigem Monat 01–12. */
export function isValidMonth(m: string | undefined | null): m is string {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return false;
  const mo = Number(m.slice(5, 7));
  return mo >= 1 && mo <= 12;
}

/** Verschiebt einen Monat um `delta` Monate (z. B. -1 / +1) und liefert "YYYY-MM". */
export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Erster und letzter Tag eines Monats als "YYYY-MM-DD" (inklusive). */
export function monthBounds(m: string): { from: string; to: string } {
  const [y, mo] = m.split("-").map(Number);
  const lastDay = new Date(y, mo, 0).getDate();
  return {
    from: `${y}-${pad(mo)}-01`,
    to: `${y}-${pad(mo)}-${pad(lastDay)}`,
  };
}

/** Deutsches Label, z. B. "Juni 2026". */
export function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}
