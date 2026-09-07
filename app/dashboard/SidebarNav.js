"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/dashboard",              label: "Dashboard",   icon: "📊" },
  { href: "/dashboard/participants", label: "Participants", icon: "👥" },
  { href: "/dashboard/scanner",      label: "Scanner",     icon: "📷" },
  { href: "/dashboard/food-history", label: "History",     icon: "⏱️" },
];

const VOLUNTEER_LINKS = [
  { href: "/dashboard/scanner", label: "Scanner", icon: "📷" },
];

export default function SidebarNav({ role, username }) {
  const pathname = usePathname();
  const router   = useRouter();
  const links    = role === "admin" ? ADMIN_LINKS : VOLUNTEER_LINKS;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeTitle = links.find(l => l.href === pathname)?.label || "Dashboard";

  return (
    <>
      {/* ── Mobile Sticky Topbar Header ───────────────────────────────── */}
      <header className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: "var(--radius-xs)",
            background: "var(--accent-gradient)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)"
          }}>
            🪔
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>{activeTitle}</h1>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
              Ganesh 2026
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            padding: "3px 8px",
            background: "var(--surface-muted)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
            {username}
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-danger"
            style={{ padding: "4px 8px", fontSize: 11.5, minHeight: 28 }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Desktop Sidebar ────────────────────────────────────────────── */}
      <nav className="sidebar" aria-label="Main Navigation">
        <div style={{ padding: "0 4px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-gradient)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
          }}>
            🪔
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", lineHeight: 1.2 }}>
              Ganesh 2026
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500, marginTop: 1 }}>
              Event Management
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--primary)" : "var(--text)",
                  background: active ? "var(--primary-tint)" : "transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span aria-hidden style={{ fontSize: 17 }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "8px 10px", background: "var(--surface-muted)", borderRadius: "var(--radius-xs)", marginBottom: 10 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
              Signed In As
            </div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", marginTop: 2 }}>
              {username} ({role})
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-block"
            style={{ color: "var(--error)", borderColor: "rgba(239, 68, 68, 0.2)", background: "var(--error-tint)" }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Mobile Floating Bottom Bar ─────────────────────────────────── */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : ""}>
              <span className="nav-icon" aria-hidden>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
