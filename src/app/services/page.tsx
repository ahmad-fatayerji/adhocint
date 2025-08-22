"use client";

import { useState } from "react";
import engineeringData from "@/data/services/engineering.json" assert { type: "json" };
import executionData from "@/data/services/execution.json" assert { type: "json" };
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hierarchical data model
interface ServiceNode {
  title: string;
  children?: ServiceNode[];
  note?: string; // optional short qualifier
}

// Extract JSON arrays (assert to our interface)
const engineeringServices = engineeringData as ServiceNode[];
const executionServices = executionData as ServiceNode[];

function Tree({ nodes, level = 0 }: { nodes: ServiceNode[]; level?: number }) {
  return (
    <ul className={level === 0 ? "space-y-2" : "mt-2 space-y-1"}>
      {nodes.map((n, i) => (
        <li key={i} className="group">
          <div className="flex items-start gap-2">
            <span className="mt-2 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--brand-blue)] group-hover:scale-110 transition-transform" />
            <span
              className={`leading-relaxed ${
                level === 0
                  ? "font-semibold text-[var(--brand-blue)] text-lg"
                  : level === 1
                  ? "font-semibold text-[var(--brand-blue)]"
                  : ""
              }`}
            >
              {n.title}
              {n.note && (
                <span className="ml-2 text-xs font-normal text-foreground/50">
                  {n.note}
                </span>
              )}
            </span>
          </div>
          {n.children && (
            <div className="pl-5 border-l border-[var(--brand-blue)]/20 ml-3">
              <Tree nodes={n.children} level={level + 1} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ServicesPage() {
  const tabs = [
    { key: "engineering", label: "Engineering", data: engineeringServices },
    { key: "execution", label: "Execution", data: executionServices },
  ] as const;

  const [active, setActive] =
    useState<(typeof tabs)[number]["key"]>("engineering");

  const activeData = tabs.find((t) => t.key === active)!.data;
  const midpoint = Math.ceil(activeData.length / 2);

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-6xl space-y-10">
        <header className="max-w-3xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] text-balance">
            Services Scope
          </h1>
          <p className="mt-4 text-lg text-foreground/70 leading-relaxed">
            Toggle between our detailed engineering capabilities and the wider
            execution trades we coordinate and deliver. Electrical execution
            references the granular systems listed under Engineering.
          </p>
        </header>
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[var(--brand-brown)] tracking-wide">
              Service Domains
            </CardTitle>
            <div
              className="mt-6 flex gap-2 overflow-x-auto pb-2"
              role="tablist"
              aria-label="Service domain groups"
            >
              {tabs.map((t) => {
                const selected = t.key === active;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`panel-${t.key}`}
                    onClick={() => setActive(t.key)}
                    className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                      selected
                        ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                        : "bg-white hover:bg-[var(--brand-brown)]/10 border-[var(--brand-brown)] text-[var(--brand-brown)]"
                    }`}
                  >
                    {t.label}
                    {selected && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-[var(--brand-blue)]/40 animate-pulse pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <div
              id={`panel-${active}`}
              role="tabpanel"
              aria-labelledby={active}
              className="grid md:grid-cols-2 gap-10"
            >
              <div>
                <Tree nodes={activeData.slice(0, midpoint)} />
              </div>
              <div>
                <Tree nodes={activeData.slice(midpoint)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
