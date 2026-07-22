/**
 * Targeted ISR revalidation for marketplace public pages.
 * The public routes share ISR config with the immo pages (24h), so admin
 * mutations revalidate the affected marketplace paths explicitly — never
 * immo paths (regenerating those would re-run the paid search pipeline).
 *
 * Featured communes (the 12 in COMMUNES) are revalidated eagerly; other
 * commune pages refresh within the normal 24h window.
 */

import { revalidatePath } from "next/cache";
import { COMMUNES } from "@/lib/seo/slugs";
import { listCategories, listVerticals } from "./queries";

const LOCALES = ["fr", "en"];

export async function revalidateVerticalPaths(verticalId: number): Promise<void> {
  const [verticals, categories] = await Promise.all([
    listVerticals(),
    listCategories(),
  ]);
  const vertical = verticals.find((v) => v.id === verticalId);
  if (!vertical) return;
  const cats = categories.filter((c) => c.vertical_id === verticalId);

  for (const locale of LOCALES) {
    revalidatePath(`/${locale}/${vertical.slug}`);
    for (const c of cats) {
      revalidatePath(`/${locale}/${vertical.slug}/${c.slug}`);
      for (const commune of COMMUNES) {
        revalidatePath(`/${locale}/${vertical.slug}/${c.slug}/${commune.slug}`);
      }
    }
  }
}

/** Revalidate every vertical a provider belongs to (by its category ids). */
export async function revalidateProviderPaths(categoryIds: number[]): Promise<void> {
  if (!categoryIds.length) return;
  const categories = await listCategories();
  const verticalIds = new Set(
    categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.vertical_id)
  );
  for (const vid of verticalIds) {
    await revalidateVerticalPaths(vid);
  }
}
