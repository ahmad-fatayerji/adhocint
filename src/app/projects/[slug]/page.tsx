import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectGallery from "@/components/ProjectGallery";

type ProjectImage = {
  id: string;
  isCover: boolean;
  sortOrder: number | null;
  createdAt: Date;
};

function orderImages(images: ProjectImage[]) {
  const ordered = images.slice();
  const coverIdx = ordered.findIndex((x) => x.isCover);
  if (coverIdx > 0) {
    const [cover] = ordered.splice(coverIdx, 1);
    ordered.unshift(cover);
  }
  return ordered;
}

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: {
      title: true,
      category: true,
      year: true,
      description: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          isCover: true,
          sortOrder: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) notFound();

  const orderedImages = orderImages(project.images);
  const images = orderedImages.map((img) => ({
    fullUrl: `/api/public/project-images/${img.id}`,
    thumbUrl: `/api/public/project-images/${img.id}?w=720`,
  }));

  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-bold text-[var(--brand-blue)] mb-2 break-words leading-tight">
              {project.title}
            </h1>
            <p className="text-xs uppercase tracking-wide text-black/60">
              {project.category} &bull; {project.year}
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--brand-blue)_40%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--brand-blue)] shadow-sm transition hover:border-[color-mix(in_oklab,var(--brand-blue)_65%,transparent)] hover:bg-[color-mix(in_oklab,var(--brand-blue)_8%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)] self-start sm:self-start whitespace-nowrap"
          >
            Back to projects
          </Link>
        </div>
        <p className="text-base text-black/70 leading-relaxed mb-8 max-w-4xl">
          {project.description}
        </p>
        <ProjectGallery title={project.title} images={images} />
      </div>
    </main>
  );
}
