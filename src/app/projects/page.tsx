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
  images: { fullUrl: string; thumbUrl: string }[];
};

type ImageMeta = {
  width: number;
  height: number;
  ratio: number;
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<Record<string, ImageMeta>>(
    {}
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const didSwipeRef = useRef(false);

  const images = project.images || [];
  const current = images[index];
  const currentThumb = current?.thumbUrl;
  const currentFull = current?.fullUrl;
  const currentPreview = currentFull
    ? withQueries(currentFull, { w: 1280, h: 800 })
    : "";
  const currentSrcSet = currentFull
    ? buildSrcSet(currentFull, [480, 720, 960, 1280], 10 / 16)
    : "";
  const currentSizes =
    "(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw";
  const previewRatio =
    (currentPreview && previewMeta[currentPreview]?.ratio) || 16 / 10;

  const preloadImageMeta = useCallback((url: string) => {
    if (!url) return;
    setPreviewMeta((prev) => {
      if (prev[url]) return prev;
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || 1;
        const height = img.naturalHeight || 1;
        setPreviewMeta((current) => {
          if (current[url]) return current;
          return {
            ...current,
            [url]: {
              width,
              height,
              ratio: width / height,
            },
          };
        });
      };
      img.src = url;
      return prev;
    });
  }, []);

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

  useEffect(() => {
    if (!isVisible || !currentPreview) return;
    preloadImageMeta(currentPreview);
  }, [currentPreview, isVisible, preloadImageMeta]);

  function changeIndex(dir: 1 | -1) {
    if (images.length <= 1) return;
    setDirection(dir);
    setImageLoaded(false);
    setPreviewLoaded(false);
    setIndex((i) => (i + dir + images.length) % images.length);
  }

  function selectIndex(idx: number) {
    if (idx === index) return;
    setImageLoaded(false);
    setPreviewLoaded(false);
    setIndex(idx);
  }

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPreviewOpen(false);
        return;
      }
      if (e.key === "ArrowRight") changeIndex(1);
      if (e.key === "ArrowLeft") changeIndex(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen, images.length]);

  useEffect(() => {
    if (!isPreviewOpen || !currentPreview) return;
    setPreviewLoaded(false);
    preloadImageMeta(currentPreview);
  }, [currentPreview, isPreviewOpen, preloadImageMeta]);

  return (
    <div
      ref={cardRef}
      className="group flex flex-col rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden"
    >
      <div
        className="relative aspect-[16/10] bg-black/5"
        role="button"
        tabIndex={0}
        aria-label={`Open ${project.title} gallery`}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          setIsPreviewOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsPreviewOpen(true);
          }
        }}
        onTouchStart={(e) => {
          didSwipeRef.current = false;
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
            didSwipeRef.current = true;
            changeIndex(dx < 0 ? 1 : -1);
          }
        }}
      >
        {isVisible ? (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentFull || "empty"}
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
              {currentThumb ? (
                <>
                  {/* Placeholder while loading */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-black/5 skeleton-shimmer" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentThumb || currentFull || ""}
                    srcSet={currentSrcSet}
                    sizes={currentSizes}
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
              onClick={(e) => {
                e.stopPropagation();
                changeIndex(-1);
              }}
              className="inline-flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 hover:bg-white text-[var(--brand-blue)] shadow-sm ring-1 ring-black/5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10"
              aria-label="Previous image"
            >
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4 mx-auto"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                changeIndex(1);
              }}
              className="inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 hover:bg-white text-[var(--brand-blue)] shadow-sm ring-1 ring-black/5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10"
              aria-label="Next image"
            >
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4 mx-auto"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7.5 4.5 13 10l-5.5 5.5" />
              </svg>
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.slice(0, 8).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  selectIndex(i);
                }}
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPreviewOpen(true);
          }}
          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full text-xs font-medium bg-white/85 text-black/80 shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
          aria-label="Open gallery"
        >
          View
        </button>
      </div>

      <div className="p-6 flex flex-col gap-3 flex-1">
        <h3 className="font-semibold text-lg leading-tight text-[var(--brand-blue)]">
          {project.title}
        </h3>
        <p className="text-xs uppercase tracking-wide text-black/60">
          {project.client} &bull; {project.year}
        </p>
        <p className="text-sm text-black/70 leading-relaxed line-clamp-5">
          {project.description}
        </p>
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-6xl rounded-3xl bg-white/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex items-center justify-center rounded-full bg-white/90 text-black/70 w-9 h-9 hover:bg-white shadow-sm ring-1 ring-black/10 transition"
              aria-label="Close gallery"
            >
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
            <div className="relative p-4 sm:p-6 bg-gradient-to-b from-white to-white/95">
              {currentPreview ? (
                <div
                  className="relative w-full max-h-[80vh] min-h-[40vh]"
                  style={{ aspectRatio: previewRatio }}
                >
                  {!previewLoaded && (
                    <div className="absolute inset-0 rounded-2xl bg-black/5 skeleton-shimmer" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentPreview}
                    alt={project.title}
                    loading="eager"
                    decoding="async"
                    width={previewMeta[currentPreview]?.width}
                    height={previewMeta[currentPreview]?.height}
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      const width = target.naturalWidth || 1;
                      const height = target.naturalHeight || 1;
                      setPreviewMeta((prev) => ({
                        ...prev,
                        [currentPreview]: {
                          width,
                          height,
                          ratio: width / height,
                        },
                      }));
                      setPreviewLoaded(true);
                    }}
                    className={`w-full h-full object-contain rounded-2xl bg-black/5 shadow-sm transition-opacity duration-300 ${
                      previewLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              ) : (
                <div className="w-full h-[50vh] rounded-2xl bg-black/5" />
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => changeIndex(-1)}
                    className="inline-flex absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white/95 hover:bg-white text-[var(--brand-blue)] shadow-sm ring-1 ring-black/10"
                    aria-label="Previous image"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="w-5 h-5 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12.5 4.5 7 10l5.5 5.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => changeIndex(1)}
                    className="inline-flex absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white/95 hover:bg-white text-[var(--brand-blue)] shadow-sm ring-1 ring-black/10"
                    aria-label="Next image"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="w-5 h-5 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7.5 4.5 13 10l-5.5 5.5" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex items-center justify-center gap-2 py-3 bg-white border-t border-black/10">
                {images.slice(0, 10).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => selectIndex(i)}
                    aria-label={`Show image ${i + 1}`}
                    className={`h-2.5 w-2.5 rounded-full border border-[var(--brand-blue)]/40 transition ${
                      i === index
                        ? "bg-[var(--brand-blue)]"
                        : "bg-[var(--brand-blue)]/20 hover:bg-[var(--brand-blue)]/40"
                    }`}
                  />
                ))}
                {images.length > 10 && (
                  <span className="text-[10px] text-black/60">
                    +{images.length - 10}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildSrcSet(baseUrl: string, widths: number[], ratio: number) {
  return widths
    .map((width) => {
      const height = Math.round(width * ratio);
      const url = withQueries(baseUrl, { w: width, h: height });
      return `${url} ${width}w`;
    })
    .join(", ");
}

function withQueries(baseUrl: string, params: Record<string, number>) {
  try {
    const url = new URL(baseUrl, "http://local");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    return url.pathname + url.search + url.hash;
  } catch {
    const joiner = baseUrl.includes("?") ? "&" : "?";
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    return `${baseUrl}${joiner}${query}`;
  }
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
          &copy; AD HOC International s.a.r.l
        </p>
      </div>
    </main>
  );
}


