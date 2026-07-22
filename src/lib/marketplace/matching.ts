/**
 * Lead → provider matching (spec §4).
 * 1. Active providers with the category AND commune in coverage (or '*').
 * 2. If < 3, widen with NEARBY_COMMUNES.
 * 3. Rank: plan weight → fewest dispatches last 7 days → newest signup.
 */

import { NEARBY_COMMUNES } from "@/lib/communes";
import { getMarketplaceDb } from "./db";

const MAX_DISPATCHES_PER_LEAD = 3;
const PLAN_WEIGHT: Record<string, number> = { pro: 2, starter: 1, free: 0 };

interface Candidate {
  id: number;
  email: string;
  name: string;
  plan: string;
  created_at: string;
  recentDispatches: number;
}

async function candidatesFor(
  categoryId: number,
  communes: string[] | null
): Promise<Candidate[]> {
  const db = getMarketplaceDb();
  if (!db) return [];

  let coverageClause = "";
  const args: (string | number)[] = [categoryId];
  if (communes && communes.length) {
    const placeholders = communes.map(() => "?").join(",");
    coverageClause = `AND p.id IN (
      SELECT provider_id FROM provider_coverage
      WHERE commune_slug = '*' OR commune_slug IN (${placeholders})
    )`;
    args.push(...communes);
  }

  const res = await db.execute({
    sql: `SELECT p.id, p.email, p.name, p.plan, p.created_at,
            (SELECT COUNT(*) FROM lead_dispatches d
             WHERE d.provider_id = p.id
               AND d.sent_at > datetime('now', '-7 days')) AS recent
          FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          WHERE pc.category_id = ? AND p.status = 'active' ${coverageClause}`,
    args,
  });

  return res.rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    name: String(r.name),
    plan: String(r.plan),
    created_at: String(r.created_at),
    recentDispatches: Number(r.recent),
  }));
}

export async function matchProviders(
  categoryId: number,
  communeSlug: string | null
): Promise<Candidate[]> {
  const candidates = await candidatesFor(
    categoryId,
    communeSlug ? [communeSlug] : null
  );

  // Widen to neighboring communes when thin
  if (communeSlug && candidates.length < MAX_DISPATCHES_PER_LEAD) {
    const nearby = NEARBY_COMMUNES[communeSlug] ?? [];
    if (nearby.length) {
      const widened = await candidatesFor(categoryId, [communeSlug, ...nearby]);
      const seen = new Set(candidates.map((c) => c.id));
      for (const c of widened) {
        if (!seen.has(c.id)) candidates.push(c);
      }
    }
  }

  candidates.sort(
    (a, b) =>
      (PLAN_WEIGHT[b.plan] ?? 0) - (PLAN_WEIGHT[a.plan] ?? 0) ||
      a.recentDispatches - b.recentDispatches ||
      b.created_at.localeCompare(a.created_at)
  );
  return candidates.slice(0, MAX_DISPATCHES_PER_LEAD);
}
