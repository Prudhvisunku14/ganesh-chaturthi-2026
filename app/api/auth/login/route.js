export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { verifyPassword, createSessionToken, COOKIE_NAME, SESSION_HOURS } from "../../../../lib/auth";

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const db = getDb();
  const user = await db.prepare("SELECT * FROM app.users WHERE username = ?").get(username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = createSessionToken(user);
  const res = NextResponse.json({ ok: true, role: user.role });

  const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
  return res;
}
