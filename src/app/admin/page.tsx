import { redirect } from "next/navigation";
import Button from "@/components/ui/button";
import { getAdminSession } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  async function logout() {
    "use server";
  }

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-2 text-sm text-black/70">
          Signed in as{" "}
          <span className="font-semibold">{session.user.email}</span>
        </p>

        <form
          action={async () => {
            "use server";
            const { revokeAdminSession } = await import("@/lib/auth/session");
            await revokeAdminSession();
            redirect("/admin/login");
          }}
          className="mt-6"
        >
          <Button type="submit" variant="outline">
            Logout
          </Button>
        </form>
      </div>
    </main>
  );
}
