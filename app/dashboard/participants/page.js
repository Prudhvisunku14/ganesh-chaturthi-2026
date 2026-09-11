"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const PAYMENT_BADGE = {
  verified: { cls: "badge-success", label: "VERIFIED" },
  pending:  { cls: "badge-warning", label: "PENDING"  },
  rejected: { cls: "badge-error",   label: "REJECTED" },
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filters, setFilters] = useState({
    payment: "", program: "", year: "", food: "",
  });
  const [emailSending, setEmailSending] = useState({});
  const [qrModal,      setQrModal]      = useState(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [importOpen,   setImportOpen]   = useState(false);
  const [toast,        setToast]        = useState("");
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [bulkSending,  setBulkSending]  = useState(false);
  const [importFile,   setImportFile]   = useState(null);
  const [importing,    setImporting]    = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const res = await fetch(`/api/participants?${params.toString()}`);
    if (res.status === 401) {
      showToast("⚠️ Session expired. Redirecting to login...");
      setTimeout(() => { window.location.href = "/login"; }, 1200);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setParticipants(data.participants || []);
    setLoading(false);
  }, [search, filters]);

  async function handleExport() {
    try {
      const res = await fetch("/api/participants/export");
      if (res.status === 401) {
        showToast("⚠️ Admin session required. Re-logging in...");
        setTimeout(() => { window.location.href = "/login"; }, 1500);
        return;
      }
      if (!res.ok) { showToast("Export failed — login as admin."); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "ganesh-chaturthi-2026-participants.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("Export error: " + err.message);
    }
  }

  async function handleDeleteAll() {
    if (!confirm("⚠️ Delete ALL participants? This cannot be undone.")) return;
    if (!confirm("Are you 100% sure? All participant records will be permanently removed.")) return;
    const res  = await fetch("/api/participants", { method: "DELETE" });
    if (res.status === 401) {
      showToast("⚠️ Admin session required. Please re-login.");
      setTimeout(() => { window.location.href = "/login"; }, 1500);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(`Deleted ${data.deleted} participants.`);
      load();
    } else {
      showToast(data.error || "Delete failed.");
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleVerify(id, action) {
    const res = await fetch(`/api/participants/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.status === 401) {
      showToast("⚠️ Session expired or Admin role required. Please re-login.");
      setTimeout(() => { window.location.href = "/login"; }, 1500);
      return;
    }
    if (res.ok) {
      showToast(action === "verify" ? "Payment verified ✓ QR generated." : "Payment rejected.");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || "Action failed.");
    }
  }

  async function handleOpenQrWhatsApp(p) {
    const res  = await fetch(`/api/participants/${p.id}/qr`);
    if (res.status === 401) {
      showToast("⚠️ Session expired. Re-logging in...");
      setTimeout(() => { window.location.href = "/login"; }, 1500);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setQrModal({
        id: p.id, name: p.name, phone: p.phone, email: p.email,
        whatsapp_sent: !!p.whatsapp_sent, email_sent: !!p.email_sent,
        qr_image: data.qr_image, qr_token: data.qr_token,
        message: data.message, poster_url: data.poster_url, mode: data.mode,
      });
    } else {
      showToast(data.error || "Could not load QR.");
    }
  }

  async function handleSendWhatsApp(participantId, participantName) {
    const res  = await fetch(`/api/participants/${participantId}/whatsapp`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(data.error || "Could not build WhatsApp link."); return; }
    if (data.mode === "cloud") {
      const sendRes = await fetch(`/api/participants/${participantId}/whatsapp`, { method: "POST" });
      const sendData = await sendRes.json().catch(() => ({}));
      showToast(sendRes.ok ? `Invitation sent to ${participantName}.` : (sendData.error || "WhatsApp send failed."));
      if (sendRes.ok) setQrModal((prev) => (prev ? { ...prev, whatsapp_status: "sent" } : prev));
    } else {
      window.open(data.link, "_blank", "noopener,noreferrer");
      showToast(`WhatsApp opened for ${participantName}. Poster and QR must be attached manually. Status remains NOT SENT.`);
    }
    load();
  }

  async function handleBulkSend() {
    if (!selectedIds.length) return;
    setBulkSending(true);
    let sent = 0;
    let mode = "fallback";
    for (const id of selectedIds) {
      const preview = await fetch(`/api/participants/${id}/whatsapp`).then((res) => res.json());
      mode = preview.mode || mode;
      if (!preview.mode || preview.mode === "fallback") {
        if (preview.link) window.open(preview.link, "_blank", "noopener,noreferrer");
      } else {
        const response = await fetch(`/api/participants/${id}/whatsapp`, { method: "POST" });
        if (response.ok) sent += 1;
      }
    }
    setBulkSending(false);
    setSelectedIds([]);
    showToast(mode === "cloud" ? `Sent ${sent} invitation(s).` : "Opened selected WhatsApp links. Status remains NOT SENT until Cloud API is configured.");
    load();
  }


  async function handleSendEmail(p) {
    if (!p.email) { showToast("No email address registered."); return; }
    setEmailSending((prev) => ({ ...prev, [p.id]: true }));
    showToast(`Sending email to ${p.email}…`);
    try {
      const res  = await fetch(`/api/participants/${p.id}/email`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`Email sent to ${p.email}!`);
        setQrModal((prev) => (prev && prev.id === p.id ? { ...prev, email_sent: true } : prev));
        load();
      } else {
        showToast(data.error || "Failed to send email.");
      }
    } catch (err) {
      showToast("Email error: " + err.message);
    } finally {
      setEmailSending((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  function handleImportFile(e) {
    setImportFile(e.target.files?.[0] || null);
  }

  async function handleImport() {
    if (!importFile || importing) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", importFile);
    const res  = await fetch("/api/participants/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(`Imported ${data.imported} entries. ${data.skipped_invalid} invalid rows skipped.`);
      setImportOpen(false);
      load();
    } else {
      showToast(data.error || "Import failed.");
    }
    setImporting(false);
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="container">
      {/* ── Mobile Page Header & Toolbar ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Participants</h1>
            <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 1 }}>
              {participants.length} total registered
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}>
              + Add
            </button>
            <button type="button" className="btn btn-sm" onClick={handleExport}>
              ⬇ Export
            </button>
          </div>
        </div>

        <button type="button" className="btn btn-sm btn-primary" disabled={!selectedIds.length || bulkSending} onClick={handleBulkSend} style={{ marginTop: 10 }}>
          {bulkSending ? "Sending..." : `📱 Send to Selected (${selectedIds.length})`}
        </button>

        {/* Secondary Toolbar Buttons */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm" onClick={() => setImportOpen(true)} style={{ padding: "4px 8px", fontSize: 11.5 }}>
            📥 Import CSV
          </button>
          <button type="button" className="btn btn-sm" onClick={handleDeleteAll} style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--error-dark)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            🗑 Delete All
          </button>
        </div>
      </div>

      {/* ── Search & Filters Bar ── */}
      <div className="filter-bar">
        <input
          placeholder="🔍 Search name, mobile, registration ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <select value={filters.payment} onChange={(e) => setFilters((f) => ({ ...f, payment: e.target.value }))}>
            <option value="">Status: All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={filters.food} onChange={(e) => setFilters((f) => ({ ...f, food: e.target.value }))}>
            <option value="">Food: All</option>
            <option value="collected">Collected</option>
            <option value="not_collected">Pending</option>
          </select>
        </div>
      </div>

      {/* ── List of Participant Cards ── */}
      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
          ⚡ Loading participants...
        </div>
      ) : participants.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>No participants match filter</div>
          <div style={{ fontSize: 12.5, marginTop: 2 }}>Clear filters or search term to see records.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {participants.map((p) => (
            <ParticipantCard
              key={p.id}
              p={p}
              emailSending={!!emailSending[p.id]}
              selected={selectedIds.includes(p.id)}
              onSelect={(checked) => setSelectedIds((ids) => checked ? [...new Set([...ids, p.id])] : ids.filter((id) => id !== p.id))}
              onVerify={handleVerify}
              onOpenQr={handleOpenQrWhatsApp}
              onSendEmail={handleSendEmail}
              onDelete={async () => {
                if (!confirm(`Delete ${p.name}?`)) return;
                const res = await fetch(`/api/participants/${p.id}`, { method: "DELETE" });
                if (res.status === 401) {
                  showToast("⚠️ Admin session required. Re-logging in...");
                  setTimeout(() => { window.location.href = "/login"; }, 1500);
                  return;
                }
                load();
              }}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {qrModal && (
        <QrWhatsAppModal
          data={qrModal}
          onClose={() => setQrModal(null)}
          onSendWhatsApp={handleSendWhatsApp}
          onSendEmail={handleSendEmail}
          emailSending={emailSending[qrModal.id]}
        />
      )}
      {addOpen && (
        <AddParticipantModal
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load(); }}
        />
      )}
      {importOpen && (
        <Modal onClose={() => { setImportOpen(false); setImportFile(null); }} title="Import Participants File">
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.4 }}>
             Upload a CSV or XLSX file with headers: <code>Name, Mobile Number, Email, Programme, Year</code>.
          </p>
           <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} />
           {importFile && (
             <button type="button" className="btn btn-primary btn-block" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
               {importing ? "Importing..." : `Import ${importFile.name}`}
             </button>
           )}
        </Modal>
      )}

      {/* ── Toast Alert ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 76, left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#ffffff", padding: "10px 18px",
          borderRadius: "var(--radius-full)", fontSize: 13, fontWeight: 600,
          boxShadow: "var(--shadow-lg)", zIndex: 1500, maxWidth: "92vw", textAlign: "center"
        }}>
          {toast}
        </div>
      )}
    </main>
  );
}

/* ── Individual Mobile Participant Card ── */
function ParticipantCard({ p, emailSending, selected, onSelect, onVerify, onOpenQr, onSendEmail, onDelete }) {
  const pay        = PAYMENT_BADGE[p.payment_status] || PAYMENT_BADGE.pending;
  const isVerified = p.payment_status === "verified";
  const hasQr      = isVerified && p.qr_token;
  const hasEmail   = Boolean(p.email);

  const initials = p.name ? p.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "?";

  return (
    <div className="p-card">
      <div className="p-card-top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          {isVerified && <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${p.name}`} style={{ width: 17, minHeight: 17 }} />}
          <div className="p-card-avatar">{initials}</div>
          <div className="p-card-info">
            <div className="p-card-name">{p.name}</div>
            <div className="p-card-sub">
              📞 +91 {p.phone} {p.email ? `· ✉️ ${p.email}` : ""}
            </div>
          </div>
        </div>
        <span className={`badge ${pay.cls}`}>
          <span className="dot" />{pay.label}
        </span>
      </div>

      {isVerified && <div style={{ marginTop: 7, fontSize: 11.5, color: p.whatsapp_status === "sent" ? "var(--success-dark)" : p.whatsapp_status === "failed" ? "var(--error-dark)" : "var(--text-muted)" }}>
        WhatsApp: {(p.whatsapp_status || (p.whatsapp_sent ? "sent" : "not_sent")).replace("_", " ").toUpperCase()}
      </div>}

      {(p.year || p.program || p.payment_proof_url) && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>{[p.program, p.year].filter(Boolean).join(" · ")}</div>
          {p.payment_proof_url && (
            <a href={p.payment_proof_url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontWeight: 700 }}>
              📎 Proof Screenshot
            </a>
          )}
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="p-card-actions">
        {p.payment_status === "pending" && (
          <>
            <button type="button" className="btn btn-sm btn-success" onClick={() => onVerify(p.id, "verify")}>
              ✓ Verify
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onVerify(p.id, "reject")}>
              ✕ Reject
            </button>
          </>
        )}
        {hasQr && (
          <>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onOpenQr(p)}>
              📱 Send Invitation
            </button>
            {hasEmail && (
              <button type="button" className="btn btn-sm" disabled={emailSending} onClick={() => onSendEmail(p)}>
                {emailSending ? "Sending…" : p.email_sent ? "✉️ Resend Email" : "✉️ Email"}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={onDelete}
          style={{ marginLeft: "auto", color: "var(--error-dark)", background: "var(--error-tint)", borderColor: "transparent", padding: "4px 8px" }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

/* ── Modal Container ── */
function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h3>
          <button type="button" className="btn btn-sm" onClick={onClose} style={{ borderRadius: "50%", width: 28, height: 28, padding: 0 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── QR & WhatsApp Sheet ── */
function QrWhatsAppModal({ data, onClose, onSendWhatsApp, onSendEmail, emailSending }) {
  const [sendingWa, setSendingWa] = useState(false);
  const fileName = `${data.name.replace(/\s+/g, "_")}_qr.png`;

  async function doSendWhatsApp() {
    setSendingWa(true);
    await onSendWhatsApp(data.id, data.name);
    setSendingWa(false);
  }

  return (
    <Modal title={`Pass — ${data.name}`} onClose={onClose}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {data.poster_url && <img src={data.poster_url} alt="Invitation poster" style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain", marginBottom: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />}
        {data.message && <pre style={{ whiteSpace: "pre-wrap", textAlign: "left", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: 12, fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>{data.message}</pre>}
        <img
          src={data.qr_image}
          alt={`QR for ${data.name}`}
          style={{
            width: 200, height: 200,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 10,
            background: "#ffffff",
          }}
        />
        <div style={{ marginTop: 10 }}>
          <a href={data.qr_image} download={fileName} className="btn btn-primary btn-sm">
            ⬇ Save Pass Image
          </a>
        </div>
      </div>

      <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-xs)", padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{data.name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 2 }}>📞 +91 {data.phone}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" className="btn btn-success btn-block" onClick={doSendWhatsApp} disabled={sendingWa}>
          {sendingWa ? "Sending..." : data.mode === "cloud" ? "📱 Send Invitation" : "📱 Open WhatsApp (manual attachments)"}
        </button>
        <button type="button" className="btn btn-primary btn-block" disabled={!data.email || emailSending} onClick={() => onSendEmail(data)}>
          {emailSending ? "Sending..." : !data.email ? "✉️ No email registered" : "✉️ Send QR Email"}
        </button>
      </div>
    </Modal>
  );
}

/* ── Add Participant Modal ── */
function AddParticipantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", year: "", program: "B.Tech" });
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.status === 401) {
      setError("Session expired or Admin role required.");
      setSaving(false);
      setTimeout(() => { window.location.href = "/login"; }, 1500);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) onCreated();
    else setError(data.error || "Could not add participant.");
  }

  const f = (field) => ({ value: form[field], onChange: (e) => setForm((p) => ({ ...p, [field]: e.target.value })) });

  return (
    <Modal title="Add Participant" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--text-muted)" }}>FULL NAME</label>
          <input placeholder="e.g. Rahul Sharma" required {...f("name")} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--text-muted)" }}>MOBILE NUMBER</label>
          <input placeholder="10-digit mobile number" required {...f("phone")} inputMode="tel" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--text-muted)" }}>EMAIL (OPTIONAL)</label>
          <input placeholder="e.g. student@univ.edu" type="email" {...f("email")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--text-muted)" }}>PROGRAM</label>
            <select {...f("program")}>
              <option>B.Tech</option>
              <option>M.Tech</option>
              <option>M.Sc</option>
              <option>PhD</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--text-muted)" }}>YEAR</label>
            <input placeholder="e.g. 3rd Year" {...f("year")} />
          </div>
        </div>

        {error && <div className="badge badge-error" style={{ display: "block", padding: 8 }}>{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving} style={{ marginTop: 6 }}>
          {saving ? "Saving..." : "Add Participant"}
        </button>
      </form>
    </Modal>
  );
}
