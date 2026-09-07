export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireRole } from "../../../lib/auth";

export async function GET(req) {
  const session = requireRole(req, ["admin", "volunteer"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total_registered,
        SUM(CASE WHEN payment_status = 'verified' THEN 1 ELSE 0 END) AS payment_verified,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS payment_pending,
        SUM(CASE WHEN payment_status = 'rejected' THEN 1 ELSE 0 END) AS payment_rejected,
        SUM(CASE WHEN qr_token IS NOT NULL THEN 1 ELSE 0 END) AS qr_generated,
        SUM(CASE WHEN whatsapp_sent = 1 THEN 1 ELSE 0 END) AS whatsapp_sent,
        SUM(CASE WHEN food_claimed = 1 THEN 1 ELSE 0 END) AS food_collected
      FROM participants`
    )
    .get();

  const foodRemaining = (row.payment_verified || 0) - (row.food_collected || 0);

  return NextResponse.json({
    total_registered: row.total_registered || 0,
    payment_verified: row.payment_verified || 0,
    payment_pending: row.payment_pending || 0,
    payment_rejected: row.payment_rejected || 0,
    qr_generated: row.qr_generated || 0,
    whatsapp_sent: row.whatsapp_sent || 0,
    food_collected: row.food_collected || 0,
    food_remaining: foodRemaining > 0 ? foodRemaining : 0,
  });
}
