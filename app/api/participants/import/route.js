export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";
import { randomUUID as uuidv4 } from "node:crypto";

// Accepts a CSV with headers matching (case-insensitively) the Google Form
// export: name, phone, year, program, department, payment_proof_url
// This is the "clean CSV import" path noted in the spec — swap for a Google
// Sheets API/Apps Script sync later without changing this insert logic.
export async function POST(req) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { csv } = await req.json().catch(() => ({}));
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });
  }

  const parsed = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    return NextResponse.json({ error: `CSV parse error: ${parsed.errors[0].message}` }, { status: 400 });
  }

  const normalizeKey = (k) => k.trim().toLowerCase().replace(/\s+/g, "_");

  const db = getDb();

  let imported = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  const errors = [];

  const runImport = db.transaction(async (db, rows) => {
    const insert = db.prepare(`
      INSERT INTO app.participants (registration_id, name, phone, email, year, program, department, payment_proof_url, payment_status)
      VALUES (@registration_id, @name, @phone, @email, @year, @program, @department, @payment_proof_url, 'pending')
    `);
    const findByPhone = db.prepare("SELECT id FROM app.participants WHERE phone = ?");
    for (const raw of rows) {
      const row = {};
      for (const key in raw) row[normalizeKey(key)] = raw[key];

      const name = (row.name || "").trim();
      const phone = (row.phone || row.phone_number || row.mobile_number || "").trim();
      const email = (row.email || row.email_address || "").trim() || null;
      const program = (row.program || row.programme || "").trim() || null;
      const paymentProofUrl = (row.payment_proof_url || row.payment_proof || "").trim() || null;

      if (!name || !phone) {
        skippedInvalid += 1;
        errors.push(`Missing name/phone: ${JSON.stringify(raw)}`);
        continue;
      }

      if (await findByPhone.get(phone)) {
        skippedDuplicates += 1;
        continue;
      }

      await insert.run({
        registration_id: `REG-${uuidv4().slice(0, 8).toUpperCase()}`,
        name,
        phone,
        email,
        year: (row.year || "").trim() || null,
        program,
        department: (row.department || "").trim() || null,
        payment_proof_url: paymentProofUrl,
      });
      imported += 1;
    }
  });

  try {
    await runImport(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: "Import failed: " + err.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped_duplicates: skippedDuplicates,
    skipped_invalid: skippedInvalid,
    errors: errors.slice(0, 10),
  });
}
