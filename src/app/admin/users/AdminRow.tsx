"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";

export default function AdminRow({
  admin,
  isSelf,
}: {
  admin: any;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState("");

  async function resetPassword() {
    const pwd = window.prompt("Enter new temporary password (12+ chars):");
    if (!pwd) return;
    if (pwd.length < 12) {
      alert("Password must be at least 12 characters");
      return;
    }
    setStatus("busy");
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, password: pwd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to reset password");
        return;
      }
      alert("Password updated.");
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  async function deleteAdmin() {
    if (!confirm(`Delete admin ${admin.email}? This cannot be undone.`)) return;
    setStatus("busy");
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to delete admin");
        return;
      }
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{admin.email}</div>
        <div className="text-xs text-black/60">
          {admin.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`text-xs px-2 py-1 rounded ${
            admin.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {admin.isActive ? "Active" : "Disabled"}
        </div>
        {!isSelf && admin.role !== "SUPER_ADMIN" ? (
          <>
            <Button
              size="sm"
              type="button"
              onClick={resetPassword}
              disabled={status !== "idle"}
            >
              Reset password
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
              onClick={deleteAdmin}
              disabled={status !== "idle"}
            >
              Delete
            </Button>
          </>
        ) : null}
        {error ? <div className="text-xs text-red-700">{error}</div> : null}
      </div>
    </div>
  );
}
