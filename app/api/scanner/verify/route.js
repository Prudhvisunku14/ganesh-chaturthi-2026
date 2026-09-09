export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { CLAIM_SQL } from "../../../../lib/claim";
import { getDb } from "../../../../lib/db";
import { requireRole } from "../../../../lib/auth";

// Very simple in-memory rate limiter per session (resets on server restart).
// Good enough for a single-event, ~300-person food counter; not meant to
// survive multi-instance deployment.
//
// NOTE: volunteers commonly share one login across several phones at the
// counter, so this key is per-account, not per-device. The limit is sized
// for that: several devices each scanning ~1 QR/sec on one shared account
// should never trip it — it exists to catch a runaway loop/bug, not to
// throttle normal multi-scanner concurrency.
const attempts = new Map();
function rateLimited(key, limit = 100, windowMs = 10_000) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count > limit;
}

export async function POST(req) {
  const session = requireRole(req, ["admin", "volunteer"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (rateLimited(`scan:${session.uid}`)) {
    return NextResponse.json(
      { result: "error", message: "Too many scans too quickly. Slow down." },
      { status: 429 }
    );
  }

  const { token: rawToken } = await req.json().catch(() => ({}));
  if (!rawToken || typeof rawToken !== "string") {
    return NextResponse.json({ result: "invalid_unrecognized", message: "QR code not recognized." });
  }

  // The QR may encode either the raw token or a full verification URL
  // (https://.../verify/<token>) — accept either.
  const token = rawToken.includes("/verify/") ? rawToken.split("/verify/").pop().trim() : rawToken.trim();

  const db = getDb();
  // PostgreSQL locks and rechecks the predicate when concurrent scans race.
  // A successful scan needs only this one round trip.
  const claimed = await db.prepare(CLAIM_SQL).get(session.uid, token);
  if (claimed) {
    return NextResponse.json({ result: "valid", message: "Food verified.", participant: publicView(claimed) });
  }
  const participant = await db.prepare("SELECT * FROM app.participants WHERE qr_token = ?").get(token);

  if (!participant) {
    return NextResponse.json({ result: "invalid_unrecognized", message: "QR code not recognized." });
  }

  if (participant.payment_status === "rejected") {
    return NextResponse.json({
      result: "not_eligible",
      message: "Registration/payment rejected.",
      participant: publicView(participant),
    });
  }

  if (participant.payment_status !== "verified") {
    return NextResponse.json({
      result: "not_eligible",
      message: "Payment has not been verified.",
      participant: publicView(participant),
    });
  }

  if (participant.food_claimed) {
    return NextResponse.json({
      result: "already_used",
      message: "Food has already been collected.",
      participant: publicView(participant),
    });
  }

  return NextResponse.json({ result: "not_eligible", message: "Registration changed. Scan again.", participant: publicView(participant) });
}

function publicView(p) {
  return {
    name: p.name,
    registration_id: p.registration_id,
    phone: p.phone,
    program: p.program,
    year: p.year,
    department: p.department,
    food_claimed: !!p.food_claimed,
    claimed_at: p.claimed_at,
  };
}
