export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireRole } from "../../../lib/auth";
import defaultTemplate from "../../../lib/invitation-default";

async function getSettings() {
  const db = getDb();
  let row = await db.prepare("SELECT * FROM app.invitation_settings WHERE id = 1").get();
  if (!row) {
    row = await db.prepare(
      "INSERT INTO app.invitation_settings (id, message_template) VALUES (1, ?) RETURNING *"
    ).get(defaultTemplate);
  }
  return row;
}

function publicSettings(row) {
  return {
    message_template: row.message_template,
    poster_enabled: Boolean(row.poster_enabled),
    poster_url: row.poster_path ? "/api/invitation-settings/poster" : null,
    updated_at: row.updated_at,
  };
}

export async function GET(req) {
  if (!requireRole(req, ["admin"])) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await getSettings();
  return NextResponse.json(publicSettings(row));
}

export async function PUT(req) {
  if (!requireRole(req, ["admin"])) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const message = String(body.message_template || "").trim();
  if (!message) return NextResponse.json({ error: "Message template cannot be empty." }, { status: 400 });
  const now = new Date().toISOString();
  await getSettings();
  await getDb().prepare(
    `UPDATE app.invitation_settings SET message_template = ?, poster_enabled = ?, updated_at = ? WHERE id = 1`
  ).run(message, body.poster_enabled === false ? 0 : 1, now);
  return NextResponse.json({ ok: true });
}

export async function POST(req) {
  if (!requireRole(req, ["admin"])) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("poster");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Choose an image poster to upload." }, { status: 400 });
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Poster must be an image." }, { status: 400 });
  }
  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Poster must be smaller than 3 MB (PNG, JPEG, or WebP)." }, { status: 400 });
  }
  const extension = (String(file.type).split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const relativePath = `invitation-poster.${extension}`;
  const content = Buffer.from(await file.arrayBuffer());
  const now = new Date().toISOString();
  await getDb().transaction(async (db) => {
    await db.prepare("DELETE FROM app.poster_files").run();
    await db.prepare("INSERT INTO app.poster_files (path, content, content_type) VALUES (?, ?, ?) RETURNING path").get(relativePath, content, file.type);
    await db.prepare("UPDATE app.invitation_settings SET poster_path = ?, poster_enabled = 1, updated_at = ? WHERE id = 1").run(relativePath, now);
  })();
  return NextResponse.json({ ok: true, poster_url: "/api/invitation-settings/poster" });
}

export async function DELETE(req) {
  if (!requireRole(req, ["admin"])) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.prepare("UPDATE app.invitation_settings SET poster_path = NULL, poster_enabled = 0, updated_at = ? WHERE id = 1").run(new Date().toISOString());
    await tx.prepare("DELETE FROM app.poster_files").run();
  })();
  return NextResponse.json({ ok: true });
}
