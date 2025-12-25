import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CreateAdminForm from "./CreateAdminForm";
import AdminRow from "./AdminRow";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  const admins = await prisma.adminUser.findMany({
    orderBy: [{ role: "desc" }, { email: "asc" }],
  });

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Accounts</h1>
          <p className="mt-2 text-sm text-black/60">
            Create and manage admin access.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Create Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateAdminForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Admins</CardTitle>
            </CardHeader>
            <CardContent>
              {admins.length === 0 ? (
                <div className="text-sm text-black/60">No admins yet.</div>
              ) : (
                <div className="divide-y divide-black/5">
                  {admins.map((admin) => (
                    <div key={admin.id}>
                      {/* AdminRow handles actions client-side */}
                      <AdminRow
                        admin={admin}
                        isSelf={admin.id === session.user.id}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
