import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import ProjectForm from "../ProjectForm";
import ProjectImagesManager from "../ProjectImagesManager";

export default async function AdminEditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) redirect("/admin/projects");

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-3xl font-bold">Edit Project</h1>
        <ProjectForm
          mode="edit"
          initial={{
            id: project.id,
            slug: project.slug,
            title: project.title,
            location: project.location,
            year: project.year,
            category: project.category,
            description: project.description,
            published: project.published,
          }}
        />

        <ProjectImagesManager projectId={project.id} />
      </div>
    </main>
  );
}
