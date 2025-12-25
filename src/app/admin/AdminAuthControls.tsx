"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";

export default function AdminAuthControls({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loggingOut">("idle");
  const [error, setError] = useState<string>("");

  async function logout() {
    if (status !== "idle") return;
    setStatus("loggingOut");
    setError("");
    try {
      const res = await fetch("/api/admin/logout", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Logout failed");
        return;
      }
      router.push("/admin/login");
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/admin/login"
        className="text-sm text-black/70 hover:text-black"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={status !== "idle"}
        onClick={logout}
      >
        {status === "loggingOut" ? "Logging out..." : "Logout"}
      </Button>
    </div>
  );
}
