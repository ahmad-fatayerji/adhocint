import Link from "next/link";
import "../globals.css";
import { getAdminSession } from "@/lib/auth/session";
import AdminAuthControls from "./AdminAuthControls";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionPromise = getAdminSession();

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/10 bg-white/70">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-bold text-lg">
              Admin
            </Link>
            <AdminNav sessionPromise={sessionPromise} />
          </div>
          {/* avoid making the whole layout async; just await inside */}
          <AdminHeaderAuth sessionPromise={sessionPromise} />
        </div>
      </header>

      {children}
    </div>
  );
}

async function AdminHeaderAuth({
  sessionPromise,
}: {
  sessionPromise: ReturnType<typeof getAdminSession>;
}) {
  const session = await sessionPromise;
  return <AdminAuthControls isLoggedIn={!!session} />;
}

async function AdminNav({
  sessionPromise,
}: {
  sessionPromise: ReturnType<typeof getAdminSession>;
}) {
  const session = await sessionPromise;
  // Hide admin navigation when there's no session (e.g. on the login page)
  if (!session) return null;

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  return (
    <nav className="flex items-center gap-3 text-sm text-black/70">
      <Link href="/admin/projects" className="hover:text-black">
        Projects
      </Link>
      {isSuperAdmin ? (
        <Link href="/admin/users" className="hover:text-black">
          Admins
        </Link>
      ) : null}
    </nav>
  );
}
