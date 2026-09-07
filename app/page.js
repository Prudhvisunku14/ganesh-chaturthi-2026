import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--primary-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          marginBottom: 20,
        }}
      >
        🪔
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 700 }}>Ganesh Chaturthi 2026</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 10 }}>
        Ganesh Pooja • Cultural Program • South Indian Dinner
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 15, marginTop: 4 }}>
        14 September 2026 · Auditorium
      </p>

      <div
        style={{
          marginTop: 36,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link href="/login" className="btn btn-primary">
          Organizer / Volunteer Login
        </Link>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 40, maxWidth: 420 }}>
        Registered through the event Google Form? Bring the QR code sent to
        you on WhatsApp to the food counter on the day of the event.
      </p>
    </main>
  );
}
