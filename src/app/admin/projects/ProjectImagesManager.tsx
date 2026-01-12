"use client";

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import Button from "@/components/ui/button";

type ProjectImage = {
  id: string;
  objectKey: string;
  sortOrder: number;
  isCover: boolean;
  contentType: string | null;
  bytes: string | null;
  url: string;
  thumbUrl?: string;
};

export default function ProjectImagesManager({
  projectId,
}: {
  projectId: string;
}) {
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [coverId, setCoverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(30); // Show 30 images at a time
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state stored in refs to avoid re-renders during drag
  const dragState = useRef<{
    draggedIdx: number | null;
    dropIdx: number | null;
  }>({
    draggedIdx: null,
    dropIdx: null,
  });
  const gridRef = useRef<HTMLDivElement>(null);

  const hasFileTransfer = (e: React.DragEvent) => {
    const types = e.dataTransfer?.types
      ? Array.from(e.dataTransfer.types)
      : [];
    return types.includes("Files") || (e.dataTransfer?.files?.length ?? 0) > 0;
  };

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
      setVisibleCount(30); // Reset pagination on refresh
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!previewUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewUrl]);

  const orderedIds = useMemo(() => images.map((x) => x.id), [images]);
  const visibleImages = useMemo(
    () => images.slice(0, visibleCount),
    [images, visibleCount]
  );
  const hasMoreImages = visibleCount < images.length;

  const hasChanges =
    images.some((img, i) => img.sortOrder !== i) ||
    (coverId && images.find((x) => x.id === coverId)?.isCover === false) ||
    (!coverId && images.some((x) => x.isCover));

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
      setImages((prev) =>
        prev.map((img, i) => ({
          ...img,
          sortOrder: i,
          isCover: coverId ? img.id === coverId : false,
        }))
      );
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
          headers: { "Content-Type": file.type || "application/octet-stream" },
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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((x) => x.id)));
    }
  }, [images, selectedIds.size]);

  const getIdxFromEvent = (e: React.DragEvent | React.MouseEvent) => {
    const value = (e.currentTarget as HTMLElement).dataset.idx;
    return value ? Number(value) : -1;
  };

  const getIdFromEvent = (e: React.MouseEvent) =>
    (e.currentTarget as HTMLElement).dataset.id || "";

  // Drag handlers using refs to minimize re-renders
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const idx = getIdxFromEvent(e);
    if (idx < 0) return;
    dragState.current.draggedIdx = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
    (e.currentTarget as HTMLElement).dataset.dragging = "1";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    delete (e.currentTarget as HTMLElement).dataset.dragging;
    // Clear all drop indicators
    gridRef.current?.querySelectorAll("[data-drop-indicator]").forEach((el) => {
      (el as HTMLElement).style.display = "none";
    });
    dragState.current = { draggedIdx: null, dropIdx: null };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (hasFileTransfer(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const idx = getIdxFromEvent(e);
    if (idx < 0) return;
    const { draggedIdx } = dragState.current;
    if (draggedIdx === null || idx === draggedIdx) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertIdx = e.clientX < midX ? idx : idx + 1;

    if (dragState.current.dropIdx !== insertIdx) {
      dragState.current.dropIdx = insertIdx;
      // Update drop indicator visually without state
      gridRef.current
        ?.querySelectorAll("[data-drop-indicator]")
        .forEach((el, i) => {
          (el as HTMLElement).style.display =
            i === insertIdx ? "block" : "none";
        });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (hasFileTransfer(e) && e.dataTransfer?.files?.length) {
      setIsDraggingFiles(false);
      dragState.current = { draggedIdx: null, dropIdx: null };
      void onUploadFiles(e.dataTransfer.files);
      return;
    }
    const { draggedIdx, dropIdx } = dragState.current;

    if (draggedIdx === null || dropIdx === null || draggedIdx === dropIdx) {
      return;
    }

    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(draggedIdx, 1);
      const adjustedIdx = dropIdx > draggedIdx ? dropIdx - 1 : dropIdx;
      copy.splice(adjustedIdx, 0, item);
      return copy.map((x, i) => ({ ...x, sortOrder: i }));
    });
  }, []);

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    if (hasFileTransfer(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isDraggingFiles) setIsDraggingFiles(true);
      return;
    }
    e.preventDefault();
  }, [isDraggingFiles]);

  const handleGridDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDraggingFiles(false);
    }
  }, []);

  const handleToggleSelect = useCallback(
    (e: React.MouseEvent) => {
      const id = getIdFromEvent(e);
      if (!id) return;
      toggleSelect(id);
    },
    [toggleSelect]
  );

  const handleSetCover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const id = getIdFromEvent(e);
    if (!id) return;
    setCoverId((prev) => (prev === id ? null : id));
  }, []);

  const handleOpenPreview = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Images</h2>
          <p className="mt-1 text-sm text-black/60">
            Drag to reorder - Click to select - Click star to set cover
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
        <div
          className={`py-12 text-center border-2 border-dashed rounded-xl transition-colors ${
            isDraggingFiles
              ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/5"
              : "border-black/10"
          }`}
          onDragOver={handleGridDragOver}
          onDragLeave={handleGridDragLeave}
          onDrop={handleDrop}
        >
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
          <p className="text-sm text-black/60">
            Drop images here or use upload.
          </p>
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
        <>
          <div
            ref={gridRef}
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 rounded-xl transition-colors ${
              isDraggingFiles
                ? "ring-2 ring-[var(--brand-blue)] ring-offset-2"
                : ""
            }`}
            onDragOver={handleGridDragOver}
            onDragLeave={handleGridDragLeave}
            onDrop={handleDrop}
          >
            {visibleImages.map((img, idx) => (
              <ImageTile
                key={img.id}
                id={img.id}
                fullUrl={img.url}
                thumbUrl={img.thumbUrl || img.url}
                idx={idx}
                isSelected={selectedIds.has(img.id)}
                isCover={coverId === img.id}
                onToggleSelect={handleToggleSelect}
                onSetCover={handleSetCover}
                onOpenPreview={handleOpenPreview}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              />
            ))}
            {/* Final drop indicator for dropping at the end */}
            <div
              data-drop-indicator
              className="absolute -right-1.5 top-0 bottom-0 w-1 bg-[var(--brand-blue)] rounded-full z-10"
              style={{ display: "none" }}
            />
          </div>

          {/* Load More / Show All button */}
          {hasMoreImages && (
            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + 30)}
              >
                Load More ({images.length - visibleCount} remaining)
              </Button>
              <button
                type="button"
                className="ml-3 text-sm text-black/50 hover:text-black/70 underline"
                onClick={() => setVisibleCount(images.length)}
              >
                Show All
              </button>
            </div>
          )}
        </>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full bg-black/70 text-white w-9 h-9 hover:bg-black/80 transition"
              aria-label="Close preview"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="w-full h-auto max-h-[80vh] object-contain bg-black/5"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      )}
    </section>
  );
}

const ImageTile = memo(function ImageTile({
  id,
  fullUrl,
  thumbUrl,
  idx,
  isSelected,
  isCover,
  onToggleSelect,
  onSetCover,
  onOpenPreview,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  id: string;
  fullUrl: string;
  thumbUrl: string;
  idx: number;
  isSelected: boolean;
  isCover: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onSetCover: (e: React.MouseEvent) => void;
  onOpenPreview: (url: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  const handleTileClick = (e: React.MouseEvent) => {
    if ((e.currentTarget as HTMLElement).dataset.dragging === "1") return;
    onToggleSelect(e);
  };

  return (
    <div className="relative">
      {/* Drop indicator - hidden by default, shown via JS */}
      <div
        data-drop-indicator
        className="absolute -left-1.5 top-0 bottom-0 w-1 bg-[var(--brand-blue)] rounded-full z-10"
        style={{ display: "none" }}
      />

      <div
        draggable
        data-idx={idx}
        data-id={id}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onClick={handleTileClick}
        className={`
          relative aspect-square rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
          border-2 transition-colors
          ${
            isSelected
              ? "border-[var(--brand-blue)] ring-2 ring-[var(--brand-blue)]/30"
              : "border-transparent hover:border-black/20"
          }
          group
        `}
        style={{ contentVisibility: "auto", containIntrinsicSize: "200px 200px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover bg-black/5"
          draggable={false}
        />

        {/* Order number */}
        <div className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center pointer-events-none">
          {idx + 1}
        </div>

        {/* Selection checkbox */}
        <button
          type="button"
          data-id={id}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(e);
          }}
          className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center
            ${
              isSelected
                ? "bg-[var(--brand-blue)] border-[var(--brand-blue)]"
                : "bg-white/80 border-black/20 opacity-0 group-hover:opacity-100"
            }`}
          aria-label={isSelected ? "Unselect image" : "Select image"}
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
        </button>

        {/* Cover badge */}
        <button
          data-id={id}
          onClick={onSetCover}
          className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium
            ${
              isCover
                ? "bg-[var(--brand-brown)] text-white"
                : "bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/70"
            }`}
        >
          {isCover ? "* Cover" : "Set cover"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPreview(fullUrl);
          }}
          className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium bg-white/80 text-black/80 opacity-0 group-hover:opacity-100 hover:bg-white transition"
          aria-label="Open full image"
        >
          View
        </button>
      </div>
    </div>
  );
});
