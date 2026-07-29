/**
 * Opening-hours helpers built on the `opening_hours` library (OSM syntax).
 * Everything fails soft: malformed strings return null rather than throwing,
 * so a bad OSM value never breaks a page.
 */

import OpeningHours from "opening_hours";

export function isOpenNow(oh: string | null): boolean | null {
  if (!oh) return null;
  try {
    return new OpeningHours(oh).getState(new Date());
  } catch {
    return null;
  }
}

export interface DayHours {
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  label: string;
  ranges: string[]; // e.g. ["09:00–12:00", "14:00–18:00"]; empty = closed
  isToday: boolean;
}

const DAY_LABELS: Record<string, string[]> = {
  fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

function hhmm(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Luxembourg",
  });
}

/** A Monday-first weekly table for the current week, or null if unparseable. */
export function weeklyHours(oh: string | null, locale: string): DayHours[] | null {
  if (!oh) return null;
  let parsed: OpeningHours;
  try {
    parsed = new OpeningHours(oh);
  } catch {
    return null;
  }
  const labels = DAY_LABELS[locale === "en" ? "en" : "fr"];

  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayIdx);
  monday.setHours(0, 0, 0, 0);

  const days: DayHours[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(monday);
    dayStart.setDate(monday.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    let ranges: string[] = [];
    try {
      ranges = parsed
        .getOpenIntervals(dayStart, dayEnd)
        .map(([from, to]) => `${hhmm(from)}–${hhmm(to)}`);
    } catch {
      ranges = [];
    }
    days.push({ weekday: i, label: labels[i], ranges, isToday: i === todayIdx });
  }
  return days;
}
