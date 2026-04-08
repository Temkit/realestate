/**
 * Luxembourg number/currency formatting.
 * Luxembourg uses: 1.200.000,50 € (dot thousands, comma decimal)
 * We use 'de-LU' locale for Intl.NumberFormat.
 */

export function formatPrice(price: number, mode?: "rent" | "buy"): string {
  if (price === 0) return "";
  const formatted = new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  if (mode === "rent") return `${formatted}/mo`;
  return formatted;
}

export function formatPriceCompact(price: number, mode?: "rent" | "buy"): string {
  if (price === 0) return "";
  const formatted = new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
  if (mode === "rent") return `${formatted}/mo`;
  return formatted;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("de-LU").format(n);
}
