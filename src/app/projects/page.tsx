import ProjectCard, { ProjectCardProps } from "@/components/ProjectCard";

const projects: ProjectCardProps[] = [
  {
    title: "Corporate Headquarters Fit-Out",
    client: "Alpha Corp",
    year: 2024,
    description:
      "Complete interior fit-out including MEP, partitioning, acoustic ceilings, custom joinery, and turnkey delivery across 3,500 m² of office space.",
    images: [
      { src: "/logo.png", alt: "Placeholder 1" },
      { src: "/logo.png", alt: "Placeholder 2" },
      { src: "/logo.png", alt: "Placeholder 3" },
    ],
  },
  {
    title: "Hospital Wing Expansion",
    client: "City Medical Center",
    year: 2023,
    description:
      "Structural extension and interior works for a new surgical wing, integrating advanced HVAC, medical gas systems, and resilient finishes.",
    images: [{ src: "/logo.png" }, { src: "/logo.png" }],
  },
  {
    title: "Logistics Warehouse Upgrade",
    client: "Global Freight Solutions",
    year: 2025,
    description:
      "Reinforcement of flooring, installation of racking foundations, energy‑efficient LED lighting, and fire safety system retrofits.",
    images: [{ src: "/logo.png" }, { src: "/logo.png" }, { src: "/logo.png" }],
  },
];

export default function ProjectsPage() {
  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4">
        <header className="mb-10 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Projects</h1>
          <p className="text-lg text-black/70 leading-relaxed">
            A selection of recent work showcasing our capability across fit-out,
            civil, and infrastructure scopes. Each project is executed with a
            focus on quality, coordination, and safety.
          </p>
        </header>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {projects.map((p) => (
            <ProjectCard key={p.title} {...p} />
          ))}
        </div>
      </div>
    </main>
  );
}
