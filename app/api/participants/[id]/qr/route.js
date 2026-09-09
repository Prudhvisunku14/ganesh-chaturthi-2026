export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/auth";
import { generateQrDataUrl } from "../../../../../lib/qr";

export async function GET(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const participant = await db.prepare("SELECT * FROM app.participants WHERE id = ?").get(params.id);
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!participant.qr_token) {
    return NextResponse.json({ error: "Payment not verified yet — no QR generated." }, { status: 400 });
  }

  const dataUrl = await generateQrDataUrl(participant.qr_token);
  return NextResponse.json({ qr_image: dataUrl, qr_token: participant.qr_token });
}
