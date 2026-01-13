"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button";

type GalleryImage = {
  fullUrl: string;
  thumbUrl: string;
};

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

export default function ProjectGallery({
  title,
  images,
}: {
  title: string;
  images: GalleryImage[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const previewUrl = useMemo(() => {
    if (!activeImage) return "";
    return withQueries(activeImage.fullUrl, { w: 1280, h: 800 });
  }, [activeImage]);

  useEffect(() => {
    if (activeIndex === null) return;
    setPreviewLoaded(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prev;
    };
  }, [activeIndex]);

  return (
    <>
      <div className="grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={`gallery-${i}`}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="group relative overflow-hidden rounded-2xl border border-black/10 bg-black/5 text-left"
            aria-label={`Open ${title} image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbUrl || img.fullUrl}
              alt={`${title} ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-3 sm:p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative w-full max-w-6xl max-h-[90vh] rounded-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] ring-1 ring-black/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 sm:p-6 bg-gradient-to-b from-white to-white/95">
                <div className="relative w-full max-h-[80vh] aspect-[16/10]">
                  {!previewLoaded && (
                    <div className="absolute inset-0 rounded-2xl bg-black/5 skeleton-shimmer" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`${title} full view`}
                    loading="eager"
                    decoding="async"
                    onLoad={() => setPreviewLoaded(true)}
                    className={`w-full h-full object-contain rounded-2xl bg-black/5 shadow-sm transition-opacity duration-300 ${
                      previewLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setActiveIndex(null)}
              variant="secondary"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
