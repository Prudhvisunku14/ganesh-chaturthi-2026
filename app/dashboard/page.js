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
  { key: "whatsapp_pending", label: "Invites Pending",   icon: "⏳", bg: "#fffbeb" },
  { key: "whatsapp_failed",  label: "Invites Failed",    icon: "⚠️", bg: "#fef2f2" },
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

      <InvitationSettingsCard />

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

function InvitationSettingsCard() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");
  const [verifiedParticipants, setVerifiedParticipants] = useState([]);
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/invitation-settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
      setMessage(data.message_template || "");
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/participants?payment=verified")
      .then((res) => res.ok ? res.json() : { participants: [] })
      .then((data) => setVerifiedParticipants(data.participants || []));
  }, [load]);

  async function loadPreview(id = previewId) {
    if (!id) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const res = await fetch(`/api/participants/${id}/whatsapp`);
    const data = await res.json().catch(() => ({}));
    setPreviewLoading(false);
    if (res.ok) setPreview({ ...data, id });
    else setNotice(data.error || "Could not load invitation preview.");
  }

  async function saveTemplate() {
    setSaving(true);
    const res = await fetch("/api/invitation-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_template: message, poster_enabled: settings.poster_enabled }),
    });
    setNotice(res.ok ? "Template saved." : (await res.json()).error || "Could not save template.");
    setSaving(false);
    setTimeout(() => setNotice(""), 3000);
  }

  async function togglePoster(event) {
    const enabled = event.target.checked;
    setSettings((current) => ({ ...current, poster_enabled: enabled }));
    await fetch("/api/invitation-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_template: message, poster_enabled: enabled }),
    });
  }

  async function uploadPoster(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("poster", file);
    const res = await fetch("/api/invitation-settings", { method: "POST", body: form });
    if (res.ok) { setNotice("Poster saved."); load(); }
    else setNotice((await res.json()).error || "Could not save poster.");
    event.target.value = "";
  }

  async function removePoster() {
    const res = await fetch("/api/invitation-settings", { method: "DELETE" });
    if (res.ok) { setNotice("Poster removed."); load(); }
  }

  async function sendPreviewInvitation() {
    if (!preview?.id) return;
    setSending(true);
    const res = await fetch(`/api/participants/${preview.id}/whatsapp`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    setNotice(res.ok
      ? `Invitation sent to ${verifiedParticipants.find((item) => String(item.id) === String(preview.id))?.name || "participant"}.`
      : (data.error || "Invitation failed."));
  }

  if (!settings) return null;
  return (
    <section className="card" style={{ padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>WhatsApp Invitations</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 4 }}>The active template and poster are used by WhatsApp and Gmail.</p>
        </div>
        {notice && <span className="badge badge-success">{notice}</span>}
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5 }}>MESSAGE TEMPLATE</label>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} />
      <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Variables: {"{NAME}"}, {"{PROGRAM}"}, {"{YEAR}"}, {"{DATE}"}, {"{VENUE}"}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveTemplate}>{saving ? "Saving..." : "Save Template"}</button>
        <label className="btn btn-sm" style={{ cursor: "pointer" }}>
          Save Poster
          <input type="file" accept="image/*" onChange={uploadPoster} style={{ display: "none" }} />
        </label>
        {settings.poster_url && <button type="button" className="btn btn-sm" onClick={removePoster}>Remove Poster</button>}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginLeft: "auto" }}>
          <input type="checkbox" checked={settings.poster_enabled} onChange={togglePoster} style={{ width: 16, minHeight: 16 }} /> Enable poster
        </label>
      </div>
      {settings.poster_url && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>CURRENT POSTER</div>
          <img src={`${settings.poster_url}?v=${settings.updated_at}`} alt="Current invitation poster" style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>INVITATION PREVIEW</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={previewId} onChange={(event) => { setPreviewId(event.target.value); setPreview(null); }} style={{ flex: "1 1 220px" }}>
            <option value="">Select a verified participant</option>
            {verifiedParticipants.map((participant) => (
              <option key={participant.id} value={participant.id}>{participant.name} · {participant.phone}</option>
            ))}
          </select>
          <button type="button" className="btn btn-sm" disabled={!previewId || previewLoading} onClick={() => loadPreview()}>
            {previewLoading ? "Loading..." : "Preview Invitation"}
          </button>
        </div>
        {preview && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 14, alignItems: "start" }}>
            <div>
              {preview.poster_url && <img src={`${preview.poster_url}?v=${settings.updated_at}`} alt="Selected invitation poster preview" style={{ width: "100%", maxHeight: 180, objectFit: "contain", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 10 }} />}
              <pre style={{ whiteSpace: "pre-wrap", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: 12, fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>{preview.message}</pre>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={sending || preview.mode !== "cloud"} onClick={sendPreviewInvitation}>
                  {sending ? "Sending..." : preview.mode === "cloud" ? "Send Invitation" : "Open WhatsApp manually"}
                </button>
                {preview.mode === "fallback" && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>wa.me cannot attach the poster or QR automatically; status stays NOT SENT.</span>}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <img src={preview.qr_image} alt="Selected participant unique food QR" style={{ width: 150, height: 150, padding: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>QR for selected participant</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
