export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireRole } from "../../../lib/auth";

export async function GET(req) {
  const session = requireRole(req, ["admin", "volunteer"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") === "oldest" ? "ASC" : "DESC";

  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT name, program, year, department, claimed_at
       FROM app.participants
       WHERE food_claimed = 1
       ORDER BY claimed_at ${sort}`
    )
    .all();

  return NextResponse.json({ history: rows });
}
