import Link from "next/link";

export default function NotFound() {
  return (
    <main className="notfound-wrap">
      <div className="notfound-bg" aria-hidden="true" />
      <div className="notfound-orb notfound-orb--one" aria-hidden="true" />
      <div className="notfound-orb notfound-orb--two" aria-hidden="true" />

      <section className="container mx-auto px-6 py-24 min-h-[70vh] flex items-center">
        <div className="max-w-2xl">
          <p
            className="text-xs uppercase tracking-[0.4em] text-[color:var(--brand-brown)] notfound-fade"
            style={{ animationDelay: "60ms" }}
          >
            Error 404
          </p>
          <h1
            className="mt-4 text-4xl sm:text-5xl font-semibold text-[color:var(--brand-dark)] notfound-fade"
            style={{ animationDelay: "140ms" }}
          >
            This page wandered off the blueprint.
          </h1>
          <p
            className="mt-4 text-base sm:text-lg text-[color:color-mix(in oklab, var(--brand-dark) 70%, white)] notfound-fade"
            style={{ animationDelay: "220ms" }}
          >
            The link might be outdated or the destination moved. Let us guide you
            back to a place that is still under construction.
          </p>
          <div
            className="mt-8 flex flex-col sm:flex-row gap-4 notfound-fade"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white bg-[color:var(--brand-blue)] shadow-[0_12px_30px_rgba(57,96,173,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Back to home
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[color:var(--brand-blue)] border border-[color:color-mix(in oklab, var(--brand-blue) 70%, transparent)] bg-white/70 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              View projects
            </Link>
          </div>
          <div
            className="mt-10 text-sm text-[color:color-mix(in oklab, var(--brand-dark) 55%, white)] notfound-fade"
            style={{ animationDelay: "380ms" }}
          >
            Need help?{" "}
            <Link
              href="/#contact"
              className="font-semibold text-[color:var(--brand-brown)] hover:text-[color:var(--brand-blue)] transition-colors"
            >
              Contact our team
            </Link>
            .
          </div>
        </div>
      </section>
    </main>
  );
}
