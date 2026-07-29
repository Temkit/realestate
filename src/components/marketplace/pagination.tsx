import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Windowed pagination as links (no client JS). Renders nothing for ≤1 page. */
export function Pagination({
  page,
  pageCount,
  hrefForPage,
  locale,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  locale: string;
}) {
  if (pageCount <= 1) return null;
  const fr = locale !== "en";

  // Window of up to 5 page numbers around the current page.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  const cell =
    "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm";

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-1.5"
      aria-label={fr ? "Pagination" : "Pagination"}
    >
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={`${cell} hover:bg-muted`} aria-label={fr ? "Précédent" : "Previous"}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${cell} opacity-40`} aria-disabled>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {start > 1 && (
        <>
          <Link href={hrefForPage(1)} className={`${cell} hover:bg-muted`}>1</Link>
          <span className="px-1 text-muted-foreground">…</span>
        </>
      )}

      {nums.map((n) => (
        <Link
          key={n}
          href={hrefForPage(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${cell} ${n === page ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}
        >
          {n}
        </Link>
      ))}

      {end < pageCount && (
        <>
          <span className="px-1 text-muted-foreground">…</span>
          <Link href={hrefForPage(pageCount)} className={`${cell} hover:bg-muted`}>{pageCount}</Link>
        </>
      )}

      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={`${cell} hover:bg-muted`} aria-label={fr ? "Suivant" : "Next"}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${cell} opacity-40`} aria-disabled>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
