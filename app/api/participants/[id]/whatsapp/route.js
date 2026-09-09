export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { buildMessage } from "../../../../../lib/message";
import { generateQrPngBuffer, generateQrDataUrl } from "../../../../../lib/qr";
import { buildWhatsAppLink, isWhatsAppConfigured, sendWhatsAppCloud } from "../../../../../lib/whatsapp";

export async function GET(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const participant = await db.prepare("SELECT * FROM app.participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (participant.payment_status !== "verified") {
    return NextResponse.json({ error: "Payment must be verified first." }, { status: 400 });
  }
  if (!participant.phone) return NextResponse.json({ error: "Participant has no phone number." }, { status: 400 });
  if (!participant.qr_token) return NextResponse.json({ error: "Cannot send invitation. Unique food QR has not been generated." }, { status: 400 });

  const settings = await db.prepare("SELECT * FROM app.invitation_settings WHERE id = 1").get();
  const message = buildMessage(participant, settings.message_template);
  const qr_image = await generateQrDataUrl(participant.qr_token);
  return NextResponse.json({
    mode: isWhatsAppConfigured() ? "cloud" : "fallback",
    link: buildWhatsAppLink(participant, settings.message_template),
    message,
    qr_image,
    poster_url: settings.poster_enabled && settings.poster_path ? "/api/invitation-settings/poster" : null,
    poster_enabled: Boolean(settings.poster_enabled && settings.poster_path),
  });
}

export async function POST(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const participant = await db.prepare("SELECT * FROM app.participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  if (participant.payment_status !== "verified" || !participant.phone || !participant.qr_token) {
    return NextResponse.json({ error: "Participant is not eligible for invitation." }, { status: 400 });
  }
  if (!isWhatsAppConfigured()) return NextResponse.json({ error: "WhatsApp Cloud API is not configured. Use the wa.me fallback." }, { status: 409 });

  const settings = await db.prepare("SELECT * FROM app.invitation_settings WHERE id = 1").get();
  const now = new Date().toISOString();
  try {
    await sendWhatsAppCloud(
      participant,
      buildMessage(participant, settings.message_template),
      settings.poster_enabled && settings.poster_path ? settings.poster_path : null,
      await generateQrPngBuffer(participant.qr_token)
    );
    await db.prepare(`UPDATE app.participants SET whatsapp_sent = 1, whatsapp_status = 'sent', whatsapp_error = NULL, whatsapp_sent_at = ?, updated_at = ? WHERE id = ?`).run(now, now, params.id);
    return NextResponse.json({ ok: true, status: "sent" });
  } catch (error) {
    await db.prepare(`UPDATE app.participants SET whatsapp_status = 'failed', whatsapp_error = ?, updated_at = ? WHERE id = ?`).run(error.message, now, params.id);
    return NextResponse.json({ error: "WhatsApp delivery failed: " + error.message, status: "failed" }, { status: 502 });
  }
}
