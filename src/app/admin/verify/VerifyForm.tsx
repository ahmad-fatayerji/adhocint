"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";

export default function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying">("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "verifying") return;
    setStatus("verifying");
    setError("");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("Invalid code");
        return;
      }

      router.push("/admin");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
      <input
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="form-field h-11 px-3 tracking-widest"
      />

      {error && <div className="text-sm text-red-700">{error}</div>}

      <Button disabled={status === "verifying"}>
        {status === "verifying" ? "Verifying..." : "Verify"}
      </Button>
    </form>
  );
}
