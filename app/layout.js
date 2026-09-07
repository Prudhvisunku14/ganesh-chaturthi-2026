import "./globals.css";

export const metadata = {
  title: "Ganesh Chaturthi 2026 — Event Portal",
  description: "Official Ganesh Chaturthi 2026 registration, scanner, and food collection management",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
