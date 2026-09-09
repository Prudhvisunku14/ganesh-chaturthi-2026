export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";

export async function GET(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin", "volunteer"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const row = await db.prepare("SELECT * FROM app.participants WHERE id = ?").get(params.id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ participant: row });
}

export async function PATCH(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fields = ["name", "phone", "email", "year", "program", "department", "payment_proof_url"];
  const updates = [];
  const args = { id: params.id };

  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = @${f}`);
      args[f] = body[f];
    }
  }

  if (!updates.length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const db = getDb();
  await db.prepare(
    `UPDATE app.participants SET ${updates.join(", ")}, updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE id = @id`
  ).run(args);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const session = requireRole(req, ["admin"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  await db.prepare("DELETE FROM app.participants WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
