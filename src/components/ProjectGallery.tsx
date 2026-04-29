"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button";

type GalleryImage = {
  fullUrl: string;
  thumbUrl: string;
};

type ImageDimensions = {
  width: number;
  height: number;
};

const PREVIEW_WIDTHS = [960, 1280, 1600, 1920];

function closestPreviewWidth(requested: number) {
  return PREVIEW_WIDTHS.reduce((prev, curr) =>
    Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
  );
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

function getValidDimensions(width: number, height: number) {
  return width && height && width > 0 && height > 0
    ? { width, height }
    : null;
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
  const [previewMeta, setPreviewMeta] = useState<
    Record<string, { width: number; height: number; ratio: number }>
  >({});
  const [thumbMeta, setThumbMeta] = useState<
    Record<string, ImageDimensions | null>
  >({});
  const [loadedThumbUrls, setLoadedThumbUrls] = useState<Set<string>>(
    () => new Set()
  );
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const tileDimensions = useMemo(
    () => images.map((img) => thumbMeta[img.thumbUrl]),
    [images, thumbMeta]
  );
  const isLayoutReady = tileDimensions.every(Boolean);
  const pendingThumbUrls = useMemo(() => {
    const urls = new Set<string>();
    images.forEach((img, i) => {
      if (!tileDimensions[i]) {
        urls.add(img.thumbUrl);
      }
    });
    return Array.from(urls);
  }, [images, thumbMeta, tileDimensions]);
  const previewWidth = useMemo(() => {
    if (typeof window === "undefined") {
      return PREVIEW_WIDTHS[PREVIEW_WIDTHS.length - 1];
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const target = Math.round(window.innerWidth * dpr);
    return closestPreviewWidth(target);
  }, [activeIndex]);
  const previewUrl = useMemo(
    () =>
      activeImage
        ? withQueries(activeImage.fullUrl, { w: previewWidth })
        : "",
    [activeImage, previewWidth]
  );
  const previewRatio = previewUrl
    ? previewMeta[previewUrl]?.ratio || 4 / 3
    : 4 / 3;

  useEffect(() => {
    if (pendingThumbUrls.length === 0) return;
    let cancelled = false;
    pendingThumbUrls.forEach((url) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const width = img.naturalWidth || 0;
        const height = img.naturalHeight || 0;
        setLoadedThumbUrls((prev) => new Set(prev).add(url));
        setThumbMeta((prev) => ({
          ...prev,
          [url]: getValidDimensions(width, height) ?? { width: 4, height: 3 },
        }));
      };
      img.onerror = () => {
        if (cancelled) return;
        setThumbMeta((prev) => ({ ...prev, [url]: { width: 4, height: 3 } }));
      };
      img.src = url;
    });
    return () => {
      cancelled = true;
    };
  }, [pendingThumbUrls]);

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

  useEffect(() => {
    if (!previewUrl) return;
    setPreviewLoaded(false);
    setPreviewMeta((prev) => {
      if (prev[previewUrl]) return prev;
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || 1;
        const height = img.naturalHeight || 1;
        setPreviewMeta((current) => {
          if (current[previewUrl]) return current;
          return {
            ...current,
            [previewUrl]: {
              width,
              height,
              ratio: width / height,
            },
          };
        });
      };
      img.src = previewUrl;
      return prev;
    });
  }, [previewUrl]);

  return (
    <>
      {!isLayoutReady ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5"
          aria-label="Loading gallery layout"
        >
          {images.slice(0, Math.min(images.length, 12)).map((_, i) => (
            <div
              key={`gallery-layout-placeholder-${i}`}
              className="aspect-[4/3] rounded-2xl border border-black/10 bg-black/5 skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 sm:gap-5 [column-gap:1.25rem]">
          {images.map((img, i) => {
            const dimensions = tileDimensions[i]!;
            const isLoaded = loadedThumbUrls.has(img.thumbUrl);
            return (
              <button
                key={`gallery-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                className="group relative mb-4 sm:mb-5 w-full break-inside-avoid overflow-hidden rounded-2xl border border-black/10 bg-white text-left"
                aria-label={`Open ${title} image ${i + 1}`}
                style={{
                  aspectRatio: `${dimensions.width} / ${dimensions.height}`,
                }}
              >
                {!isLoaded && (
                  <div className="absolute inset-0 bg-black/5 skeleton-shimmer" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumbUrl}
                  alt={`${title} ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() =>
                    setLoadedThumbUrls((prev) =>
                      new Set(prev).add(img.thumbUrl)
                    )
                  }
                  width={dimensions.width}
                  height={dimensions.height}
                  className={`h-full w-full object-contain transition-[opacity,transform] duration-300 group-hover:scale-[1.02] ${
                    isLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
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
                <div
                  className="relative w-full max-h-[80vh]"
                  style={{ aspectRatio: previewRatio }}
                >
                  {!previewLoaded && (
                    <div className="absolute inset-0 rounded-2xl bg-black/5 skeleton-shimmer" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`${title} full view`}
                    loading="eager"
                    decoding="async"
                    width={previewUrl ? previewMeta[previewUrl]?.width : undefined}
                    height={previewUrl ? previewMeta[previewUrl]?.height : undefined}
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      const width = target.naturalWidth || 1;
                      const height = target.naturalHeight || 1;
                      if (previewUrl) {
                        setPreviewMeta((prev) => ({
                          ...prev,
                          [previewUrl]: {
                            width,
                            height,
                            ratio: width / height,
                          },
                        }));
                      }
                      setPreviewLoaded(true);
                    }}
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
