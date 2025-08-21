import * as React from "react";

export default function Badge({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        "border-[var(--brand-blue)] text-[var(--brand-blue)] bg-[color-mix(in_oklab,white_92%,var(--brand-blue))] " +
        (className ?? "")
      }
    >
      {children}
    </span>
  );
}
