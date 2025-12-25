"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";

export default function CreateAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    setError("");
    setSuccess("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to create admin.");
        return;
      }

      setSuccess("Admin created.");
      setPassword("");
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <input
        required
        type="email"
        placeholder="Admin email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="form-field h-11 px-3"
      />
      <input
        required
        type="password"
        placeholder="Temporary password (12+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="form-field h-11 px-3"
      />

      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      {success ? <div className="text-sm text-green-700">{success}</div> : null}

      <Button disabled={status === "saving"}>
        {status === "saving" ? "Creating..." : "Create admin"}
      </Button>
      <p className="text-xs text-black/60">
        Admins will receive a login code by email after entering their password.
      </p>
    </form>
  );
}
