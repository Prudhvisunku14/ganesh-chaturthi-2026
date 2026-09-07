export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { generateSecureToken } from "../../../../../lib/qr";

// body: { action: "verify" | "reject" }
export async function POST(req, { params }) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (!["verify", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'verify' or 'reject'." }, { status: 400 });
  }

  const db = getDb();
  const participant = db.prepare("SELECT * FROM participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "reject") {
    db.prepare(
      `UPDATE participants
       SET payment_status = 'rejected', qr_token = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ).run(params.id);
    return NextResponse.json({ ok: true, payment_status: "rejected" });
  }

  // action === "verify" — generate a fresh, never-reused secure token.
  // Never derive it from name/phone/registration_id.
  let token = participant.qr_token;
  if (!token) {
    // Loop guards against the astronomically unlikely case of a collision.
    do {
      token = generateSecureToken();
    } while (db.prepare("SELECT 1 FROM participants WHERE qr_token = ?").get(token));
  }

  db.prepare(
    `UPDATE participants
     SET payment_status = 'verified', qr_token = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(token, params.id);

  return NextResponse.json({ ok: true, payment_status: "verified", qr_token: token });
}
