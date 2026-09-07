export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { buildWhatsAppLink } from "../../../../../lib/whatsapp";

// GET: returns the click-to-chat link (does not mark as sent — the frontend
// opens the link, then calls POST once the organizer has clicked "Send").
export async function GET(req, { params }) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const participant = db.prepare("SELECT * FROM participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (participant.payment_status !== "verified") {
    return NextResponse.json({ error: "Payment must be verified first." }, { status: 400 });
  }

  const link = buildWhatsAppLink(participant);
  return NextResponse.json({ link });
}

// POST: marks the WhatsApp message as sent (called right after the click-to-chat tab opens).
export async function POST(req, { params }) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  db.prepare(
    `UPDATE participants SET whatsapp_sent = 1, whatsapp_sent_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(params.id);

  return NextResponse.json({ ok: true });
}
