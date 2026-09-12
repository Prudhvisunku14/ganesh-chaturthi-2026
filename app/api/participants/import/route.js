export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";
import { randomUUID as uuidv4 } from "node:crypto";

export async function POST(req) {
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rows;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData().catch(() => null);
      const file = formData?.get("file");
      if (!file || typeof file.arrayBuffer !== "function") {
        return NextResponse.json({ error: "No CSV or XLSX file provided." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = String(file.name || "").toLowerCase();
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const workbook = readXlsx(buffer, { type: "buffer", cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) return NextResponse.json({ error: "The workbook has no sheets." }, { status: 400 });
        rows = xlsxUtils.sheet_to_json(firstSheet, { defval: "", raw: false });
      } else {
        rows = parseCsv(buffer.toString("utf8"));
      }
    } else {
      const { csv } = await req.json().catch(() => ({}));
      if (typeof csv !== "string") {
        return NextResponse.json({ error: "No CSV or XLSX file provided." }, { status: 400 });
      }
      rows = parseCsv(csv);
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  function parseCsv(csv) {
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
    if (result.errors?.length) {
      throw new Error(`CSV parse error: ${result.errors[0].message}`);
    }
    return result.data;
  }

  const normalizeKey = (k) => k.trim().toLowerCase().replace(/\s+/g, "_");

  const db = getDb();

  let imported = 0;
  let skippedInvalid = 0;
  const errors = [];
  const textValue = (value) => String(value ?? "").trim();

  const runImport = db.transaction(async (db, rows) => {
    const insert = db.prepare(`
      INSERT INTO app.participants (registration_id, name, phone, email, year, program, department, payment_proof_url, payment_status)
      VALUES (@registration_id, @name, @phone, @email, @year, @program, @department, @payment_proof_url, 'pending')
    `);
    for (const raw of rows) {
      const row = {};
      for (const key in raw) row[normalizeKey(key)] = raw[key];

      const name = textValue(row.name);
      const phone = textValue(row.phone || row.phone_number || row.mobile_number);
      const email = textValue(row.email || row.email_address) || null;
      const program = textValue(row.program || row.programme) || null;
      const paymentProofUrl = textValue(row.payment_proof_url || row.payment_proof) || null;

      if (!name || !phone) {
        skippedInvalid += 1;
        errors.push(`Missing name/phone: ${JSON.stringify(raw)}`);
        continue;
      }

      await insert.run({
        registration_id: `REG-${uuidv4().slice(0, 8).toUpperCase()}`,
        name,
        phone,
        email,
        year: textValue(row.year) || null,
        program,
        department: textValue(row.department) || null,
        payment_proof_url: paymentProofUrl,
      });
      imported += 1;
    }
  });

  try {
    await runImport(rows);
  } catch (err) {
    return NextResponse.json({ error: "Import failed: " + err.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped_duplicates: 0,
    skipped_invalid: skippedInvalid,
    errors: errors.slice(0, 10),
  });
}
