/** Merge/override query params onto a base path (drops empty/undefined). */
export function hrefWith(
  basePath: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | number | undefined>
): string {
  const merged: Record<string, string | number | undefined> = { ...current, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `${basePath}?${q}` : basePath;
}
