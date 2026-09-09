export const runtime = "nodejs";

import Papa from "papaparse";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";

export async function GET(req) {
  const session = requireRole(req, ["admin"]);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT
         name,
         email,
         phone,
         year,
         program,
         payment_status,
         CASE WHEN whatsapp_sent = 1 THEN 'sent' ELSE 'not_sent' END AS whatsapp_status,
         CASE WHEN email_sent    = 1 THEN 'sent' ELSE 'not_sent' END AS email_status,
         CASE WHEN food_claimed  = 1 THEN 'collected' ELSE 'not_collected' END AS food_status
       FROM app.participants
       ORDER BY created_at DESC`
    )
    .all();

  // Prefix phone with a tab character so Excel keeps it as text (prevents
  // scientific-notation display like 9.35E+09 for 10-digit mobile numbers).
  const formatted = rows.map((r) => ({
    ...r,
    phone: "\t" + String(r.phone || ""),
  }));

  const csv = Papa.unparse(formatted);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ganesh-chaturthi-2026-participants.csv"`,
    },
  });
}
