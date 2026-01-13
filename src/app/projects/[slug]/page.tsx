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
    include: {
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!project) notFound();

  const orderedImages = orderImages(project.images);
  const images = orderedImages.map((img) => ({
    fullUrl: `/api/public/project-images/${img.id}`,
    thumbUrl: `/api/public/project-images/${img.id}?w=720&h=450`,
  }));

  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
            className="text-sm font-medium text-[var(--brand-blue)] nav-underline self-start sm:self-auto"
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
