import { Clock } from "lucide-react";
import type { DayHours } from "@/lib/marketplace/hours";

/** Weekly opening-hours table with an open/closed status line. */
export function HoursTable({
  weekly,
  openNow,
  locale,
}: {
  weekly: DayHours[];
  openNow: boolean | null;
  locale: string;
}) {
  const fr = locale !== "en";
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4" />
          {fr ? "Horaires" : "Opening hours"}
        </h2>
        {openNow != null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${openNow ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}
          >
            {openNow ? (fr ? "Ouvert" : "Open now") : fr ? "Fermé" : "Closed"}
          </span>
        )}
      </div>
      <dl className="space-y-1 text-sm">
        {weekly.map((d) => (
          <div
            key={d.weekday}
            className={`flex justify-between gap-4 ${d.isToday ? "font-medium" : ""}`}
          >
            <dt className={d.isToday ? "" : "text-muted-foreground"}>{d.label}</dt>
            <dd className={d.ranges.length ? "" : "text-muted-foreground"}>
              {d.ranges.length ? d.ranges.join(", ") : fr ? "Fermé" : "Closed"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
