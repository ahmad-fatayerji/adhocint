import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import ProjectForm from "../ProjectForm";

export default async function AdminNewProjectPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-bold">Add Project</h1>
        <ProjectForm mode="create" />
      </div>
    </main>
  );
}
