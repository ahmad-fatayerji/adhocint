import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import ProjectEditor from "../ProjectEditor";

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
    <ProjectEditor
      project={{
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
  );
}
