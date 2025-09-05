"use client";

import epcData from "@/data/services/epc.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hierarchical data model
interface ServiceNode {
  title: string;
  children?: ServiceNode[];
}

const epcServices = epcData as ServiceNode[];

function Tree({ nodes, level = 0 }: { nodes: ServiceNode[]; level?: number }) {
  return (
    <ul className={level === 0 ? "space-y-2" : "mt-2 space-y-1"}>
      {nodes.map((n, i) => (
        <li key={i}>
          <div className="flex gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-sm bg-black shrink-0 ${
                level === 0 ? "mt-[7px]" : "mt-[6px]"
              }`}
            />
            <span
              className={`leading-relaxed ${
                level === 0
                  ? "font-semibold text-lg text-[var(--brand-brown)]"
                  : level === 1
                  ? "font-semibold text-[var(--brand-blue)]"
                  : "text-[var(--brand-blue)]"
              }`}
            >
              {n.title}
            </span>
          </div>
          {n.children && (
            <div className="ml-4 pl-4 border-l border-[var(--brand-blue)]/20">
              <Tree nodes={n.children} level={level + 1} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ServicesPage() {
  const data = epcServices;
  const midpoint = Math.ceil(data.length / 2);

  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-6xl space-y-10">
        <header className="max-w-3xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] text-balance">
            Services
          </h1>
        </header>
        <Card>
          <CardContent className="pt-8">
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <Tree nodes={data.slice(0, midpoint)} />
              </div>
              <div>
                <Tree nodes={data.slice(midpoint)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
