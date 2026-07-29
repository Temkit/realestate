import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { ProviderSort } from "@/lib/marketplace/public-queries";

const SORTS: { key: ProviderSort; fr: string; en: string }[] = [
  { key: "recommended", fr: "Recommandés", en: "Recommended" },
  { key: "rating", fr: "Mieux notés", en: "Top rated" },
  { key: "name", fr: "A–Z", en: "A–Z" },
  { key: "newest", fr: "Récents", en: "Newest" },
];

/** Sort selector rendered as filter-preserving links (no client JS). */
export function SortBar({
  locale,
  activeSort,
  hrefForSort,
  countLabel,
}: {
  locale: string;
  activeSort: ProviderSort;
  hrefForSort: (sort: ProviderSort) => string;
  countLabel?: string;
}) {
  const fr = locale !== "en";
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      {countLabel && <p className="text-sm text-muted-foreground">{countLabel}</p>}
      <div className="flex items-center gap-1.5 text-sm">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={hrefForSort(s.key)}
            className={`rounded-lg px-2.5 py-1 ${
              activeSort === s.key
                ? "bg-foreground/10 font-medium"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {fr ? s.fr : s.en}
          </Link>
        ))}
      </div>
    </div>
  );
}
