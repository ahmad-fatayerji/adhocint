import projectsData from "@/data/projects.json" assert { type: "json" };
import ProjectRow, { ProjectRowProps } from "@/components/ProjectRow";

const projects = projectsData as ProjectRowProps[];

export default function ProjectsPage() {
  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <header className="mb-10 max-w-5xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] mb-4">
            Selected References
          </h1>
          <p className="text-lg text-black/70 leading-relaxed">
            A representative sample of projects illustrating our
            multidisciplinary execution capability and coordination quality.
          </p>
        </header>
        <div className="border-2 border-[var(--brand-brown)] rounded-sm bg-white divide-y divide-black/10">
          {projects.map((p, i) => (
            <div
              key={p.title}
              className={i % 2 === 0 ? "bg-white" : "bg-[var(--brand-brown)]/3"}
            >
              <div className="px-4 md:px-6 py-6">
                <ProjectRow {...p} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-6 text-center text-black/50 tracking-wide">
          © AD HOC International s.a.r.l
        </p>
      </div>
    </main>
  );
}
