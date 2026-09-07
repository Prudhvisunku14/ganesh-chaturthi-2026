export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { sendQrEmail } from "../../../../../lib/email";

export async function GET(req) {
  return NextResponse.json({ error: "Method Not Allowed. Use POST to send email." }, { status: 405 });
}

export async function POST(req, { params }) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const participant = db.prepare("SELECT * FROM participants WHERE id = ?").get(params.id);

  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  if (participant.payment_status !== "verified") {
    return NextResponse.json({ error: "Payment must be verified before sending QR email." }, { status: 400 });
  }

  if (!participant.email) {
    return NextResponse.json({ error: "Participant has no email address on file." }, { status: 400 });
  }

  if (!participant.qr_token) {
    return NextResponse.json({ error: "No QR code token generated for this participant." }, { status: 400 });
  }

  try {
    await sendQrEmail(participant);

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE participants
       SET email_sent = 1, email_sent_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, params.id);

    return NextResponse.json({ ok: true, email_sent_at: now });
  } catch (err) {
    return NextResponse.json({ error: "Email delivery failed: " + err.message }, { status: 500 });
  }
}
