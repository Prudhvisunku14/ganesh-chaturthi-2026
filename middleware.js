import { NextResponse } from "next/server";

// NOTE: Next.js middleware runs on the Edge runtime, which cannot use
// Node-only modules like `jsonwebtoken`/`crypto`. So this middleware only
// does an unverified, cheap peek at the session cookie to redirect for UX
// purposes (not logged in -> /login, wrong role -> /dashboard/scanner).
//
// Real authorization happens server-side in every app/api/** route handler
// (Node.js runtime) via lib/auth.js's `getSessionFromRequest`, which DOES
// verify the JWT signature. Middleware is a convenience redirect only —
// never the security boundary.

const COOKIE_NAME = "gc2026_session";
const VOLUNTEER_ALLOWED_PREFIXES = ["/dashboard/scanner"];

function decodeUnverified(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const session = raw ? decodeUnverified(raw) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "volunteer") {
    const allowed = VOLUNTEER_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!allowed) {
      return NextResponse.redirect(new URL("/dashboard/scanner", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/scanner"],
};

