import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hierarchical data for services (can be replaced / extended later)
interface ServiceNode {
  title: string;
  children?: ServiceNode[];
}

const services: ServiceNode[] = [
  {
    title: "Consultancy",
    children: [
      {
        title: "Medium Voltage",
        children: [{ title: "MV switchgear" }, { title: "MV network" }],
      },
      {
        title: "Low Voltage",
        children: [
          { title: "MDBs, DBs, PBs, MCCs" },
          { title: "LV Cables" },
          { title: "Raceways" },
          { title: "Wiring Devices" },
          {
            title: "Lighting",
            children: [
              { title: "Normal" },
              { title: "Emergency" },
              { title: "Exit" },
              { title: "Lighting Control" },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Life Safety Systems",
    children: [
      { title: "Fire Alarm" },
      { title: "VESDA" },
      { title: "Gas Detection" },
      { title: "CO Detection" },
    ],
  },
  {
    title: "Security Systems",
    children: [
      { title: "CCTV" },
      { title: "Anti-intrusion" },
      { title: "Access Control" },
    ],
  },
  { title: "Low Current Systems" },
  { title: "Home Automation" },
  { title: "Audio-Video" },
  { title: "Photovoltaic" },
  { title: "Telemetry" },
];

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
  return (
    <main className="section">
      <div className="container mx-auto px-4 max-w-6xl space-y-10">
        <header className="max-w-3xl">
          <h1 className="hero-title font-bold text-[var(--brand-blue)] text-balance">
            Electrical Systems Covered (Engineering & Execution)
          </h1>
          <p className="mt-4 text-lg text-foreground/70 leading-relaxed">
            A structured overview of the electrical, safety, security and
            automation systems we can engineer, integrate, and execute. This
            list can be tailored to project scope.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-[var(--brand-brown)] tracking-wide">
              Service Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <Tree nodes={services.slice(0, 3)} />
              </div>
              <div>
                <Tree nodes={services.slice(3)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
