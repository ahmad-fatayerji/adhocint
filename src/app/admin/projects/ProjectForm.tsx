"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";

type Project = {
  id: string;
  slug: string;
  title: string;
  location: string;
  year: number;
  category: string;
  description: string;
  published: boolean;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProjectForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Project;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [error, setError] = useState<string>("");

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [year, setYear] = useState(
    String(initial?.year ?? new Date().getFullYear())
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [published, setPublished] = useState(initial?.published ?? true);

  const canDelete = mode === "edit" && !!initial?.id;

  const payload = useMemo(
    () => ({
      slug: slugify(slug),
      title,
      location,
      year: Number(year),
      category,
      description,
      published,
    }),
    [slug, title, location, year, category, description, published]
  );

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    setError("");

    try {
      const url =
        mode === "create"
          ? "/api/admin/projects"
          : `/api/admin/projects/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Save failed");
        return;
      }

      if (mode === "create" && data?.project?.id) {
        router.push(`/admin/projects/${data.project.id}`);
      } else {
        router.push("/admin/projects");
      }
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  async function onDelete() {
    if (!canDelete || status !== "idle") return;
    if (!confirm("Delete this project?")) return;

    setStatus("deleting");
    setError("");
    try {
      const res = await fetch(`/api/admin/projects/${initial!.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Delete failed");
        return;
      }

      router.push("/admin/projects");
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="mt-6 grid gap-3" onSubmit={onSave}>
      <div className="grid gap-1">
        <label className="text-sm text-black/70">Slug</label>
        <input
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. 2024-icrc-shelter"
          className="form-field h-11 px-3"
        />
        <div className="text-xs text-black/50">
          Saved as:{" "}
          <span className="font-mono">{slugify(slug) || "(empty)"}</span>
        </div>
      </div>

      <div className="grid gap-1">
        <label className="text-sm text-black/70">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="form-field h-11 px-3"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm text-black/70">Location</label>
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="form-field h-11 px-3"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm text-black/70">Year</label>
        <input
          required
          inputMode="numeric"
          value={year}
          onChange={(e) =>
            setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
          }
          className="form-field h-11 px-3"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm text-black/70">Category</label>
        <input
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="form-field h-11 px-3"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm text-black/70">Description</label>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-field px-3 py-2 min-h-[140px]"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        Published
      </label>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="flex items-center gap-3">
        <Button disabled={status !== "idle"}>
          {status === "saving"
            ? "Saving..."
            : mode === "create"
            ? "Create"
            : "Save"}
        </Button>
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            disabled={status !== "idle"}
            onClick={onDelete}
          >
            {status === "deleting" ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}
