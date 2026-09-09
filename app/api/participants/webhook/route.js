export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { randomUUID as uuidv4 } from "node:crypto";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const {
    secret,
    timestamp,
    email,
    name,
    phone,
    mobile_number,
    programme,
    program,
    year,
    payment_proof_url,
    payment_proof,
  } = body;

  const expectedSecret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing secret." }, { status: 401 });
  }

  const participantName = (name || "").trim();
  const rawPhone = (phone || mobile_number || "").trim();
  const participantEmail = (email || "").trim() || null;
  const participantProgram = (program || programme || "").trim() || null;
  const participantYear = (year || "").trim() || null;
  const participantPaymentProof = (payment_proof_url || payment_proof || "").trim() || null;

  if (!participantName || !rawPhone) {
    return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  }

  const db = getDb();
  const findByPhone = db.prepare("SELECT id FROM app.participants WHERE phone = ?");
  const existing = await findByPhone.get(rawPhone);

  if (existing) {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "duplicate_phone",
      message: `Participant with phone ${rawPhone} already exists.`,
    });
  }

  const registrationId = `REG-${uuidv4().slice(0, 8).toUpperCase()}`;

  try {
    const insert = db.prepare(`
      INSERT INTO app.participants
        (registration_id, name, phone, email, year, program, department, payment_proof_url, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'pending')
    `);

    const result = await insert.run(
      registrationId,
      participantName,
      rawPhone,
      participantEmail,
      participantYear,
      participantProgram,
      participantPaymentProof
    );

    return NextResponse.json({
      ok: true,
      status: "created",
      participant_id: result.lastInsertRowid,
      registration_id: registrationId,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to insert participant: " + err.message }, { status: 500 });
  }
}
