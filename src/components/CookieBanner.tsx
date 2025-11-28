"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { updateAnalyticsConsent } from "@/lib/analytics";

const CONSENT_KEY = "adhocint-cookie-consent";

type ConsentChoice = "granted" | "denied";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(
      CONSENT_KEY
    ) as ConsentChoice | null;

    if (!stored) {
      setVisible(true);
      return;
    }

    const success = updateAnalyticsConsent(stored === "granted");
    if (!success) {
      const timer = window.setInterval(() => {
        if (updateAnalyticsConsent(stored === "granted")) {
          window.clearInterval(timer);
        }
      }, 500);
      return () => window.clearInterval(timer);
    }
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONSENT_KEY, choice);
    }
    const applied = updateAnalyticsConsent(choice === "granted");
    if (!applied && typeof window !== "undefined") {
      const timer = window.setInterval(() => {
        if (updateAnalyticsConsent(choice === "granted")) {
          window.clearInterval(timer);
        }
      }, 500);
      window.setTimeout(() => window.clearInterval(timer), 4000);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/30 bg-[var(--brand-blue)]/95 p-5 text-white shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-base">Cookies & Analytics</p>
            <p className="text-sm text-white/80">
              We use first-party cookies to understand traffic and improve our
              services. Choose “Accept” to enable analytics or “Decline” to
              continue with essential cookies only.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button
              variant="ghost"
              className="w-full border border-white/40 text-white md:w-auto"
              onClick={() => handleChoice("denied")}
            >
              Decline
            </Button>
            <Button
              variant="secondary"
              className="w-full md:w-auto"
              onClick={() => handleChoice("granted")}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
