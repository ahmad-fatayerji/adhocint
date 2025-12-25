"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type PublicProject = {
  id: string;
  slug: string;
  title: string;
  client: string;
  year: number;
  description: string;
  images: string[];
};

// Individual project card with visibility-based loading
function ProjectCard({
  project,
  onVisible,
}: {
  project: PublicProject;
  onVisible?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const images = project.images || [];
  const current = images[index];

  // Intersection Observer for lazy loading
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          onVisible?.();
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  function changeIndex(dir: 1 | -1) {
    if (images.length <= 1) return;
    setDirection(dir);
    setImageLoaded(false);
    setIndex((i) => (i + dir + images.length) % images.length);
  }

  function selectIndex(idx: number) {
    if (idx === index) return;
    setImageLoaded(false);
    setIndex(idx);
  }

  return (
    <div
      ref={cardRef}
      className="group flex flex-col rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden"
    >
      <div
        className="relative aspect-[16/10] bg-black/5"
        onTouchStart={(e) => {
          const t = e.touches[0];
          (
            e.currentTarget as HTMLElement & {
              _swipeX?: number;
              _swipeY?: number;
              _swipeTime?: number;
            }
          )._swipeX = t.clientX;
          (
            e.currentTarget as HTMLElement & {
              _swipeX?: number;
              _swipeY?: number;
              _swipeTime?: number;
            }
          )._swipeY = t.clientY;
          (
            e.currentTarget as HTMLElement & {
              _swipeX?: number;
              _swipeY?: number;
              _swipeTime?: number;
            }
          )._swipeTime = Date.now();
        }}
        onTouchEnd={(e) => {
          const el = e.currentTarget as HTMLElement & {
            _swipeX?: number;
            _swipeY?: number;
            _swipeTime?: number;
          };
          const startX = el._swipeX ?? 0;
          const startY = el._swipeY ?? 0;
          const startTime = el._swipeTime ?? 0;
          const dt = Date.now() - startTime;
          const t = e.changedTouches[0];
          const dx = t.clientX - startX;
          const dy = Math.abs(t.clientY - startY);
          if (Math.abs(dx) > 40 && dy < 60 && dt < 800) {
            changeIndex(dx < 0 ? 1 : -1);
          }
        }}
      >
        {isVisible ? (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              initial="enter"
              animate="center"
              exit="exit"
              variants={{
                enter: (d: number) => ({
                  x: d > 0 ? 36 : -36,
                  opacity: 0,
                }),
                center: {
                  x: 0,
                  opacity: 1,
                  transition: { duration: 0.25, ease: [0.22, 0.7, 0.3, 1] },
                },
                exit: (d: number) => ({
                  x: d > 0 ? -36 : 36,
                  opacity: 0,
                  transition: { duration: 0.2, ease: [0.4, 0.1, 0.2, 1] },
                }),
              }}
              className="absolute inset-0"
            >
              {current ? (
                <>
                  {/* Placeholder while loading */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-black/5 animate-pulse" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current}
                    alt={project.title}
                    loading="eager"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </>
              ) : (
                <div className="absolute inset-0 bg-black/5" />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 bg-black/5" />
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={() => changeIndex(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/85 hover:bg-white text-[var(--brand-blue)] shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={() => changeIndex(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/85 hover:bg-white text-[var(--brand-blue)] shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.slice(0, 8).map((_, i) => (
              <button
                key={i}
                onClick={() => selectIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={`h-2 w-2 rounded-full border border-[var(--brand-blue)]/40 transition ${
                  i === index
                    ? "bg-[var(--brand-blue)]"
                    : "bg-[var(--brand-blue)]/20 hover:bg-[var(--brand-blue)]/40"
                }`}
              />
            ))}
            {images.length > 8 && (
              <span className="ml-1 text-[10px] text-black/60">
                +{images.length - 8}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col gap-3 flex-1">
        <h3 className="font-semibold text-lg leading-tight text-[var(--brand-blue)]">
          {project.title}
        </h3>
        <p className="text-xs uppercase tracking-wide text-black/60">
          {project.client} • {project.year}
        </p>
        <p className="text-sm text-black/70 leading-relaxed line-clamp-5">
          {project.description}
        </p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string>("");

  // Load projects from DB (images served from MinIO)
  useEffect(() => {
    setLoadingProjects(true);
    setProjectsError("");
    fetch("/api/public/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.projects)
          ? (d.projects as PublicProject[])
          : [];
        setProjects(list);
      })
      .catch(() => {
        setProjects([]);
        setProjectsError("Failed to load projects");
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  return (
    <main className="section pt-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <header className="mb-8 max-w-5xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] mb-4">
            Selected References
          </h1>
          <p className="text-lg text-black/70 leading-relaxed mb-6">
            Browse our references. Each card lets you flip through that
            project&apos;s gallery directly.
          </p>
        </header>
        {loadingProjects ? (
          <div className="text-sm text-black/70">Loading projects...</div>
        ) : projectsError ? (
          <div className="text-sm text-red-700">{projectsError}</div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-10">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
        <p className="text-[10px] mt-10 text-center text-black/50 tracking-wide">
          © AD HOC International s.a.r.l
        </p>
      </div>
    </main>
  );
}
