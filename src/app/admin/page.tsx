import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [projectCount, imageCount] = await Promise.all([
    prisma.project.count(),
    prisma.projectImage.count(),
  ]);

  const recentProjects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      _count: { select: { images: true } },
    },
  });

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-sm text-black/60">
            Welcome back,{" "}
            <span className="font-medium text-black">{session.user.email}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-xl border border-black/10 bg-white">
            <div className="text-3xl font-bold text-[var(--brand-blue)]">
              {projectCount}
            </div>
            <div className="text-sm text-black/60 mt-1">Total Projects</div>
          </div>
          <div className="p-6 rounded-xl border border-black/10 bg-white">
            <div className="text-3xl font-bold text-[var(--brand-brown)]">
              {imageCount}
            </div>
            <div className="text-sm text-black/60 mt-1">Total Images</div>
          </div>
          <div className="p-6 rounded-xl border border-black/10 bg-white sm:col-span-2 lg:col-span-1">
            <Link
              href="/admin/projects/new"
              className="inline-flex items-center gap-2 text-[var(--brand-blue)] font-medium hover:underline"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add New Project
            </Link>
            <div className="text-sm text-black/60 mt-1">
              Create a new project
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
            <h2 className="font-semibold">Recent Projects</h2>
            <Link
              href="/admin/projects"
              className="text-sm text-[var(--brand-blue)] hover:underline"
            >
              View all →
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-black/60">
              No projects yet.{" "}
              <Link
                href="/admin/projects/new"
                className="text-[var(--brand-blue)] hover:underline"
              >
                Create one
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/projects/${p.id}`}
                  className="px-6 py-4 flex items-center justify-between hover:bg-black/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-sm text-black/60">
                      {p.year} • {p._count.images} images
                    </div>
                  </div>
                  <div
                    className={`text-xs px-2 py-1 rounded ${
                      p.published
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {p.published ? "Published" : "Draft"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
