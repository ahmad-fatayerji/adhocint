import * as React from "react";

export function Card({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={
        "rounded-xl border border-black/10 bg-white/60 shadow-sm backdrop-blur-sm " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={
        "px-5 pt-5 pb-3 border-b border-black/5" +
        (className ? " " + className : "")
      }
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <h3
      className={
        "text-lg font-semibold tracking-tight" +
        (className ? " " + className : "")
      }
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={"px-5 py-4" + (className ? " " + className : "")}>
      {children}
    </div>
  );
}
