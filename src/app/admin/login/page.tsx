"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Login failed");
        return;
      }

      router.push(`/admin/verify?email=${encodeURIComponent(email)}`);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-lg">
        <h1 className="text-3xl font-bold">Admin Login</h1>
        <p className="mt-2 text-sm text-black/70">
          If your email is whitelisted, you’ll receive a code.
        </p>

        <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-field h-11 px-3"
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-field h-11 px-3"
          />

          {error && <div className="text-sm text-red-700">{error}</div>}

          <Button disabled={status === "sending"}>
            {status === "sending" ? "Sending code..." : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}
