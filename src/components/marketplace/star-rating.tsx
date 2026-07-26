import { Star } from "lucide-react";

/** Read-only star display for an average rating (supports halves visually). */
export function StarRating({
  value,
  count,
  size = 16,
  showValue = true,
  className = "",
}: {
  value: number | null;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  if (value == null) return null;
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="inline-flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={i < full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
          />
        ))}
      </span>
      {showValue && <span className="text-sm font-medium">{value.toFixed(1)}</span>}
      {count != null && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </span>
  );
}
