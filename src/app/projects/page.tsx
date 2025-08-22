"use client";
import { useState } from "react";
import projectsData from "@/data/projects.json" assert { type: "json" };
import ProjectRow, { ProjectRowProps } from "@/components/ProjectRow";
import Image from "next/image";

const projects = projectsData as ProjectRowProps[];

type LayoutMode = "list" | "grid" | "gridModal";

export default function ProjectsPage() {
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  function renderList() {
    return (
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
    );
  }

  function renderGrid() {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {projects.map((p) => (
          <div
            key={p.title}
            className="flex flex-col rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden hover:shadow-md transition"
          >
            <div className="relative aspect-[4/3] bg-white">
              <Image
                src={p.images[0].src}
                alt={p.images[0].alt || p.title}
                fill
                sizes="(max-width:768px) 100vw, 33vw"
                className={
                  p.fit === "contain" ? "object-contain p-4" : "object-cover"
                }
              />
            </div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <h3 className="font-semibold text-lg leading-tight text-[var(--brand-blue)] line-clamp-2">
                {p.title}
              </h3>
              <p className="text-xs uppercase tracking-wide text-black/60">
                {p.client} • {p.year}
              </p>
              <p className="text-sm text-black/70 leading-relaxed line-clamp-4">
                {p.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderGridModal() {
    return (
      <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map((p, i) => (
            <button
              key={p.title}
              onClick={() => setModalIndex(i)}
              className="group text-left rounded-lg border border-black/10 bg-white overflow-hidden hover:shadow transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]"
            >
              <div className="relative aspect-[4/3] bg-white">
                <Image
                  src={p.images[0].src}
                  alt={p.images[0].alt || p.title}
                  fill
                  sizes="(max-width:768px) 100vw, 25vw"
                  className={
                    p.fit === "contain" ? "object-contain p-4" : "object-cover"
                  }
                />
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-medium text-sm text-[var(--brand-blue)] line-clamp-2 min-h-[2.75rem]">
                  {p.title}
                </h3>
                <p className="text-[11px] uppercase tracking-wide text-black/50">
                  {p.client} • {p.year}
                </p>
              </div>
            </button>
          ))}
        </div>
        {modalIndex !== null && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <div className="bg-white w-full max-w-5xl rounded-lg shadow-xl overflow-hidden relative">
              <button
                onClick={() => setModalIndex(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 border border-black/10 flex items-center justify-center text-xl leading-none hover:bg-white"
                aria-label="Close"
              >
                ×
              </button>
              <div className="p-6">
                <ProjectRow {...projects[modalIndex]} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <header className="mb-8 max-w-5xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] mb-4">
            Selected References
          </h1>
          <div
            className="flex flex-wrap gap-2 mb-4"
            role="tablist"
            aria-label="Project layout options"
          >
            {[
              { key: "list", label: "List" },
              { key: "grid", label: "Grid" },
              { key: "gridModal", label: "Grid + Detail" },
            ].map((b) => {
              const active = layout === b.key;
              return (
                <button
                  key={b.key}
                  onClick={() => setLayout(b.key as LayoutMode)}
                  role="tab"
                  aria-selected={active}
                  className={`rounded-full px-4 py-2 text-sm font-medium border transition ${
                    active
                      ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                      : "bg-white border-[var(--brand-brown)] text-[var(--brand-brown)] hover:bg-[var(--brand-brown)]/10"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <p className="text-lg text-black/70 leading-relaxed">
            Explore different presentation styles for the same dataset.
          </p>
        </header>
        {layout === "list" && renderList()}
        {layout === "grid" && renderGrid()}
        {layout === "gridModal" && renderGridModal()}
        <p className="text-[10px] mt-10 text-center text-black/50 tracking-wide">
          © AD HOC International s.a.r.l
        </p>
      </div>
    </main>
  );
}
