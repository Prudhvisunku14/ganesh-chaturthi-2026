export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireRole } from "../../../lib/auth";
import { randomUUID as uuidv4 } from "node:crypto";

export async function GET(req) {
  const session = requireRole(req, ["admin", "volunteer"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const payment = searchParams.get("payment"); // pending|verified|rejected
  const program = searchParams.get("program");
  const year = searchParams.get("year");
  const department = searchParams.get("department");
  const whatsapp = searchParams.get("whatsapp"); // sent|not_sent
  const food = searchParams.get("food"); // collected|not_collected

  const emailFilter = searchParams.get("email"); // sent|not_sent

  const where = [];
  const args = {};

  if (search) {
    where.push("(name ILIKE @search OR phone ILIKE @search OR email ILIKE @search OR registration_id ILIKE @search)");
    args.search = `%${search}%`;
  }
  if (payment) {
    where.push("payment_status = @payment");
    args.payment = payment;
  }
  if (program) {
    where.push("program = @program");
    args.program = program;
  }
  if (year) {
    where.push("year = @year");
    args.year = year;
  }
  if (department) {
    where.push("department = @department");
    args.department = department;
  }
  if (whatsapp === "sent") where.push("whatsapp_sent = 1");
  if (whatsapp === "not_sent") where.push("whatsapp_sent = 0");
  if (emailFilter === "sent") where.push("email_sent = 1");
  if (emailFilter === "not_sent") where.push("email_sent = 0");
  if (food === "collected") where.push("food_claimed = 1");
  if (food === "not_collected") where.push("food_claimed = 0");

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT id, registration_id, name, phone, email, year, program, department, payment_proof_url,
              payment_status, qr_token, whatsapp_sent, whatsapp_sent_at, whatsapp_status, whatsapp_error,
              email_sent, email_sent_at, food_claimed, claimed_at, created_at
       FROM app.participants
       ${whereClause}
       ORDER BY created_at DESC`
    )
    .all(args);

  return NextResponse.json({ participants: rows });
}

export async function POST(req) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, phone, email, year, program, department } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  }

  const db = getDb();
  const registrationId = `REG-${uuidv4().slice(0, 8).toUpperCase()}`;

  try {
    const info = await db
      .prepare(
        `INSERT INTO app.participants (registration_id, name, phone, email, year, program, department, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(registrationId, name.trim(), phone.trim(), email ? email.trim() : null, year || null, program || null, department || null);

    return NextResponse.json({ ok: true, id: info.lastInsertRowid, registration_id: registrationId });
  } catch (err) {
    return NextResponse.json({ error: "Could not create participant: " + err.message }, { status: 500 });
  }
}
export async function DELETE(req) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional: only delete a specific subset if `filter` body is sent,
  // otherwise wipe all participants.
  const db = getDb();
  const info = await db.prepare("DELETE FROM app.participants").run();
  return NextResponse.json({ ok: true, deleted: info.changes });
}
