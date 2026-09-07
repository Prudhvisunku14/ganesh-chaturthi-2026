"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid username or password.");
        return;
      }
      const next = params.get("next");
      if (next) {
        router.push(next);
      } else {
        router.push(data.role === "volunteer" ? "/dashboard/scanner" : "/dashboard");
      }
      router.refresh();
    } catch {
      setError("Network connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "radial-gradient(circle at top right, #312e81 0%, #0f172a 60%, #090d16 100%)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "32px 24px",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Brand Icon Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: "var(--radius)",
            background: "var(--accent-gradient)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            boxShadow: "0 8px 20px rgba(245, 158, 11, 0.4)",
            marginBottom: 12
          }}>
            🪔
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
            Ganesh Chaturthi 2026
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 4 }}>
            Organizer & Volunteer Portal
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6, color: "var(--text-muted)" }}>
            USERNAME
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6, color: "var(--text-muted)" }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="badge badge-error" style={{ display: "block", marginBottom: 16, padding: "10px 14px", width: "100%", textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ height: 48, fontSize: 15 }}>
          {loading ? "Authenticating..." : "Sign In to Dashboard →"}
        </button>
      </form>
    </main>
  );
}
