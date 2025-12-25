import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";

export default async function AdminProjectsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const projects = await prisma.project.findMany({
    orderBy: [{ year: "desc" }, { title: "asc" }],
  });

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="mt-2 text-sm text-black/70">
              Create, edit, or delete projects.
            </p>
          </div>
          <Link href="/admin/projects/new">
            <Button>Add Project</Button>
          </Link>
        </div>

        <div className="mt-6 border border-black/10 rounded-lg overflow-hidden bg-white">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-black/60 border-b border-black/10">
            <div className="col-span-1">Year</div>
            <div className="col-span-4">Title</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Slug</div>
            <div className="col-span-1 text-right">Edit</div>
          </div>
          {projects.length === 0 ? (
            <div className="px-4 py-6 text-sm text-black/70">
              No projects yet.
            </div>
          ) : (
            <div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-black/10 last:border-b-0 text-sm"
                >
                  <div className="col-span-1 text-black/70">{p.year}</div>
                  <div className="col-span-4 font-medium">{p.title}</div>
                  <div className="col-span-2 text-black/70">{p.location}</div>
                  <div className="col-span-2">
                    <Badge
                      className={
                        p.published
                          ? ""
                          : "border-black/20 text-black/60 bg-black/5"
                      }
                    >
                      {p.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-black/60 font-mono text-xs truncate">
                    {p.slug}
                  </div>
                  <div className="col-span-1 text-right">
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="text-[var(--brand-blue)] hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
