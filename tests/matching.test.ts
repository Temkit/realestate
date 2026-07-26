import { describe, it, expect } from "vitest";
import { matchProviders } from "@/lib/marketplace/matching";
import { NEARBY_COMMUNES } from "@/lib/communes";
import {
  addCoverage,
  categoryId,
  insertProvider,
  linkCategory,
  testDb,
} from "./helpers";

const db = testDb();

describe("matchProviders — ranking & caps", () => {
  it("ranks by plan weight then caps at 3", async () => {
    // Dedicated category so no other test's providers pollute the candidate set
    const cat = await categoryId(db, "artisans", "roofer");
    const commune = "wiltz";

    const ids: Record<string, number> = {};
    for (const plan of ["free", "starter", "pro", "free"]) {
      const id = await insertProvider(db, { plan });
      await linkCategory(db, id, cat);
      await addCoverage(db, id, commune);
      ids[`${plan}-${id}`] = id;
    }

    const result = await matchProviders(cat, commune);
    expect(result).toHaveLength(3);
    // pro first, starter second (plan weight pro=2 > starter=1 > free=0)
    expect(result[0].plan).toBe("pro");
    expect(result[1].plan).toBe("starter");
  });

  it("only returns active providers", async () => {
    const cat = await categoryId(db, "artisans", "locksmith");
    const active = await insertProvider(db, { status: "active" });
    const paused = await insertProvider(db, { status: "paused" });
    for (const id of [active, paused]) {
      await linkCategory(db, id, cat);
      await addCoverage(db, id, "diekirch");
    }
    const result = await matchProviders(cat, "diekirch");
    const returnedIds = result.map((r) => r.id);
    expect(returnedIds).toContain(active);
    expect(returnedIds).not.toContain(paused);
  });
});

describe("matchProviders — commune coverage & widening", () => {
  it("includes providers covering a neighboring commune", async () => {
    const cat = await categoryId(db, "artisans", "painter");
    // Find X whose neighbor list contains a covered commune C
    const [x, neighbors] = Object.entries(NEARBY_COMMUNES).find(
      ([, n]) => n.length > 0
    )!;
    const covered = neighbors[0];

    const near = await insertProvider(db);
    await linkCategory(db, near, cat);
    await addCoverage(db, near, covered); // covers a NEIGHBOR of x, not x itself

    const result = await matchProviders(cat, x);
    expect(result.map((r) => r.id)).toContain(near);
  });

  it("excludes a provider covering an unrelated commune", async () => {
    const cat = await categoryId(db, "artisans", "heating");
    const [x, neighbors] = Object.entries(NEARBY_COMMUNES).find(
      ([, n]) => n.length > 0
    )!;
    // Pick a commune that is neither x nor any neighbor of x
    const far = Object.keys(NEARBY_COMMUNES).find(
      (c) => c !== x && !neighbors.includes(c)
    )!;

    const provider = await insertProvider(db);
    await linkCategory(db, provider, cat);
    await addCoverage(db, provider, far);

    const result = await matchProviders(cat, x);
    expect(result.map((r) => r.id)).not.toContain(provider);
  });

  it("matches wildcard '*' coverage regardless of commune", async () => {
    const cat = await categoryId(db, "cleaning", "office-cleaning");
    const provider = await insertProvider(db);
    await linkCategory(db, provider, cat);
    await addCoverage(db, provider, "*");
    const result = await matchProviders(cat, "troisvierges");
    expect(result.map((r) => r.id)).toContain(provider);
  });
});
