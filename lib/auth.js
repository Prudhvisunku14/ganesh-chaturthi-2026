// lib/auth.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || /change-this|dev-secret/i.test(secret)) {
    throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");
  }
  return secret;
}
const COOKIE_NAME = "gc2026_session";
const SESSION_HOURS = 12;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function createSessionToken(user) {
  return jwt.sign(
    { uid: user.id, username: user.username, role: user.role },
    getSecret(),
    { expiresIn: `${SESSION_HOURS}h` }
  );
}

function readSessionToken(token) {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

// Reads the session from a Next.js request's cookies (works in route handlers
// and middleware, which have slightly different cookie APIs).
function getSessionFromRequest(req) {
  const raw =
    req.cookies?.get?.(COOKIE_NAME)?.value ?? req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  return readSessionToken(raw);
}

// Use inside app/api/** route handlers. Returns the verified session, or
// null if the caller doesn't have one of the allowed roles. This is the
// real (server-side) authorization boundary — middleware.js is UX-only.
function requireRole(req, allowedRoles) {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  if (allowedRoles && !allowedRoles.includes(session.role)) return null;
  return session;
}

module.exports = {
  COOKIE_NAME,
  SESSION_HOURS,
  hashPassword,
  verifyPassword,
  createSessionToken,
  readSessionToken,
  getSessionFromRequest,
  requireRole,
};
