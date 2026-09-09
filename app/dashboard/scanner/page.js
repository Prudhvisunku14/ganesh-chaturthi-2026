"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const RESULT_STYLES = {
  valid: {
    bg: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    icon: "✅",
    title: "VALID PASS",
    subtitle: "GIVE FOOD MEAL",
    extraText: null,
  },
  already_used: {
    bg: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
    icon: "❌",
    title: "ALREADY CLAIMED",
    subtitle: "DO NOT ISSUE FOOD",
    extraText: "THIS QR HAS ALREADY BEEN USED",
  },
  not_eligible: {
    bg: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
    icon: "⚠️",
    title: "PAYMENT PENDING",
    subtitle: "NOT ELIGIBLE FOR FOOD",
    extraText: "PAYMENT VERIFICATION REQUIRED",
  },
  invalid_unrecognized: {
    bg: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
    icon: "🚫",
    title: "INVALID QR CODE",
    subtitle: "UNRECOGNIZED PASS",
    extraText: "NOT A GANESH 2026 QR TOKEN",
  },
  error: {
    bg: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    icon: "⚠️",
    title: "SCAN ERROR",
    subtitle: "PLEASE TRY AGAIN",
    extraText: null,
  },
};

export default function ScannerPage() {
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const busyRef = useRef(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async (decodedText) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      const res = await fetch("/api/scanner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: decodedText }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ result: "error", message: "Network connection error." });
    }

    // Keep the accepted result visible until the volunteer advances. Otherwise
    // the camera can rescan the same pass and overwrite green with already-used.
  }, []);

  useEffect(() => {
    let isMounted = true;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!isMounted) return;
      const qr = new Html5Qrcode("qr-reader");
      html5QrRef.current = qr;

      try {
        qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            // Fixed 260x260 overflows narrow phone screens in portrait mode.
            // Size the box off the actual viewfinder instead so it always
            // fits — but html5-qrcode itself throws (synchronously, outside
            // our .catch()) if this ever comes out under its hard 50px
            // minimum, e.g. while the container is still mid-layout. Clamp
            // for safety.
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight) || 250;
              const size = Math.max(50, Math.floor(edge * 0.7));
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => handleScan(decodedText),
          () => {}
        )
          .then(() => setScanning(true))
          .catch((err) => setCameraError(String(err)));
      } catch (err) {
        setCameraError(String(err));
      }
    });

    return () => {
      isMounted = false;
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, [handleScan]);

  function dismissResult() {
    setResult(null);
    busyRef.current = false;
  }

  const style = result ? RESULT_STYLES[result.result] || RESULT_STYLES.error : null;

  return (
    <main style={{ minHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", background: "#0f172a", color: "#ffffff" }}>
      {/* ── Top Bar ── */}
      <div style={{ padding: "16px 20px", background: "#1e293b", borderBottom: "1px solid #334155", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", padding: "3px 10px", borderRadius: 999, marginBottom: 4 }}>
          📷 FOOD COUNTER SCANNER
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#ffffff" }}>Point Camera at Student QR</h1>
      </div>

      {/* ── Viewfinder Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "min(380px, 100%)", textAlign: "center" }}>
          <div
            id="qr-reader"
            ref={scannerRef}
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "2px solid #334155",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              background: "#000000"
            }}
          />

          {cameraError && (
            <div style={{ marginTop: 20, padding: 14, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "var(--radius-sm)", color: "#fca5a5", fontSize: 13.5 }}>
              ⚠️ Camera Access Error. Please enable camera permissions in browser settings.
            </div>
          )}

          {!cameraError && !scanning && (
            <div style={{ marginTop: 16, color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>
              Initializing camera lens…
            </div>
          )}
        </div>

        {/* ── Fullscreen Overlay Scan Result ── */}
        {result && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 600,
              background: style.bg, color: "white",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center", animation: "fadeIn 0.2s ease-out"
            }}
          >
            <div style={{ fontSize: 80, lineHeight: 1, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>
              {style.icon}
            </div>

            <div style={{ fontSize: 32, fontWeight: 900, marginTop: 20, letterSpacing: "-0.02em" }}>
              {style.title}
            </div>

            {style.subtitle && (
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, opacity: 0.95 }}>
                {style.subtitle}
              </div>
            )}

            {style.extraText && (
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 14, background: "rgba(0,0,0,0.25)", padding: "8px 18px", borderRadius: 999 }}>
                {style.extraText}
              </div>
            )}

            {result.participant && (
              <div style={{ marginTop: 28, background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: "var(--radius-lg)", width: "min(340px, 100%)" }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{result.participant.name}</div>
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                  {[result.participant.program, result.participant.year].filter(Boolean).join(" · ")}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4, fontFamily: "monospace" }}>
                  {result.participant.registration_id} · +91 {result.participant.phone}
                </div>
              </div>
            )}

            <button
              onClick={dismissResult}
              className="btn btn-block"
              style={{
                marginTop: 36, maxWidth: 280, height: 52, background: "#ffffff", border: "none",
                color: "#0f172a", fontSize: 16, fontWeight: 800, borderRadius: "var(--radius-full)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
              }}
            >
              Ready for Next Scan →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
