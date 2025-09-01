"use client";
import { useEffect, useState } from "react";
import projectsData from "@/data/projects.json";
import { ProjectRowProps } from "@/components/ProjectRow";
import Image from "next/image";

interface ProjectData extends ProjectRowProps {}
const projects = projectsData as unknown as ProjectData[];

export default function ProjectsPage() {
  interface GalleryState {
    images: string[];
    index: number;
    loading: boolean;
  }

  const [galleries, setGalleries] = useState<Record<string, GalleryState>>({});

  function ensureLoaded(folder: string, cover: string) {
    if (galleries[folder]) return;
    setGalleries((g) => ({
      ...g,
      [folder]: { images: [cover], index: 0, loading: true },
    }));
    fetch(`/api/project-images?folder=${encodeURIComponent(folder)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.images) && d.images.length) {
          // Keep cover as first image even if the API returns a different ordering
          const withCoverFirst = [
            cover,
            ...d.images.filter((img: string) => img !== cover),
          ];
          setGalleries((g) => ({
            ...g,
            [folder]: { images: withCoverFirst, index: 0, loading: false },
          }));
        } else {
          setGalleries((g) => ({
            ...g,
            [folder]: { images: [cover], index: 0, loading: false },
          }));
        }
      })
      .catch(() => {
        setGalleries((g) => ({
          ...g,
          [folder]: { images: [cover], index: 0, loading: false },
        }));
      });
  }

  function changeIndex(folder: string, dir: 1 | -1) {
    setGalleries((g) => {
      const cur = g[folder];
      if (!cur) return g;
      const total = cur.images.length;
      const next = (cur.index + dir + total) % total;
      return { ...g, [folder]: { ...cur, index: next } };
    });
  }

  function selectIndex(folder: string, idx: number) {
    setGalleries((g) => {
      const cur = g[folder];
      if (!cur) return g;
      return { ...g, [folder]: { ...cur, index: idx } };
    });
  }

  // Preload all covers immediately
  useEffect(() => {
    projects.forEach((p) => ensureLoaded(p.folder, p.cover));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderGrid() {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-10">
        {projects.map((p) => {
          const g = galleries[p.folder] || {
            images: [p.cover],
            index: 0,
            loading: true,
          };
          const current = g.images[g.index];
          return (
            <div
              key={p.title}
              className="group flex flex-col rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden"
            >
              <div className="relative aspect-[16/10] bg-white">
                <Image
                  src={current}
                  alt={p.title}
                  fill
                  sizes="(max-width:768px) 100vw, 33vw"
                  className="object-cover"
                  priority={false}
                />
                {g.images.length > 1 && (
                  <>
                    <button
                      onClick={() => changeIndex(p.folder, -1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/85 hover:bg-white text-[var(--brand-blue)] shadow opacity-0 group-hover:opacity-100 transition"
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => changeIndex(p.folder, 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/85 hover:bg-white text-[var(--brand-blue)] shadow opacity-0 group-hover:opacity-100 transition"
                      aria-label="Next image"
                    >
                      ›
                    </button>
                  </>
                )}
                {g.images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {g.images.slice(0, 8).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => selectIndex(p.folder, i)}
                        aria-label={`Show image ${i + 1}`}
                        className={`h-2 w-2 rounded-full border border-[var(--brand-blue)]/40 transition ${
                          i === g.index
                            ? "bg-[var(--brand-blue)]"
                            : "bg-[var(--brand-blue)]/20 hover:bg-[var(--brand-blue)]/40"
                        }`}
                      />
                    ))}
                    {g.images.length > 8 && (
                      <span className="ml-1 text-[10px] text-black/60">
                        +{g.images.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col gap-3 flex-1">
                <h3 className="font-semibold text-lg leading-tight text-[var(--brand-blue)]">
                  {p.title}
                </h3>
                <p className="text-xs uppercase tracking-wide text-black/60">
                  {p.client} • {p.year}
                </p>
                <p className="text-sm text-black/70 leading-relaxed line-clamp-5">
                  {p.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <header className="mb-8 max-w-5xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] mb-4">
            Selected References
          </h1>
          <p className="text-lg text-black/70 leading-relaxed mb-6">
            Browse our references; each card lets you flip through that
            project's gallery directly.
          </p>
        </header>
        {renderGrid()}
        <p className="text-[10px] mt-10 text-center text-black/50 tracking-wide">
          © AD HOC International s.a.r.l
        </p>
      </div>
    </main>
  );
}
