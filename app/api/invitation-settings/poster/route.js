export const runtime = "nodejs";

import { readPoster } from "../../../../lib/poster";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";

export async function GET(req) {
  if (!requireRole(req, ["admin"])) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await getDb().prepare("SELECT poster_path FROM app.invitation_settings WHERE id = 1").get();
  if (!row?.poster_path) return NextResponse.json({ error: "No poster selected." }, { status: 404 });
  try {
    const poster = await readPoster(row.poster_path);
    return new NextResponse(poster.content, { headers: { "Content-Type": poster.contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Poster file is unavailable." }, { status: 404 });
  }
}
