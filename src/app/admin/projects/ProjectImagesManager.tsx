"use client";

import { useEffect, useState, useRef, useCallback, memo } from "react";
import Button from "@/components/ui/button";

type ProjectImage = {
  id: string;
  objectKey: string;
  sortOrder: number;
  isCover: boolean;
  contentType: string | null;
  bytes: string | null;
  url: string;
};

// Memoized image tile to prevent unnecessary re-renders
const ImageTile = memo(function ImageTile({
  img,
  idx,
  isSelected,
  isDragging,
  isCover,
  showDropBefore,
  showDropAfter,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onToggleSelect,
  onSetCover,
}: {
  img: ProjectImage;
  idx: number;
  isSelected: boolean;
  isDragging: boolean;
  isCover: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleSelect: (id: string) => void;
  onSetCover: (id: string, isCover: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={tileRef} className="relative">
      {showDropBefore && (
        <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-[var(--brand-blue)] rounded-full z-10 animate-pulse" />
      )}

      <div
        draggable
        onDragStart={(e) => onDragStart(e, idx)}
        onDragOver={(e) => onDragOver(e, idx)}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
        className={`
          relative aspect-square rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
          border-2 transition-all duration-200 ease-out
          ${
            isDragging
              ? "opacity-40 scale-95 border-dashed border-black/30"
              : ""
          }
          ${
            isSelected
              ? "border-[var(--brand-blue)] ring-2 ring-[var(--brand-blue)]/30"
              : "border-transparent"
          }
          ${!isSelected ? "hover:border-black/20" : ""}
          group
        `}
        onClick={() => onToggleSelect(img.id)}
      >
        {/* Placeholder */}
        {(!inView || !loaded) && (
          <div className="absolute inset-0 bg-black/5 animate-pulse" />
        )}

        {/* Actual image - only load when in view */}
        {inView && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.url}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover bg-black/5 pointer-events-none transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        )}

        {/* Order number badge */}
        <div className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center">
          {idx + 1}
        </div>

        {/* Selection checkbox overlay */}
        <div
          className={`
            absolute top-2 left-2 w-5 h-5 rounded border-2 
            flex items-center justify-center transition-all
            ${
              isSelected
                ? "bg-[var(--brand-blue)] border-[var(--brand-blue)]"
                : "bg-white/80 border-black/20 opacity-0 group-hover:opacity-100"
            }
          `}
        >
          {isSelected && (
            <svg
              className="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Cover badge */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetCover(img.id, isCover);
          }}
          className={`
            absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium transition-all
            ${
              isCover
                ? "bg-[var(--brand-brown)] text-white"
                : "bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/70"
            }
          `}
        >
          {isCover ? "★ Cover" : "Set cover"}
        </button>

        {/* Drag handle indicator */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
          <svg
            className="w-4 h-4 text-white drop-shadow"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
      </div>

      {showDropAfter && (
        <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-[var(--brand-blue)] rounded-full z-10 animate-pulse" />
      )}
    </div>
  );
});

export default function ProjectImagesManager({
  projectId,
}: {
  projectId: string;
}) {
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [coverId, setCoverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const orderedIds = images.map((x) => x.id);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/images`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to load images");
        setImages([]);
        setCoverId(null);
        return;
      }
      const next: ProjectImage[] = data.images || [];
      setImages(next);
      const cover = next.find((x) => x.isCover);
      setCoverId(cover?.id ?? null);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveOrder() {
    if (savingOrder) return;
    setSavingOrder(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/images`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds, coverId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to save");
        return;
      }
      await refresh();
    } finally {
      setSavingOrder(false);
    }
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (uploading) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const createRes = await fetch(
          `/api/admin/projects/${projectId}/images`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || "application/octet-stream",
              bytes: file.size,
            }),
          }
        );
        const createData = await createRes.json().catch(() => null);
        if (!createRes.ok || !createData?.ok) {
          setError(createData?.error || "Failed to prepare upload");
          return;
        }

        const uploadUrl: string = createData.uploadUrl;
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!putRes.ok) {
          setError(`Upload failed for ${file.name}`);
          return;
        }
      }

      await refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeOne(imageId: string) {
    setError("");
    const res = await fetch(
      `/api/admin/projects/${projectId}/images/${imageId}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError(data?.error || "Failed to delete image");
      return false;
    }
    return true;
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Delete ${selectedIds.size} selected image(s)? This cannot be undone.`
      )
    )
      return;
    setError("");
    for (const id of selectedIds) {
      const ok = await removeOne(id);
      if (!ok) break;
    }
    await refresh();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((x) => x.id)));
    }
  }

  // Drag and drop handlers - index-based for smooth reordering
  function handleDragStart(e: React.DragEvent, idx: number) {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    // Create a minimal drag image
    const el = e.currentTarget as HTMLElement;
    if (el) {
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    }
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIdx === null || idx === draggedIdx) {
      setDropIdx(null);
      return;
    }
    // Determine drop position based on mouse position within the target
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    // If dragging from left and hovering on right half, or vice versa
    const insertIdx = e.clientX < midX ? idx : idx + 1;
    setDropIdx(insertIdx);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the grid area entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!gridRef.current?.contains(relatedTarget)) {
      setDropIdx(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (draggedIdx === null || dropIdx === null) {
      setDraggedIdx(null);
      setDropIdx(null);
      return;
    }

    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(draggedIdx, 1);
      // Adjust index if dropping after the dragged item's original position
      const adjustedIdx = dropIdx > draggedIdx ? dropIdx - 1 : dropIdx;
      copy.splice(adjustedIdx, 0, item);
      return copy.map((x, i) => ({ ...x, sortOrder: i }));
    });

    setDraggedIdx(null);
    setDropIdx(null);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDropIdx(null);
  }

  const hasChanges =
    images.some((img, i) => img.sortOrder !== i) ||
    (coverId && images.find((x) => x.id === coverId)?.isCover === false) ||
    (!coverId && images.some((x) => x.isCover));

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Images</h2>
          <p className="mt-1 text-sm text-black/60">
            Drag to reorder • Click to select • Click cover badge to set
            thumbnail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onUploadFiles(e.target.files)}
          />
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={deleteSelected}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Delete ({selectedIds.size})
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={savingOrder || uploading || !hasChanges}
            onClick={saveOrder}
          >
            {savingOrder ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {images.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-black/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedIds.size === images.length && images.length > 0}
              onChange={selectAll}
              className="rounded"
            />
            Select all ({images.length})
          </label>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-black/60">
          Loading images...
        </div>
      ) : images.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-black/10 rounded-xl">
          <div className="text-black/40 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-black/60">No images yet</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Images
          </Button>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {images.map((img, idx) => (
            <ImageTile
              key={img.id}
              img={img}
              idx={idx}
              isSelected={selectedIds.has(img.id)}
              isDragging={draggedIdx === idx}
              isCover={coverId === img.id}
              showDropBefore={
                dropIdx === idx && draggedIdx !== null && draggedIdx !== idx
              }
              showDropAfter={
                dropIdx === idx + 1 &&
                idx === images.length - 1 &&
                draggedIdx !== null
              }
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onToggleSelect={toggleSelect}
              onSetCover={(id, isCover) => setCoverId(isCover ? null : id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
