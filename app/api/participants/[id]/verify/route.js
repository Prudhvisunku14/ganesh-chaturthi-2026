export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { generateSecureToken } from "../../../../../lib/qr";

// body: { action: "verify" | "reject" }
export async function POST(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (!["verify", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'verify' or 'reject'." }, { status: 400 });
  }

  const db = getDb();
  const participant = await db.prepare("SELECT * FROM app.participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "reject") {
    await db.prepare(
      `UPDATE app.participants
       SET payment_status = 'rejected', qr_token = NULL, updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       WHERE id = ?`
    ).run(params.id);
    return NextResponse.json({ ok: true, payment_status: "rejected" });
  }

  // Preserve the same QR token even if two admins verify concurrently.
  const verified = await db.prepare(
    `UPDATE app.participants
     SET payment_status = 'verified', qr_token = COALESCE(qr_token, ?),
         updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     WHERE id = ? RETURNING qr_token`
  ).get(generateSecureToken(), params.id);
  if (!verified) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, payment_status: "verified", qr_token: verified.qr_token });
}
