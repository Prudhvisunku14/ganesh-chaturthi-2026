"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const STAT_CARDS = [
  { key: "total_registered", label: "Total Registered", icon: "👥", bg: "#eeefff" },
  { key: "payment_verified", label: "Verified",          icon: "✅", bg: "#ecfdf5" },
  { key: "payment_pending",  label: "Pending",           icon: "⏳", bg: "#fffbeb" },
  { key: "payment_rejected", label: "Rejected",          icon: "❌", bg: "#fef2f2" },
  { key: "qr_generated",    label: "QR Generated",      icon: "📱", bg: "#eeefff" },
  { key: "whatsapp_sent",   label: "WhatsApp Sent",     icon: "💬", bg: "#ecfdf5" },
  { key: "food_collected",  label: "Food Claimed",      icon: "🍱", bg: "#ecfdf5" },
  { key: "food_remaining",  label: "Food Remaining",    icon: "🍽️", bg: "#fef2f2" },
];

export default function DashboardHome() {
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    const [sRes, hRes] = await Promise.all([
      fetch("/api/stats"),
      fetch("/api/food-history?sort=newest"),
    ]);
    if (sRes.ok) setStats(await sRes.json());
    if (hRes.ok) {
      const hData = await hRes.json();
      setHistory((hData.history || []).slice(0, 5));
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <main className="container">
      {/* ── Welcome Banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 16px",
        color: "#ffffff",
        marginBottom: 16,
        boxShadow: "var(--shadow-md)",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, color: "#f59e0b",
              background: "rgba(245, 158, 11, 0.15)", padding: "3px 10px",
              borderRadius: 999, marginBottom: 8, border: "1px solid rgba(245, 158, 11, 0.3)"
            }}>
              🪔 GANESH CHATURTHI 2026
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff" }}>
              Dashboard
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
              Real-time event portal & participant tracking
            </p>
          </div>
        </div>
      </div>

      {/* ── Feature Buttons (Quick Actions) ── */}
      <div className="action-buttons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Link href="/dashboard/scanner" className="btn btn-primary btn-block" style={{ padding: "12px 14px", borderRadius: "var(--radius)", fontSize: 14 }}>
          📷 Food Scanner
        </Link>
        <Link href="/dashboard/participants" className="btn btn-block" style={{ padding: "12px 14px", borderRadius: "var(--radius)", fontSize: 14 }}>
          👥 View Participants
        </Link>
      </div>

      {/* ── Live Analytics Cards ── */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
        Live Analytics
      </h2>
      <div className="stat-grid">
        {STAT_CARDS.map((card) => {
          const val = stats ? stats[card.key] ?? 0 : "—";
          return (
            <div key={card.key} className="stat-card">
              <div className="stat-icon" style={{ background: card.bg }}>
                {card.icon}
              </div>
              <div className="stat-info">
                <div className="stat-value">{val}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Recent Food Collection Activity ── */}
      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Recent Food Claims</h2>
          <Link href="/dashboard/food-history" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700 }}>
            View All →
          </Link>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13.5 }}>
            No food claims recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--surface-muted)",
                  borderRadius: "var(--radius-sm)"
                }}
              >
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {h.registration_id} · {h.phone}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span className="badge badge-success">🍱 Collected</span>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {h.claimed_at ? new Date(h.claimed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
