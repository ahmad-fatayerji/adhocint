"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import ProjectForm, { ProjectFormHandle } from "./ProjectForm";
import ProjectImagesManager, {
  ProjectImagesManagerHandle,
} from "./ProjectImagesManager";

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

export default function ProjectEditor({ project }: { project: Project }) {
  const router = useRouter();
  const formRef = useRef<ProjectFormHandle>(null);
  const imagesRef = useRef<ProjectImagesManagerHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [canSave, setCanSave] = useState(false);

  const hasChanges = () =>
    (formRef.current?.hasChanges() ?? false) ||
    (imagesRef.current?.hasChanges() ?? false);

  useEffect(() => {
    const update = () => setCanSave(hasChanges());
    update();
    const interval = window.setInterval(update, 400);
    return () => window.clearInterval(interval);
  }, []);

  const handleSaveAll = async (): Promise<boolean> => {
    if (saving) return false;
    setError("");
    setSaving(true);
    try {
      const imagesBusy = imagesRef.current?.isBusy() ?? false;
      if (imagesBusy) {
        setError("Please wait for uploads to finish.");
        return false;
      }

      const imagesChanged = imagesRef.current?.hasChanges() ?? false;
      if (imagesChanged) {
        const ok = await imagesRef.current?.save();
        if (!ok) {
          setError("Failed to save images.");
          return false;
        }
      }

      const formChanged = formRef.current?.hasChanges() ?? false;
      if (formChanged) {
        const ok = await formRef.current?.save();
        if (!ok) {
          setError("Failed to save project details.");
          return false;
        }
      }

      if (!imagesChanged && !formChanged) {
        setError("No changes to save.");
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col gap-3">
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-3"
              onClick={() => {
                if (hasChanges()) {
                  setShowLeavePrompt(true);
                } else {
                  router.back();
                }
              }}
            >
              <span className="text-base leading-none">←</span>
              <span>Back</span>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Edit Project</h1>
        </div>

        {showLeavePrompt && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>You have unsaved changes. Save before leaving?</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    const ok = await handleSaveAll();
                    if (ok) router.back();
                  }}
                  disabled={saving}
                >
                  Save & Go Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Discard Changes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowLeavePrompt(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-700">{error}</div>}

        <ProjectForm
          ref={formRef}
          mode="edit"
          formId={`project-form-${project.id}`}
          showSaveButton={false}
          initial={project}
        />

        <ProjectImagesManager ref={imagesRef} projectId={project.id} />

        <div className="mt-8 flex items-center justify-center">
          <Button
            type="button"
            size="lg"
            className="min-w-48"
            onClick={handleSaveAll}
            disabled={saving || !canSave}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </main>
  );
}
