import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionToken, COOKIE_NAME } from "../../lib/auth";
import SidebarNav from "./SidebarNav";

export default function DashboardLayout({ children }) {
  const raw     = cookies().get(COOKIE_NAME)?.value;
  const session = raw ? readSessionToken(raw) : null;

  if (!session) redirect("/login");

  return (
    <div className="dashboard-shell">
      <SidebarNav role={session.role} username={session.username} />
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
