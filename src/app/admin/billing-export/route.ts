import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/marketplace/admin-auth";
import { getBillingForMonth } from "@/lib/marketplace/admin-queries";

/**
 * Monthly billing CSV (spec §5): billable dispatches × cpl per provider.
 * Route handlers don't inherit the (protected) layout guard — auth is
 * checked explicitly here.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return new Response("Invalid month (expected YYYY-MM)", { status: 400 });
  }

  const rows = await getBillingForMonth(month);
  const esc = (v: string | number | null) =>
    v === null ? "" : `"${String(v).replace(/"/g, '""')}"`;

  const csv = [
    "provider_id,provider_name,vat_number,plan,cpl_eur,billable_dispatches,amount_eur",
    ...rows.map((r) =>
      [
        r.provider_id,
        esc(r.provider_name),
        esc(r.vat_number),
        r.plan,
        r.cpl_cents === null ? "" : (r.cpl_cents / 100).toFixed(2),
        r.billable_dispatches,
        (r.amount_cents / 100).toFixed(2),
      ].join(",")
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="letz24-billing-${month}.csv"`,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
