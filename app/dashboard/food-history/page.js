"use client";

import { useEffect, useState, useCallback } from "react";

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

export default function FoodHistoryPage() {
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);
  const [sort,    setSort]    = useState("newest");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, hRes] = await Promise.all([
      fetch("/api/stats"),
      fetch(`/api/food-history?sort=${sort}`),
    ]);
    if (sRes.ok) setStats(await sRes.json());
    if (hRes.ok) {
      const data = await hRes.json();
      setHistory(data.history || []);
    }
    setLoading(false);
  }, [sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="container">
      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>History & Live Analytics</h1>
            <span className="badge badge-success">
              🍱 {history.length} Claimed
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 4 }}>
            Real-time event analytics and participant food distribution logs.
          </p>
        </div>

        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
          <option value="newest">⏱️ Newest first</option>
          <option value="oldest">⏱️ Oldest first</option>
        </select>
      </div>

      {/* ── Live Analytics Cards ── */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
        Live Event Analytics
      </h2>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {STAT_CARDS.map((card) => {
          const val = stats ? stats[card.key] ?? 0 : "—";
          return (
            <div
              key={card.key}
              className="card"
              style={{
                padding: "16px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{
                width: 44, height: 44,
                borderRadius: "var(--radius-sm)",
                background: card.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0
              }}>
                {card.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>
                  {val}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Food Claims History List ── */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
        Food Claim History Log
      </h2>

      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
          Loading food collection log...
        </div>
      ) : history.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>No Food Claims Recorded</div>
          <div style={{ fontSize: 13.5, marginTop: 4 }}>Scan participant QR passes to start recording claims.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {history.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 18px",
                borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                gap: 12,
                background: "var(--surface)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "var(--success-tint)", color: "var(--success-dark)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, flexShrink: 0
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--text)" }}>{h.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    📞 {h.phone || "—"} {[h.program, h.year].filter(Boolean).length ? `· ${[h.program, h.year].filter(Boolean).join(" · ")}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span className="badge badge-success">Collected</span>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>
                  {formatTime(h.claimed_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function formatTime(sqlTimestamp) {
  if (!sqlTimestamp) return "—";
  const d = new Date(sqlTimestamp.replace(" ", "T") + "Z");
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}
